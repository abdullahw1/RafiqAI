import {
  BILL_TYPES,
  type BillType,
  type Extraction,
  type Finding,
  type FindingSource,
  type HistoryPoint,
  type LineItem,
  type Severity,
} from './types';

const MAX_STRING = 600;
const MAX_LINE_ITEMS = 24;
const MAX_HISTORY_POINTS = 24;
const MAX_FINDINGS = 8;
const MAX_SOURCE_FILE_NAME = 255;
const SEVERITIES: readonly Severity[] = ['warning', 'info'];
const SOURCES: readonly FindingSource[] = ['anomaly', 'market', 'plain', 'trend'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isBillType(value: unknown): value is BillType {
  return typeof value === 'string' && BILL_TYPES.includes(value as BillType);
}

export function validateSourceFileName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (
    name.length === 0 ||
    name.length > MAX_SOURCE_FILE_NAME ||
    /[\u0000-\u001f\u007f/\\]/u.test(name) ||
    name === '.' ||
    name === '..'
  ) {
    return null;
  }
  return name;
}

export function clampString(value: unknown, max = MAX_STRING): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : null;
}

export function clampAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  }
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^0-9.\-]/gu, '');
  if (!/^-?\d+(\.\d+)?$/u.test(cleaned)) return null;
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : null;
}
function normalize(text: string): string {
  return text.replace(/\s+/gu, ' ').trim().toLowerCase();
}

export function evidenceIsGrounded(evidence: string, sourceText: string): boolean {
  const needle = normalize(evidence);
  return needle.length >= 4 && normalize(sourceText).includes(needle);
}

function labelIsGrounded(label: string, sourceText: string): boolean {
  return evidenceIsGrounded(label, sourceText);
}

function evidenceSupportsAmount(amount: number | null, evidence: string): boolean {
  if (amount === null) return true;
  return [...evidence.matchAll(/-?\$?\d[\d,]*(?:\.\d+)?/gu)].some(
    ([candidate]) => clampAmount(candidate) === amount,
  );
}

export function validateExtraction(raw: unknown, sourceText: string): Extraction | null {
  if (!isRecord(raw)) return null;
  const rawItems = Array.isArray(raw.lineItems) ? raw.lineItems.slice(0, MAX_LINE_ITEMS) : [];
  const lineItems: LineItem[] = rawItems.flatMap((entry): LineItem[] => {
    if (!isRecord(entry)) return [];
    const label = clampString(entry.label, 160);
    const amount = clampAmount(entry.amount);
    const evidence = clampString(entry.evidence);
    if (
      label === null ||
      evidence === null ||
      !evidenceIsGrounded(evidence, sourceText) ||
      !labelIsGrounded(label, sourceText) ||
      !evidenceSupportsAmount(amount, evidence)
    ) return [];
    return [{ label, amount, evidence }];
  });
  if (lineItems.length === 0) return null;

  const rawHistory = Array.isArray(raw.history) ? raw.history.slice(0, MAX_HISTORY_POINTS) : [];
  const history: HistoryPoint[] = rawHistory.flatMap((entry): HistoryPoint[] => {
    if (!isRecord(entry)) return [];
    const label = clampString(entry.label, 80);
    const amount = clampAmount(entry.amount);
    const evidence = clampString(entry.evidence);
    if (label === null || amount === null || evidence === null) return [];
    if (
      !evidenceIsGrounded(evidence, sourceText) ||
      !labelIsGrounded(label, sourceText) ||
      !evidenceSupportsAmount(amount, evidence)
    ) return [];
    return [{ label, amount, evidence }];
  });

  const total = clampAmount(raw.total);
  const historyMatchesTotal =
    history.length === 0 || total === null || history.at(-1)?.amount === total;

  return {
    vendor: clampString(raw.vendor, 160),
    accountHolder: clampString(raw.accountHolder, 160),
    billingPeriod: clampString(raw.billingPeriod, 160),
    total,
    priorAmount: clampAmount(raw.priorAmount),
    lineItems,
    history: historyMatchesTotal ? history : [],
  };
}

interface ValidateFindingsOptions {
  source: FindingSource;
  sourceText: string;
  idPrefix: string;
}

export function validateFindings(raw: unknown, options: ValidateFindingsOptions): Finding[] {
  const container = isRecord(raw) && Array.isArray(raw.findings) ? raw.findings : raw;
  if (!Array.isArray(container)) return [];
  return container.slice(0, MAX_FINDINGS).flatMap((entry, index): Finding[] => {
    if (!isRecord(entry)) return [];
    const title = clampString(entry.title, 200);
    const evidence = clampString(entry.evidence);
    const explanation = clampString(entry.explanation, 900);
    if (title === null || evidence === null || explanation === null) return [];
    if (!evidenceIsGrounded(evidence, options.sourceText)) return [];
    const severity: Severity =
      typeof entry.severity === 'string' && SEVERITIES.includes(entry.severity as Severity)
        ? (entry.severity as Severity)
        : 'info';
    const source = SOURCES.includes(options.source) ? options.source : 'anomaly';
    return [{
      id: `${options.idPrefix}-${index}`,
      severity,
      title,
      evidence,
      explanation,
      potentialImpact: clampString(entry.potentialImpact, 300),
      action: clampString(entry.action, 300) ?? 'Contact the provider through official contact details and request a written explanation.',
      source,
    }];
  });
}

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
