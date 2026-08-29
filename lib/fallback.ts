import { isPreparedFixture } from '@/data/preparedBill';
import type { Extraction, Finding } from './types';

/**
 * Verified fallback content for the prepared fixture only (Requirements 7.1, 7.2).
 * Every string here was checked against the prepared bill text, so all evidence is
 * grounded and passes the same validator used for live model output.
 */

export function isSafeModeEnabled(): boolean {
  return process.env.DEMO_SAFE_MODE?.trim().toLowerCase() === 'true';
}

/**
 * Property 2 (fixture isolation): fallback is allowed only for the prepared document or
 * when safe mode is explicitly enabled by the operator.
 */
export function fallbackIsAllowed(text: string): boolean {
  return isPreparedFixture(text) || isSafeModeEnabled();
}

export const FALLBACK_EXTRACTION: Extraction = {
  vendor: 'Northstar Mobile',
  accountHolder: 'Sarah Rahman',
  billingPeriod: 'August 1 - August 31, 2025',
  total: 82,
  priorAmount: 67,
  lineItems: [
    {
      label: 'Base Wireless Service - Unlimited Talk & Text',
      amount: 58,
      evidence: 'Base Wireless Service - Unlimited Talk & Text            $58.00',
    },
    {
      label: 'Premium Network Access Fee',
      amount: 9,
      evidence: 'Premium Network Access Fee                                $9.00',
    },
    {
      label: 'Device Protection Plus',
      amount: 15,
      evidence: 'Device Protection Plus (Enrolled Jul 28)                 $15.00',
    },
  ],
};

export const FALLBACK_ANOMALY_FINDINGS: readonly Finding[] = [
  {
    id: 'fallback-anomaly-0',
    severity: 'warning',
    title: 'A new $9.00 Premium Network Access Fee appears on this statement',
    evidence: 'Premium Network Access Fee                                $9.00',
    explanation:
      'This line is separate from the base wireless service and was not part of the original $58.00 plan price. A newly appearing surcharge with a general name is worth asking about.',
    potentialImpact: 'Up to $9.00 per month if the carrier confirms it can be removed.',
    action:
      'Ask the carrier what this fee covers and whether the plan can be billed without it. Request the answer in writing.',
    source: 'anomaly',
  },
  {
    id: 'fallback-anomaly-1',
    severity: 'warning',
    title: 'Device Protection Plus was enrolled recently and adds $15.00 per month',
    evidence: 'Device Protection Plus (Enrolled Jul 28)                 $15.00',
    explanation:
      'The statement shows an enrollment date of July 28, so this charge is new. It is worth confirming that the enrollment was intentional.',
    potentialImpact: 'Up to $15.00 per month if the add-on is optional and Sarah chooses to cancel it.',
    action:
      'Confirm with the account holder whether she agreed to this enrollment, then ask the carrier whether it is optional.',
    source: 'anomaly',
  },
];

export const FALLBACK_MARKET_FINDINGS: readonly Finding[] = [
  {
    id: 'fallback-market-0',
    severity: 'info',
    title: 'Synthetic reference data lists network costs inside the base price, not as a surcharge',
    evidence: 'Premium Network Access Fee                                $9.00',
    explanation:
      'In RafiqAI\'s synthetic demonstration reference set, comparable unlimited talk-and-text plans include network costs in the advertised base price rather than as a separate monthly surcharge of $0.00-$3.00. This is illustrative demo data, not sourced market pricing.',
    potentialImpact: 'Suggests the $9.00 fee is worth challenging; it does not prove overcharging.',
    action: 'Ask the carrier to show where this fee is disclosed in the plan terms.',
    source: 'market',
  },
  {
    id: 'fallback-market-1',
    severity: 'info',
    title: 'Device protection is normally an opt-in add-on in the synthetic reference set',
    evidence: 'Device Protection Plus (Enrolled Jul 28)                 $15.00',
    explanation:
      'The synthetic reference set prices optional device protection at $7.00-$18.00 per month and treats it as an add-on the account holder must accept and can usually remove. $15.00 sits inside that illustrative range.',
    potentialImpact: 'The amount looks ordinary; the question is whether it was requested.',
    action: 'Ask whether the add-on is optional and how to remove it if it was not requested.',
    source: 'market',
  },
];

export const FALLBACK_PLAIN_FINDINGS: readonly Finding[] = [
  {
    id: 'fallback-plain-0',
    severity: 'info',
    title: 'What "Premium Network Access Fee" actually means',
    evidence: 'Premium Network Access Fee supports continued network quality initiatives.',
    explanation:
      'The statement describes this fee only as supporting "network quality initiatives," which does not say what Sarah receives for it. Carrier-added fees like this are usually set by the carrier rather than required by a government body. That does not automatically make the fee improper or removable — it makes it something worth questioning.',
    potentialImpact: null,
    action: 'Ask the carrier for a plain explanation of the fee and whether it is mandatory on this plan.',
    source: 'plain',
  },
  {
    id: 'fallback-plain-1',
    severity: 'info',
    title: 'Device protection coverage has conditions',
    evidence:
      'Device Protection Plus provides coverage for accidental damage, subject to',
    explanation:
      'Coverage is "subject to deductible and terms," which means a claim can still cost money out of pocket. Whether this is good value depends on the deductible and the phone\'s replacement cost.',
    potentialImpact: null,
    action: 'Ask what the deductible is before deciding whether to keep the coverage.',
    source: 'plain',
  },
];
