import type { Extraction, Finding, FindingSource, LineItem, Severity } from './types';

const MAX_STRING = 600;
const MAX_LINE_ITEMS = 24;
const MAX_FINDINGS = 8;

const SEVERITIES: readonly Severity[] = ['warning', 'info'];
const SOURCES: readonly FindingSource[] = ['anomaly', 'market', 'plain', 'trend'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function clampString(value: unknown, max = MAX_STRING): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

/** Non-finite or non-numeric amounts clamp to null (design: data models). */
export function clampAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  }
  if (typeof value !== 'string') return null;

  // Strip currency symbols and separators, then reject anything left non-numeric.
  // An empty residue must become null, not 0.
  const cleaned = value.replace(/[^0-9.\-]/gu, '');
  if (!/^-?\d+(\.\d+)?$/u.test(cleaned)) return null;
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100) / 100;
}

/**
 * Normalizes whitespace/case so evidence comparison tolerates copy/paste differences
 * while still requiring the substance to come from the submitted text.
 */
function normalize(text: string): string {
  return text.replace(/\s+/gu, ' ').trim().toLowerCase();
}

/** Property 5: evidence must appear verbatim (whitespace-insensitive) in the source text. */
export function evidenceIsGrounded(evidence: string, sourceText: string): boolean {
  const needle = normalize(evidence);
  if (needle.length < 4) return false;
  return normalize(sourceText).includes(needle);
}

export function validateExtraction(raw: unknown, sourceText: string): Extraction | null {
  if (!isRecord(raw)) return null;

  const rawItems = Array.isArray(raw.lineItems) ? raw.lineItems.slice(0, MAX_LINE_ITEMS) : [];
  const lineItems: LineItem[] = rawItems.flatMap((entry): LineItem[] => {
    if (!isRecord(entry)) return [];
    const label = clampString(entry.label, 160);
    if (label === null) return [];
    const evidence = clampString(entry.evidence) ?? label;
    return [
      {
        label,
        amount: clampAmount(entry.amount),
        evidence: evidenceIsGrounded(evidence, sourceText) ? evidence : label,
      },
    ];
  });

  if (lineItems.length === 0) return null;

  return {
    vendor: clampString(raw.vendor, 160),
    accountHolder: clampString(raw.accountHolder, 160),
    billingPeriod: clampString(raw.billingPeriod, 160),
    total: clampAmount(raw.total),
    priorAmount: clampAmount(raw.priorAmount),
    lineItems,
  };
}

interface ValidateFindingsOptions {
  source: FindingSource;
  sourceText: string;
  idPrefix: string;
}

/**
 * Accepts either `{ findings: [...] }` or a bare array. Rejects unknown severities and
 * any finding whose evidence is not grounded in the submitted text.
 */
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

    const source: FindingSource = SOURCES.includes(options.source) ? options.source : 'anomaly';

    return [
      {
        id: `${options.idPrefix}-${index}`,
        severity,
        title,
        evidence,
        explanation,
        potentialImpact: clampString(entry.potentialImpact, 300),
        action:
          clampString(entry.action, 300) ??
          'Contact the carrier through the number printed on the statement and ask for a written explanation.',
        source,
      },
    ];
  });
}

/** Parses a model text response that should contain a single JSON object. */
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
