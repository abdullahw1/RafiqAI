import 'server-only';
import { selectMarketRows } from '@/data/seed';
import { callJsonModel, STAGE_DEADLINE_MS, withDeadline } from './openai';
import { fenceUntrusted, UNTRUSTED_TEXT_NOTICE } from './prompt';
import type { Extraction, Finding } from './types';
import { parseJsonObject, validateFindings } from './validate';

const FINDING_SHAPE = `${UNTRUSTED_TEXT_NOTICE}
Return ONLY a JSON object:
{"findings":[{"severity":"warning"|"info","title":string,"evidence":string,"explanation":string,"potentialImpact":string|null,"action":string}]}
Rules:
- "evidence" MUST be copied verbatim from the BILL TEXT. Findings without verbatim evidence are discarded.
- Never claim a charge is fraudulent, illegal, guaranteed removable, or guaranteed refundable.
- Use cautious wording such as "worth questioning" and "potential impact".
- At most 3 findings. Be concise.`;

const ANOMALY_SYSTEM = `You detect unexpected changes on one mobile-phone bill.
Identify newly appearing charges, unexpected increases, and internally inconsistent amounts.
${FINDING_SHAPE}`;

const MARKET_SYSTEM = `You compare bill line items against a SYNTHETIC demonstration reference set.
The reference rows are invented demo data, not sourced market pricing. Say so in the explanation.
Report where a charge is unusual or ordinary relative to the reference rows.
${FINDING_SHAPE}`;

const PLAIN_SYSTEM = `You explain vague fee names on one mobile-phone bill in plain language for a
non-expert reader. Explain what the wording does and does not say.
Never state that a fee is illegal, improper, or guaranteed removable.
${FINDING_SHAPE}`;

function extractionSummary(extraction: Extraction): string {
  const items = extraction.lineItems
    .map((item) => `- ${item.label}: ${item.amount ?? 'unknown'} | evidence: ${item.evidence}`)
    .join('\n');

  return [
    `vendor: ${extraction.vendor ?? 'unknown'}`,
    `accountHolder: ${extraction.accountHolder ?? 'unknown'}`,
    `billingPeriod: ${extraction.billingPeriod ?? 'unknown'}`,
    `total: ${extraction.total ?? 'unknown'}`,
    `priorAmount: ${extraction.priorAmount ?? 'unknown'}`,
    `lineItems:\n${items}`,
  ].join('\n');
}

async function runCheck(options: {
  system: string;
  user: string;
  label: 'anomaly' | 'market' | 'plain';
  sourceText: string;
}): Promise<Finding[]> {
  const raw = await withDeadline(
    callJsonModel({ system: options.system, user: options.user }),
    STAGE_DEADLINE_MS,
    options.label,
  );

  const findings = validateFindings(parseJsonObject(raw), {
    source: options.label,
    sourceText: options.sourceText,
    idPrefix: `live-${options.label}`,
  });

  if (findings.length === 0) throw new Error(`${options.label}_no_grounded_findings`);
  return findings;
}

export function anomalyCheck(extraction: Extraction, sourceText: string): Promise<Finding[]> {
  return runCheck({
    system: ANOMALY_SYSTEM,
    label: 'anomaly',
    sourceText,
    user: `EXTRACTION:\n${extractionSummary(extraction)}\n\nBILL TEXT:\n${fenceUntrusted(sourceText)}`,
  });
}

export function marketCheck(extraction: Extraction, sourceText: string): Promise<Finding[]> {
  const rows = selectMarketRows(extraction.lineItems.map((item) => item.label));
  const referenceBlock =
    rows.length > 0
      ? rows
          .map((row) => `- ${row.label}: ${row.typicalRange}. ${row.note}`)
          .join('\n')
      : '- No relevant synthetic reference rows are available for these line items.';

  return runCheck({
    system: MARKET_SYSTEM,
    label: 'market',
    sourceText,
    user: `SYNTHETIC REFERENCE ROWS (demo data only):\n${referenceBlock}\n\nEXTRACTION:\n${extractionSummary(
      extraction,
    )}\n\nBILL TEXT:\n${fenceUntrusted(sourceText)}`,
  });
}

export function plainLanguageCheck(extraction: Extraction, sourceText: string): Promise<Finding[]> {
  return runCheck({
    system: PLAIN_SYSTEM,
    label: 'plain',
    sourceText,
    user: `EXTRACTION:\n${extractionSummary(extraction)}\n\nBILL TEXT:\n${fenceUntrusted(sourceText)}`,
  });
}
