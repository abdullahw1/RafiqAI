/**
 * Synthetic demonstration data only. These rows are invented for the hackathon
 * prototype and are NOT sourced market pricing (Requirement 8.4).
 */

export const SYNTHETIC: true = true;

export interface HistoryPoint {
  label: string;
  amount: number;
}

/** Requirement 4.1: seeded totals $58 → $67 → $82. */
export const SEEDED_HISTORY: readonly HistoryPoint[] = [
  { label: 'June', amount: 58 },
  { label: 'July', amount: 67 },
  { label: 'August', amount: 82 },
] as const;

export interface MarketReferenceRow {
  /** Lower-cased keywords used to select relevant rows for a line item. */
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
    note:
      'In this synthetic reference set, comparable unlimited talk-and-text plans list network costs inside the advertised base price rather than as a separate monthly surcharge.',
    typicalRange: '$0.00 - $3.00 per month when itemized at all',
    synthetic: true,
  },
  {
    match: ['device protection', 'protection plus', 'insurance', 'coverage'],
    label: 'Optional device protection / insurance add-on',
    note:
      'In this synthetic reference set, device protection is an optional opt-in add-on that the account holder must accept, and it can usually be removed at any time.',
    typicalRange: '$7.00 - $18.00 per month, optional',
    synthetic: true,
  },
  {
    match: ['base wireless', 'unlimited talk', 'base service'],
    label: 'Base unlimited talk & text service',
    note:
      'In this synthetic reference set, the base line price is consistent with comparable single-line unlimited talk-and-text plans.',
    typicalRange: '$50.00 - $65.00 per month',
    synthetic: true,
  },
];

/**
 * Selects only the reference rows relevant to the supplied line-item labels so the
 * market prompt stays small (design: inject only relevant synthetic rows).
 */
export function selectMarketRows(labels: readonly string[]): readonly MarketReferenceRow[] {
  const haystack = labels.join(' | ').toLowerCase();
  return SYNTHETIC_MARKET_REFERENCE.filter((row) =>
    row.match.some((keyword) => haystack.includes(keyword)),
  );
}
