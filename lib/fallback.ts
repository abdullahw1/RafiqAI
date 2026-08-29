import { isPreparedFixture } from '@/data/preparedBill';
import { PREPARED_PHONE_HISTORY } from '@/data/seed';
import type { BillType, Extraction, Finding } from './types';

export function isSafeModeEnabled(): boolean {
  return process.env.DEMO_SAFE_MODE?.trim().toLowerCase() === 'true';
}

/** Prepared phone fallback is never available to another bill type. */
export function fallbackIsAllowed(text: string, billType: BillType): boolean {
  return billType === 'phone' && isPreparedFixture(text);
}

export const FALLBACK_EXTRACTION: Extraction = {
  vendor: 'AT&T',
  accountHolder: 'Sarah Rahman',
  billingPeriod: 'August 1 - August 31, 2025',
  total: 82,
  priorAmount: 67,
  history: PREPARED_PHONE_HISTORY.map((point) => ({ ...point })),
  lineItems: [
    {
      label: 'Base Wireless Service - Unlimited Talk & Text',
      amount: 58,
      evidence: 'Base Wireless Service - Unlimited Talk & Text              $58.00',
    },
    {
      label: 'Premium Network Access Fee',
      amount: 9,
      evidence: 'Premium Network Access Fee                                  $9.00',
    },
    {
      label: 'Device Protection Plus',
      amount: 15,
      evidence: 'Device Protection Plus (Enrolled Jul 28)                   $15.00',
    },
  ],
};

export const FALLBACK_ANOMALY_FINDINGS: readonly Finding[] = [
  {
    id: 'fallback-anomaly-0',
    severity: 'warning',
    title: 'A separate $9.00 network access fee appears on this statement',
    evidence: 'Premium Network Access Fee                                  $9.00',
    explanation: 'This line is separate from base service and is worth asking AT&T to explain.',
    potentialImpact: 'Up to $9.00 per month if AT&T confirms it can be removed.',
    action: 'Ask AT&T what the fee covers and whether it is mandatory for this plan.',
    source: 'anomaly',
  },
  {
    id: 'fallback-anomaly-1',
    severity: 'warning',
    title: 'Device Protection Plus adds $15.00 per month',
    evidence: 'Device Protection Plus (Enrolled Jul 28)                   $15.00',
    explanation: 'The statement shows a July 28 enrollment date, so confirming consent is worthwhile.',
    potentialImpact: 'Up to $15.00 per month if the add-on is optional and is cancelled.',
    action: 'Confirm the enrollment was intentional, then ask whether the add-on is optional.',
    source: 'anomaly',
  },
];
export const FALLBACK_MARKET_FINDINGS: readonly Finding[] = [
  {
    id: 'fallback-market-0',
    severity: 'info',
    title: 'Synthetic phone comparisons make the network fee worth asking about',
    evidence: 'Premium Network Access Fee                                  $9.00',
    explanation: 'RafiqAI synthetic demo comparisons include network costs in base prices. They are invented examples, not sourced market pricing or proof of overcharging.',
    potentialImpact: 'The fee may be worth questioning; removal is not guaranteed.',
    action: 'Ask AT&T to identify where this fee is disclosed in the plan terms.',
    source: 'market',
  },
  {
    id: 'fallback-market-1',
    severity: 'info',
    title: 'Synthetic comparisons treat device protection as optional',
    evidence: 'Device Protection Plus (Enrolled Jul 28)                   $15.00',
    explanation: 'The invented phone-only comparison data treats protection as an optional add-on. Actual eligibility, coverage, and cancellation terms may differ.',
    potentialImpact: 'The relevant question is whether the coverage was requested and can be removed.',
    action: 'Ask for the coverage terms, deductible, and cancellation process.',
    source: 'market',
  },
];

export const FALLBACK_PLAIN_FINDINGS: readonly Finding[] = [
  {
    id: 'fallback-plain-0',
    severity: 'info',
    title: 'The network fee description is vague',
    evidence: 'Premium Network Access Fee supports continued network quality initiatives.',
    explanation: 'The statement says the fee supports network quality but does not specify a customer benefit. That does not prove the fee is improper or removable.',
    potentialImpact: null,
    action: 'Ask AT&T for a plain explanation and whether the fee is mandatory.',
    source: 'plain',
  },
  {
    id: 'fallback-plain-1',
    severity: 'info',
    title: 'Device protection coverage has conditions',
    evidence: 'Device Protection Plus provides coverage for accidental damage, subject to',
    explanation: 'The coverage is subject to a deductible and terms, so a claim may still have out-of-pocket costs.',
    potentialImpact: null,
    action: 'Ask for the deductible and full terms before deciding whether to keep it.',
    source: 'plain',
  },
];
