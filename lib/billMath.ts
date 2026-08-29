import { PHONE_CARRIER_COMPARISON_SEEDS } from '@/data/seed';
import type {
  BillType,
  CarrierComparison,
  Extraction,
  Finding,
  TrendDirection,
  TrendPoint,
} from './types';

export interface TrendAnalysis {
  trend: TrendPoint[];
  baselineAverage: number | null;
  baselinePointCount: number;
  currentVsAverageAmount: number | null;
  currentVsAveragePercent: number | null;
  trendDirection: TrendDirection;
  increasePercent: number;
  potentialMonthlyImpact: number;
  potentialAnnualImpact: number;
  questionedCharges: TrendPoint[];
}

export interface TrendPresentation {
  title: string;
  comparison: string;
  isSignificantIncrease: boolean;
}

const MONTHS_PER_YEAR = 12;
const MAX_BASELINE_POINTS = 5;
export const SIGNIFICANT_INCREASE_PERCENT = 10;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function percentIncrease(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return 0;
  return Math.round(((to - from) / from) * 100);
}

/** Uses only history extracted from the submitted document; no global history is injected. */
export function buildTrend(extraction: Extraction): TrendPoint[] {
  const history = extraction.history
    .filter((point) => Number.isFinite(point.amount))
    .map((point) => ({ label: point.label, amount: round2(point.amount) }));
  if (history.length > 0) return history;
  return extraction.total !== null && Number.isFinite(extraction.total)
    ? [{ label: 'Current', amount: round2(extraction.total) }]
    : [];
}

export function selectQuestionedCharges(
  extraction: Extraction,
  billType: BillType,
  isPreparedDemo = false,
): TrendPoint[] {
  if (billType !== 'phone' || !isPreparedDemo) return [];
  return extraction.lineItems
    .filter((item) => item.amount !== null && Number.isFinite(item.amount) && item.amount > 0)
    .filter((item) => !/base|unlimited talk/iu.test(item.label))
    .map((item) => ({ label: item.label, amount: round2(item.amount as number) }));
}

function directionFor(amount: number | null): TrendDirection {
  if (amount === null) return 'unknown';
  if (amount > 0) return 'increase';
  if (amount < 0) return 'decrease';
  return 'flat';
}

export function calculateTrendAndImpact(
  extraction: Extraction,
  billType: BillType,
  isPreparedDemo = false,
): TrendAnalysis {
  const trend = buildTrend(extraction);
  const current = trend.at(-1)?.amount ?? null;
  const baseline = trend.slice(-(MAX_BASELINE_POINTS + 1), -1).map((point) => point.amount);
  const baselineAverage = baseline.length > 0
    ? round2(baseline.reduce((sum, amount) => sum + amount, 0) / baseline.length)
    : null;
  const currentVsAverageAmount = current !== null && baselineAverage !== null
    ? round2(current - baselineAverage)
    : null;
  const currentVsAveragePercent =
    current !== null && baselineAverage !== null && baselineAverage > 0
      ? percentIncrease(baselineAverage, current)
      : null;
  const questionedCharges = selectQuestionedCharges(extraction, billType, isPreparedDemo);
  const potentialMonthlyImpact = round2(
    questionedCharges.reduce((sum, charge) => sum + charge.amount, 0),
  );

  return {
    trend,
    baselineAverage,
    baselinePointCount: baseline.length,
    currentVsAverageAmount,
    currentVsAveragePercent,
    trendDirection: directionFor(currentVsAverageAmount),
    increasePercent: currentVsAveragePercent ?? 0,
    potentialMonthlyImpact,
    potentialAnnualImpact: round2(potentialMonthlyImpact * MONTHS_PER_YEAR),
    questionedCharges,
  };
}

export function buildCarrierComparisons(
  billType: BillType,
  currentTotal: number | null,
  isPreparedDemo = false,
): CarrierComparison[] {
  if (billType !== 'phone' || !isPreparedDemo) return [];
  return PHONE_CARRIER_COMPARISON_SEEDS.map((row) => ({
    ...row,
    potentialMonthlySavings:
      currentTotal !== null && Number.isFinite(currentTotal)
        ? round2(Math.max(0, currentTotal - row.monthlyPrice))
        : 0,
  }));
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'] as const;

export function baselineLabel(pointCount: number): string {
  const count = COUNT_WORDS[pointCount] ?? String(pointCount);
  return `previous ${count}-month average`;
}

export function presentTrend(analysis: TrendAnalysis): TrendPresentation {
  const label = baselineLabel(analysis.baselinePointCount);
  const percent = analysis.currentVsAveragePercent === null
    ? null
    : Math.abs(analysis.currentVsAveragePercent);
  const amount = Math.abs(analysis.currentVsAverageAmount ?? 0);

  if (analysis.trendDirection === 'increase') {
    return {
      title: percent === null
        ? `Current total is above the ${label}`
        : `Current total is about ${percent}% above the ${label}`,
      comparison: `the current total is ${formatUsd(amount)} higher`,
      isSignificantIncrease: percent !== null && percent >= SIGNIFICANT_INCREASE_PERCENT,
    };
  }
  if (analysis.trendDirection === 'decrease') {
    return {
      title: percent === null
        ? `Current total is below the ${label}`
        : `Current total is about ${percent}% below the ${label}`,
      comparison: `the current total is ${formatUsd(amount)} lower`,
      isSignificantIncrease: false,
    };
  }
  if (analysis.trendDirection === 'flat') {
    return {
      title: `Current total matches the ${label}`,
      comparison: 'the current total matches that average',
      isSignificantIncrease: false,
    };
  }
  return {
    title: 'The current total is shown without enough prior points for a comparison',
    comparison: 'there is not enough prior history for a comparison',
    isSignificantIncrease: false,
  };
}

export function buildTrendFinding(analysis: TrendAnalysis, evidence: string): Finding {
  const history = analysis.trend.map((point) => `${point.label} ${formatUsd(point.amount)}`).join(', ');
  const presentation = presentTrend(analysis);
  return {
    id: 'trend-total-change',
    severity: presentation.isSignificantIncrease ? 'warning' : 'info',
    title: presentation.title,
    evidence,
    explanation: `The document's history shows ${history}. The ${baselineLabel(
      analysis.baselinePointCount,
    )} is ${formatUsd(analysis.baselineAverage ?? 0)}; ${presentation.comparison}.`,
    potentialImpact:
      analysis.potentialMonthlyImpact > 0
        ? `Up to ${formatUsd(analysis.potentialMonthlyImpact)} per month, or up to ${formatUsd(
            analysis.potentialAnnualImpact,
          )} per year, only if the questioned charges are removable. This is not a guaranteed saving or refund.`
        : null,
    action: 'Ask the provider to explain the change using the official contact details on the statement.',
    source: 'trend',
  };
}
