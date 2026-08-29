import { claimRecipientCallSlot, consumeCallToken } from '@/lib/callToken';
import { resolveRecipient } from '@/data/recipients';
import { readVapiConfig } from '@/lib/vapi';
import type { CallStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CALL_TIMEOUT_MS = 12_000;
const MAX_BODY_BYTES = 13_000;

function reply(body: CallStatus, status: number): Response {
  return Response.json(body, { status });
}

function isTrustedRequest(request: Request): boolean {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return false;
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  return origin === null || origin === new URL(request.url).origin;
}

export async function POST(request: Request): Promise<Response> {
  if (!isTrustedRequest(request)) {
    return reply({ status: 'failed', reason: 'Call request was not allowed.' }, 403);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return reply({ status: 'failed', reason: 'Call request is too large.' }, 413);
  }

  const config = readVapiConfig();
  if (config === null) {
    return reply(
      {
        status: 'unavailable',
        reason: 'Voice calling is not configured. The English briefing below is ready to read aloud.',
      },
      200,
    );
  }

  let callToken: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return reply({ status: 'failed', reason: 'Call request is too large.' }, 413);
    }
    const body: unknown = JSON.parse(rawBody);
    if (typeof body === 'object' && body !== null) {
      callToken = (body as { callToken?: unknown }).callToken;
    }
  } catch {
    return reply({ status: 'failed', reason: 'Invalid request body.' }, 400);
  }

  const intent = consumeCallToken(callToken);
  if (intent === null) {
    return reply(
      { status: 'failed', reason: 'This call authorization is invalid, expired, or already used. Run the analysis again.' },
      403,
    );
  }

  const recipient = resolveRecipient(intent.recipientId);
  if (recipient === null || recipient.phoneNumber === undefined) {
    return reply({ status: 'failed', reason: 'The configured recipient is unavailable.' }, 403);
  }
  if (!claimRecipientCallSlot(recipient.id)) {
    return reply(
      { status: 'failed', reason: 'A call was requested recently. Wait two minutes before trying again.' },
      429,
    );
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/call`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId: config.phoneNumberId,
        assistantId: config.assistantId,
        customer: { number: recipient.phoneNumber },
        assistantOverrides: {
          variableValues: {
            recipient_name: recipient.displayName,
            bill_briefing: intent.briefing,
          },
        },
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });

    if (!response.ok) {
      const requestId = response.headers
        .get('x-request-id')
        ?.replace(/[^a-zA-Z0-9_-]/gu, '')
        .slice(0, 80);
      console.error(
        `[rafiqai] vapi call rejected status=${response.status}${requestId ? ` requestId=${requestId}` : ''}`,
      );

      const reason =
        response.status === 400 || response.status === 404 || response.status === 422
          ? `Vapi rejected the call setup (${response.status}). Check the Vapi phone number and assistant configuration.`
          : response.status === 401 || response.status === 403
            ? `Vapi authentication was rejected (${response.status}). Check the server-side Vapi key.`
            : response.status === 429
              ? 'Vapi rate-limited the call request. Wait briefly and run the analysis again.'
              : `Vapi could not accept the call request (${response.status}). Retry later or read the briefing aloud.`;

      return reply({ status: 'failed', reason }, 200);
    }

    return reply({ status: 'placed', recipientName: recipient.displayName }, 200);
  } catch (error) {
    const category = error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network';
    console.error(`[rafiqai] vapi call failed category=${category}`);
    return reply(
      {
        status: 'unknown',
        reason: 'Vapi did not confirm the request. It may still place the call; do not retry yet.',
      },
      200,
    );
  }
}
