import 'server-only';
import { toE164 } from '@/lib/phone';

/**
 * Server-side outbound-call allow-list. Requirement 6.3 / 8.1: the browser sends a
 * recipient ID only; phone numbers are resolved here and never serialized to the client.
 */
export interface Recipient {
  id: string;
  displayName: string;
  /** E.164 number, resolved from server-side environment configuration. */
  phoneNumber: string | undefined;
}

const ALLOW_LIST: readonly Recipient[] = [
  {
    id: 'sarah',
    displayName: 'Sarah',
    phoneNumber: toE164(process.env.SARAH_PHONE_NUMBER),
  },
] as const;

export function resolveRecipient(recipientId: unknown): Recipient | null {
  if (typeof recipientId !== 'string') return null;
  const id = recipientId.trim().toLowerCase();
  return ALLOW_LIST.find((entry) => entry.id === id) ?? null;
}
