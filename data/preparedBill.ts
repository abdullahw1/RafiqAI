/** Prepared AT&T fixture. It contains all history used by fallback analysis. */
export const PREPARED_BILL_TEXT = `AT&T
Monthly Wireless Statement

Account Holder: Sarah Rahman
Account Number: ****4417
Billing Period: August 1 - August 31, 2025
Statement Date: September 2, 2025

SIX-MONTH BILL HISTORY
March 2025 total                                           $57.00
April 2025 total                                           $58.00
May 2025 total                                             $58.00
June 2025 total                                            $58.00
July 2025 total                                            $67.00
August 2025 total                                          $82.00

CHARGES
Base Wireless Service - Unlimited Talk & Text              $58.00
Premium Network Access Fee                                  $9.00
Device Protection Plus (Enrolled Jul 28)                   $15.00

Previous Balance (July statement)                          $67.00

TOTAL AMOUNT DUE                                           $82.00
Due Date: September 20, 2025

Questions about your bill? Call the number on the back of your statement.
Premium Network Access Fee supports continued network quality initiatives.
Device Protection Plus provides coverage for accidental damage, subject to
deductible and terms. See your plan agreement for details.
`;

/** Exact fixture matching prevents edited, pasted, or uploaded bills receiving demo data. */
export function isPreparedFixture(text: string): boolean {
  return text === PREPARED_BILL_TEXT;
}
