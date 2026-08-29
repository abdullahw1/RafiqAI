import { SEEDED_HISTORY, type HistoryPoint } from '@/data/seed';
import type { Extraction, Finding, TrendPoint } from './types';

export interface TrendAnalysis {
  trend: TrendPoint[];
  /** Rounded whole-percent increase from the earliest to the latest total. */
  increasePercent: number;
  potentialMonthlyImpact: number;
  potentialAnnualImpact: number;
  /** Charges considered questionable: new or newly added items. */
  questionedCharges: TrendPoint[];
}

const MONTHS_PER_YEAR = 12;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Requirement 4.2: $58 → $82 reports as approximately 41%.
 * (82 - 58) / 58 = 0.41379… → 41.
 */
export function percentIncrease(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return 0;
  return Math.round(((to - from) / from) * 100);
}

/**
 * Builds the displayed trend from seeded history, replacing the latest point with the
 * extracted total when the extraction supplies one.
 */
export function buildTrend(extraction: Extraction): TrendPoint[] {
  const seeded: HistoryPoint[] = SEEDED_HISTORY.map((point) => ({ ...point }));
  const total = extraction.total;
  if (total === null || !Number.isFinite(total) || seeded.length === 0) return seeded;
  return seeded.map((point, index) =>
    index === seeded.length - 1 ? { label: point.label, amount: round2(total) } : point,
  );
}

/**
 * Line items that are not the base service are treated as charges worth questioning.
 * Requirement 4.3: $9 + $15 = $24/month, $288/year.
 */
export function selectQuestionedCharges(extraction: Extraction): TrendPoint[] {
  return extraction.lineItems
    .filter((item) => item.amount !== null && Number.isFinite(item.amount) && item.amount > 0)
    .filter((item) => !/base|unlimited talk/iu.test(item.label))
    .map((item) => ({ label: item.label, amount: round2(item.amount as number) }));
}

export function calculateTrendAndImpact(extraction: Extraction): TrendAnalysis {
  const trend = buildTrend(extraction);
  const first = trend[0]?.amount ?? 0;
  const last = trend[trend.length - 1]?.amount ?? 0;
  const questionedCharges = selectQuestionedCharges(extraction);
  const potentialMonthlyImpact = round2(
    questionedCharges.reduce((sum, charge) => sum + charge.amount, 0),
  );

  return {
    trend,
    increasePercent: percentIncrease(first, last),
    potentialMonthlyImpact,
    potentialAnnualImpact: round2(potentialMonthlyImpact * MONTHS_PER_YEAR),
    questionedCharges,
  };
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * The deterministic trend finding. Worded as potential impact only (Requirement 4.4).
 */
export function buildTrendFinding(analysis: TrendAnalysis, evidence: string): Finding {
  const first = analysis.trend[0];
  const last = analysis.trend[analysis.trend.length - 1];
  const chargeList = analysis.questionedCharges
    .map((charge) => `${charge.label} (${formatUsd(charge.amount)})`)
    .join(' and ');

  return {
    id: 'trend-total-increase',
    severity: 'warning',
    title: `Monthly total rose about ${analysis.increasePercent}% since ${first?.label ?? 'the first month'}`,
    evidence,
    explanation:
      `Seeded account history shows ${analysis.trend
        .map((point) => `${point.label} ${formatUsd(point.amount)}`)
        .join(', ')}. The increase from ${formatUsd(first?.amount ?? 0)} to ${formatUsd(
        last?.amount ?? 0,
      )} lines up with ${chargeList || 'the added charges'}, which are worth questioning.`,
    potentialImpact:
      `Up to ${formatUsd(analysis.potentialMonthlyImpact)} per month, or up to ${formatUsd(
        analysis.potentialAnnualImpact,
      )} per year — only if both charges turn out to be removable. This is not a guaranteed saving or refund.`,
    action:
      'Ask the carrier to explain each added charge and confirm in writing whether it is optional, using the number printed on the statement or the official app.',
    source: 'trend',
  };
}
