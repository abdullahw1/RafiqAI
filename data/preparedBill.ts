/**
 * The prepared demo phone bill. Requirement 1.3: $58 base service, $9 Premium Network
 * Access Fee, $15 device protection, $82 total.
 *
 * This file is imported by both server and client code, so it must never contain
 * credentials or phone numbers.
 */
export const PREPARED_BILL_TEXT = `NORTHSTAR MOBILE
Monthly Statement

Account Holder: Sarah Rahman
Account Number: ****4417
Billing Period: August 1 - August 31, 2025
Statement Date: September 2, 2025

CHARGES
Base Wireless Service - Unlimited Talk & Text            $58.00
Premium Network Access Fee                                $9.00
Device Protection Plus (Enrolled Jul 28)                 $15.00

Previous Balance (July statement)                        $67.00

TOTAL AMOUNT DUE                                         $82.00
Due Date: September 20, 2025

Questions about your bill? Call the number on the back of your statement.
Premium Network Access Fee supports continued network quality initiatives.
Device Protection Plus provides coverage for accidental damage, subject to
deductible and terms. See your plan agreement for details.
`;

/**
 * Normalizes submitted text so fixture matching survives whitespace and case
 * differences from copy/paste. Requirement 7.2 / Property 2 (fixture isolation).
 */
export function normalizeForFixtureMatch(text: string): string {
  return text.replace(/\s+/gu, ' ').trim().toLowerCase();
}

const PREPARED_FINGERPRINT = normalizeForFixtureMatch(PREPARED_BILL_TEXT);

/**
 * True only for the prepared demo document. Arbitrary user text must never match,
 * otherwise it could receive fixture findings (Requirement 7.5).
 */
export function isPreparedFixture(text: string): boolean {
  return normalizeForFixtureMatch(text) === PREPARED_FINGERPRINT;
}
