import 'server-only';
import { selectMarketRows } from '@/data/seed';
import { callJsonModel, STAGE_DEADLINE_MS, withDeadline } from './openai';
import { fenceUntrusted, UNTRUSTED_TEXT_NOTICE } from './prompt';
import type { BillType, Extraction, Finding } from './types';
import { parseJsonObject, validateFindings } from './validate';

const TYPE_TERMS: Record<BillType, string> = {
  phone: 'Use phone-bill terminology such as carrier, plan, and add-on only when supported.',
  insurance: 'Use insurance terminology; do not discuss phone carriers, phone plans, or switching savings.',
  medical: 'Use medical-billing terminology; do not discuss phone carriers, phone plans, or switching savings.',
  other: 'Use neutral provider terminology; do not assume this is a phone bill.',
};

const FINDING_SHAPE = `${UNTRUSTED_TEXT_NOTICE}
Return ONLY this JSON object: {"findings":[{"severity":"warning"|"info","title":string,"evidence":string,"explanation":string,"potentialImpact":string|null,"action":string}]}.
Evidence MUST be copied verbatim from BILL TEXT. Never claim fraud, illegality, guaranteed removal, refund, or savings. At most 3 concise findings.`;

function systemFor(check: 'anomaly' | 'market' | 'plain', billType: BillType): string {
  const purpose = check === 'anomaly'
    ? 'Detect unexpected changes and internally inconsistent amounts.'
    : check === 'market'
      ? billType === 'phone'
        ? 'Compare phone line items only with the supplied SYNTHETIC demo references and label them invented.'
        : 'Identify questions to ask about line items without market benchmarks; no phone comparisons are supplied or allowed.'
      : 'Explain vague labels in plain language without adding unsupported conclusions.';
  return `You review one declared ${billType} bill. ${TYPE_TERMS[billType]} ${purpose}\n${FINDING_SHAPE}`;
}

function extractionSummary(extraction: Extraction): string {
  const items = extraction.lineItems
    .map((item) => `- ${item.label}: ${item.amount ?? 'unknown'} | evidence: ${item.evidence}`)
    .join('\n');
  const history = extraction.history
    .map((point) => `- ${point.label}: ${point.amount} | evidence: ${point.evidence}`)
    .join('\n');
  return `vendor: ${extraction.vendor ?? 'unknown'}\naccountHolder: ${extraction.accountHolder ?? 'unknown'}\nbillingPeriod: ${extraction.billingPeriod ?? 'unknown'}\ntotal: ${extraction.total ?? 'unknown'}\npriorAmount: ${extraction.priorAmount ?? 'unknown'}\nlineItems:\n${items}\nhistory:\n${history || 'none printed'}`;
}
async function runCheck(options: {
  check: 'anomaly' | 'market' | 'plain';
  billType: BillType;
  user: string;
  sourceText: string;
}): Promise<Finding[]> {
  const raw = await withDeadline(
    callJsonModel({ system: systemFor(options.check, options.billType), user: options.user }),
    STAGE_DEADLINE_MS,
    options.check,
  );
  const findings = validateFindings(parseJsonObject(raw), {
    source: options.check,
    sourceText: options.sourceText,
    idPrefix: `live-${options.check}`,
  });
  if (findings.length === 0) throw new Error(`${options.check}_no_grounded_findings`);
  return findings;
}

function billUser(extraction: Extraction, sourceText: string, billType: BillType): string {
  return `DECLARED BILL TYPE: ${billType}\nEXTRACTION:\n${extractionSummary(extraction)}\n\nBILL TEXT:\n${fenceUntrusted(sourceText)}`;
}

export function anomalyCheck(
  extraction: Extraction,
  sourceText: string,
  billType: BillType,
): Promise<Finding[]> {
  return runCheck({
    check: 'anomaly',
    billType,
    sourceText,
    user: billUser(extraction, sourceText, billType),
  });
}

export function marketCheck(
  extraction: Extraction,
  sourceText: string,
  billType: BillType,
): Promise<Finding[]> {
  const rows = billType === 'phone'
    ? selectMarketRows(extraction.lineItems.map((item) => item.label))
    : [];
  const referenceBlock = rows.length > 0
    ? rows.map((row) => `- ${row.label}: ${row.typicalRange}. ${row.note}`).join('\n')
    : '- No synthetic comparison rows are supplied for this bill type.';
  return runCheck({
    check: 'market',
    billType,
    sourceText,
    user: `SYNTHETIC REFERENCES:\n${referenceBlock}\n\n${billUser(extraction, sourceText, billType)}`,
  });
}

export function plainLanguageCheck(
  extraction: Extraction,
  sourceText: string,
  billType: BillType,
): Promise<Finding[]> {
  return runCheck({
    check: 'plain',
    billType,
    sourceText,
    user: billUser(extraction, sourceText, billType),
  });
}
