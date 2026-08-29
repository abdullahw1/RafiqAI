import type { CarrierComparison, HistoryPoint } from '@/lib/types';

type CarrierComparisonSeed = Omit<CarrierComparison, 'potentialMonthlySavings'>;

/** Synthetic demonstration data only; none of these values are sourced market pricing. */
export const SYNTHETIC: true = true;

export const PREPARED_PHONE_HISTORY: readonly HistoryPoint[] = [
  { label: 'March', amount: 57, evidence: 'March 2025 total                                           $57.00' },
  { label: 'April', amount: 58, evidence: 'April 2025 total                                           $58.00' },
  { label: 'May', amount: 58, evidence: 'May 2025 total                                             $58.00' },
  { label: 'June', amount: 58, evidence: 'June 2025 total                                            $58.00' },
  { label: 'July', amount: 67, evidence: 'July 2025 total                                            $67.00' },
  { label: 'August', amount: 82, evidence: 'August 2025 total                                          $82.00' },
] as const;

export const PHONE_CARRIER_COMPARISON_SEEDS: readonly CarrierComparisonSeed[] = [
  {
    carrier: 'AT&T',
    planName: 'Synthetic single-line comparison',
    monthlyPrice: 58,
    note: 'Invented demo estimate; taxes, fees, discounts, eligibility, and features may differ.',
    synthetic: true,
  },
  {
    carrier: 'Verizon',
    planName: 'Synthetic single-line comparison',
    monthlyPrice: 60,
    note: 'Invented demo estimate; taxes, fees, discounts, eligibility, and features may differ.',
    synthetic: true,
  },
  {
    carrier: 'T-Mobile',
    planName: 'Synthetic single-line comparison',
    monthlyPrice: 55,
    note: 'Invented demo estimate; taxes, fees, discounts, eligibility, and features may differ.',
    synthetic: true,
  },
] as const;

export interface MarketReferenceRow {
  match: readonly string[];
  label: string;
  note: string;
  typicalRange: string;
  synthetic: true;
}
export const SYNTHETIC_MARKET_REFERENCE: readonly MarketReferenceRow[] = [
  {
    match: ['premium network access', 'network access', 'access fee'],
    label: 'Carrier-added network access surcharge',
    note: 'Synthetic comparison plans include network costs in the base price.',
    typicalRange: '$0.00 - $3.00 per month when itemized at all',
    synthetic: true,
  },
  {
    match: ['device protection', 'protection plus'],
    label: 'Optional device protection add-on',
    note: 'Synthetic protection is an optional add-on that may be removable.',
    typicalRange: '$7.00 - $18.00 per month, optional',
    synthetic: true,
  },
  {
    match: ['base wireless', 'unlimited talk', 'base service'],
    label: 'Base unlimited talk & text service',
    note: 'Synthetic single-line unlimited service comparison.',
    typicalRange: '$50.00 - $65.00 per month',
    synthetic: true,
  },
];

export function selectMarketRows(labels: readonly string[]): readonly MarketReferenceRow[] {
  const haystack = labels.join(' | ').toLowerCase();
  return SYNTHETIC_MARKET_REFERENCE.filter((row) =>
    row.match.some((keyword) => haystack.includes(keyword)),
  );
}
