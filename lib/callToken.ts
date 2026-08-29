import 'server-only';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { readVapiConfig } from '@/lib/vapi';

const TOKEN_TTL_MS = 10 * 60_000;
const CALL_COOLDOWN_MS = 2 * 60_000;
const usedNonces = new Map<string, number>();
const recipientCooldowns = new Map<string, number>();

interface CallTokenPayload {
  recipientId: string;
  briefing: string;
  expiresAt: number;
  nonce: string;
}

function signingKey(): string | null {
  return readVapiConfig()?.apiKey ?? null;
}

function signature(body: string, key: string): string {
  return createHmac('sha256', key).update(body).digest('base64url');
}

export function issueCallToken(recipientId: string, briefing: string): string | null {
  const key = signingKey();
  if (!key) return null;
  const payload: CallTokenPayload = {
    recipientId,
    briefing: briefing.slice(0, 4_000),
    expiresAt: Date.now() + TOKEN_TTL_MS,
    nonce: randomUUID(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${signature(body, key)}`;
}

export function consumeCallToken(token: unknown): CallTokenPayload | null {
  const key = signingKey();
  if (!key || typeof token !== 'string' || token.length > 12_000) return null;
  try {
    const [body, supplied] = token.split('.');
    if (!body || !supplied) return null;
    const expected = signature(body, key);
    if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as CallTokenPayload;
    const now = Date.now();
    for (const [nonce, expiry] of usedNonces) if (expiry <= now) usedNonces.delete(nonce);
    if (payload.expiresAt <= now || usedNonces.has(payload.nonce) || payload.briefing.length < 20) return null;
    usedNonces.set(payload.nonce, payload.expiresAt);
    return payload;
  } catch {
    return null;
  }
}

export function claimRecipientCallSlot(recipientId: string): boolean {
  const now = Date.now();
  const blockedUntil = recipientCooldowns.get(recipientId) ?? 0;
  if (blockedUntil > now) return false;
  recipientCooldowns.set(recipientId, now + CALL_COOLDOWN_MS);
  return true;
}
