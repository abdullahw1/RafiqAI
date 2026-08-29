import { resolveRecipient } from '@/data/recipients';
import { buildAssistantConfig, readVapiConfig } from '@/lib/vapi';
import type { CallStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VAPI_CALL_URL = 'https://api.vapi.ai/call';
const CALL_TIMEOUT_MS = 12_000;
const MAX_BRIEFING_CHARS = 4_000;

function reply(body: CallStatus, status: number): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  let recipientId: unknown;
  let briefing = '';

  try {
    const body: unknown = await request.json();
    if (typeof body === 'object' && body !== null) {
      recipientId = (body as { recipientId?: unknown }).recipientId;
      const raw = (body as { briefing?: unknown }).briefing;
      if (typeof raw === 'string') briefing = raw.trim().slice(0, MAX_BRIEFING_CHARS);
    }
  } catch {
    return reply({ status: 'failed', reason: 'Invalid request body.' }, 400);
  }

  // Requirement 6.3: only allow-listed recipient IDs are accepted; the browser never
  // supplies a destination number.
  const recipient = resolveRecipient(recipientId);
  if (recipient === null) {
    return reply({ status: 'failed', reason: 'This recipient is not allow-listed.' }, 403);
  }
  if (briefing.length < 20) {
    return reply({ status: 'failed', reason: 'Run the analysis before calling.' }, 400);
  }

  const config = readVapiConfig();
  // Requirement 6.9: missing configuration is "unavailable", not an analysis failure.
  if (config === null || recipient.phoneNumber === undefined) {
    return reply(
      {
        status: 'unavailable',
        reason: 'Voice calling is not configured. The English briefing below is ready to read aloud.',
      },
      200,
    );
  }

  try {
    const response = await fetch(VAPI_CALL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId: config.phoneNumberId,
        customer: { number: recipient.phoneNumber },
        assistant: buildAssistantConfig({
          recipientName: recipient.displayName,
          briefing,
        }),
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Log status only — never the response body, which may echo the number.
      console.error(`[rafiqai] vapi call rejected with status ${response.status}`);
      return reply(
        {
          status: 'failed',
          reason: 'The calling provider rejected the request. You can retry or read the briefing aloud.',
        },
        200,
      );
    }

    return reply({ status: 'placed', recipientName: recipient.displayName }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    console.error(`[rafiqai] vapi call failed: ${message.slice(0, 120)}`);
    return reply(
      {
        status: 'failed',
        reason: 'The call could not be placed. You can retry or read the briefing aloud.',
      },
      200,
    );
  }
}
