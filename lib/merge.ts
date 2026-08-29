import { baselineLabel, formatUsd, presentTrend, type TrendAnalysis } from './billMath';
import type {
  AnalysisMode,
  BillType,
  CarrierComparison,
  Finding,
  FindingSource,
} from './types';

const SEVERITY_RANK: Record<Finding['severity'], number> = { warning: 0, info: 1 };
const SOURCE_RANK: Record<FindingSource, number> = { trend: 0, anomaly: 1, market: 2, plain: 3 };
const MAX_MERGED_FINDINGS = 8;

function dedupeKey(finding: Finding): string {
  return `${finding.source}::${finding.evidence.replace(/\s+/gu, ' ').trim().toLowerCase()}`;
}

export function mergeFindings(groups: readonly Finding[][]): Finding[] {
  const seen = new Set<string>();
  const merged: Finding[] = [];
  for (const group of groups) {
    for (const finding of group) {
      const key = dedupeKey(finding);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(finding);
    }
  }
  return [...merged]
    .sort((a, b) => {
      const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      return severity !== 0 ? severity : SOURCE_RANK[a.source] - SOURCE_RANK[b.source];
    })
    .slice(0, MAX_MERGED_FINDINGS);
}

export interface BriefingInput {
  accountHolderFirstName: string;
  vendor: string | null;
  analysis: TrendAnalysis;
  mode: AnalysisMode;
  billType: BillType;
  comparisons: readonly CarrierComparison[];
  isPreparedDemo?: boolean;
}

function historySentence(analysis: TrendAnalysis): string {
  if (analysis.baselinePointCount === 0) {
    return 'The document does not provide enough monthly history to calculate a baseline.';
  }
  const presentation = presentTrend(analysis);
  const direction = analysis.trendDirection === 'flat'
    ? presentation.comparison
    : analysis.currentVsAveragePercent === null
      ? presentation.comparison
      : `${presentation.comparison}, about ${Math.abs(
          analysis.currentVsAveragePercent,
        )} percent ${analysis.trendDirection === 'decrease' ? 'below' : 'above'}`;
  return `The document's ${analysis.trend.length}-month history is ${analysis.trend
    .map((point) => `${point.label} ${formatUsd(point.amount)}`)
    .join(', ')}. The ${baselineLabel(analysis.baselinePointCount)} is ${formatUsd(
      analysis.baselineAverage ?? 0,
    )}, and ${direction}.`;
}

export function buildBriefing(input: BriefingInput): string {
  const { accountHolderFirstName, analysis, billType, comparisons } = input;
  const isPreparedDemo = input.isPreparedDemo === true;
  const provider = input.vendor ?? (billType === 'phone' ? 'your carrier' : 'your provider');
  const chargeSentence = isPreparedDemo && billType === 'phone' && analysis.potentialMonthlyImpact > 0
    ? `The prepared demo has charges worth questioning with a potential impact of up to ${formatUsd(
        analysis.potentialMonthlyImpact,
      )} monthly or ${formatUsd(analysis.potentialAnnualImpact)} yearly if removable.`
    : 'No potential-savings estimate is calculated for this bill.';
  const comparisonSentence = isPreparedDemo && billType === 'phone' && comparisons.length > 0
    ? `For cautious context only, invented demo comparisons are ${comparisons
        .map(
          (row) =>
            `${row.carrier} at ${formatUsd(row.monthlyPrice)}, a potential monthly difference of ${formatUsd(row.potentialMonthlySavings)}`,
        )
        .join(', ')}. These are synthetic examples, not live quotes or guaranteed savings, and features, taxes, eligibility, and actual prices may differ.`
    : '';
  const modeNote = input.mode === 'fallback'
    ? "This summary uses RafiqAI's verified prepared-fixture data rather than live model output."
    : '';

  return [
    `Hello ${accountHolderFirstName}, this is RafiqAI calling about your ${provider} bill.`,
    historySentence(analysis),
    chargeSentence,
    comparisonSentence,
    'These observations are worth checking, not confirmed errors, and any removal, refund, or savings is not guaranteed.',
    `Use the official contact details on the statement to ask ${provider} for a written explanation.`,
    'I can answer questions about the information shown on this bill.',
    modeNote,
  ]
    .filter((part) => part.trim().length > 0)
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function firstName(accountHolder: string | null): string {
  const name = accountHolder?.trim().split(/\s+/u)[0];
  return name && name.length > 0 ? name : 'there';
}

export function resolveMode(options: { usedFallback: boolean; failedStages: number }): AnalysisMode {
  if (options.usedFallback) return 'fallback';
  return options.failedStages > 0 ? 'partial' : 'live';
}
