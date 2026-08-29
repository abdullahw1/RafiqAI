import { formatUsd, type TrendAnalysis } from './billMath';
import type { AnalysisMode, Finding, FindingSource } from './types';

const SEVERITY_RANK: Record<Finding['severity'], number> = { warning: 0, info: 1 };
const SOURCE_RANK: Record<FindingSource, number> = { trend: 0, anomaly: 1, market: 2, plain: 3 };
const MAX_MERGED_FINDINGS = 8;

function dedupeKey(finding: Finding): string {
  return `${finding.source}::${finding.evidence.replace(/\s+/gu, ' ').trim().toLowerCase()}`;
}

/**
 * Requirement 4.5: findings are merged and sorted locally, with no synthesis model call.
 * Sort order is severity first, then source (deterministic trend finding leads).
 */
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
      const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return SOURCE_RANK[a.source] - SOURCE_RANK[b.source];
    })
    .slice(0, MAX_MERGED_FINDINGS);
}

export interface BriefingInput {
  accountHolderFirstName: string;
  vendor: string | null;
  analysis: TrendAnalysis;
  findings: readonly Finding[];
  mode: AnalysisMode;
}

/**
 * Requirement 4.7: the English voice briefing is generated locally from normalized
 * findings. Wording stays conditional (Requirement 8.5 / 8.6).
 */
export function buildBriefing(input: BriefingInput): string {
  const { accountHolderFirstName, vendor, analysis, findings } = input;
  const vendorName = vendor ?? 'your mobile carrier';
  const charges = analysis.questionedCharges;

  const chargeSentence =
    charges.length > 0
      ? `Two charges stand out: ${charges
          .map((charge) => `${charge.label} at ${formatUsd(charge.amount)} a month`)
          .join(', and ')}.`
      : 'No individual added charges were identified on this statement.';

  const topFindings = findings
    .slice(0, 3)
    .map((finding, index) => `${index + 1}. ${finding.title}. ${finding.explanation}`)
    .join(' ');

  const modeNote =
    input.mode === 'fallback'
      ? ' This summary comes from RafiqAI\'s verified demonstration data rather than a live analysis.'
      : '';

  return [
    `Hello ${accountHolderFirstName}, this is RafiqAI calling about your ${vendorName} bill.`,
    `Your monthly total went from ${formatUsd(analysis.trend[0]?.amount ?? 0)} to ${formatUsd(
      analysis.trend[analysis.trend.length - 1]?.amount ?? 0,
    )}, an increase of about ${analysis.increasePercent} percent.`,
    chargeSentence,
    `Together they add up to ${formatUsd(analysis.potentialMonthlyImpact)} a month, or up to ${formatUsd(
      analysis.potentialAnnualImpact,
    )} a year.`,
    'These are charges worth questioning. They are not confirmed errors, and removing them is not guaranteed.',
    topFindings,
    `The safest next step is to call ${vendorName} using the number printed on your statement, ask what each charge is for, and ask whether the device protection add-on is optional.`,
    'I can answer questions about anything on this bill.',
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

/**
 * Requirement 7.7 / design: `live` only when every stage succeeded, `fallback` when
 * verified fixture output was used, otherwise `partial`.
 */
export function resolveMode(options: {
  usedFallback: boolean;
  failedStages: number;
}): AnalysisMode {
  if (options.usedFallback) return 'fallback';
  return options.failedStages > 0 ? 'partial' : 'live';
}
