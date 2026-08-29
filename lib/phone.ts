/**
 * Vapi requires E.164. Operators commonly paste numbers as "(408) 674-0311", so
 * normalize here rather than failing the call. Returns undefined when the value cannot
 * be turned into a plausible E.164 number.
 *
 * This module holds no secrets; it only transforms a string that the caller supplies.
 */
const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;
const NANP_LOCAL_DIGITS = 10;

export function toE164(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;

  const hadPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/gu, '');

  const inRange = digits.length >= MIN_E164_DIGITS && digits.length <= MAX_E164_DIGITS;
  if (hadPlus) return inRange ? `+${digits}` : undefined;

  // Bare 10-digit input is treated as NANP; 11 digits starting with 1 already has the code.
  if (digits.length === NANP_LOCAL_DIGITS) return `+1${digits}`;
  if (digits.length === NANP_LOCAL_DIGITS + 1 && digits.startsWith('1')) return `+${digits}`;
  return inRange ? `+${digits}` : undefined;
}
