import { PREPARED_BILL_TEXT } from '@/data/preparedBill';
import { anomalyCheck, marketCheck, plainLanguageCheck } from '@/lib/checks';
import {
  buildCarrierComparisons,
  buildTrendFinding,
  calculateTrendAndImpact,
  type TrendAnalysis,
} from '@/lib/billMath';
import { issueCallToken } from '@/lib/callToken';
import { extract } from '@/lib/extract';
import {
  FALLBACK_ANOMALY_FINDINGS,
  FALLBACK_EXTRACTION,
  FALLBACK_MARKET_FINDINGS,
  FALLBACK_PLAIN_FINDINGS,
  fallbackIsAllowed,
  isSafeModeEnabled,
} from '@/lib/fallback';
import { buildBriefing, firstName, mergeFindings, resolveMode } from '@/lib/merge';
import { hasOpenAiCredentials, logStageFailure, OVERALL_DEADLINE_MS } from '@/lib/openai';
import { NdjsonWriter } from '@/lib/stream';
import type { AnalysisResult, BillType, Extraction, Finding } from '@/lib/types';
import { isBillType, validateSourceFileName } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_INPUT_CHARS = 40_000;
const MIN_INPUT_CHARS = 20;

function trendEvidenceFor(text: string): string {
  return text
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => /total amount due|amount due|current total/iu.test(candidate)) ?? '';
}

function buildResult(options: {
  extraction: Extraction;
  billType: BillType;
  analysis: TrendAnalysis;
  groups: Finding[][];
  usedFallback: boolean;
  failedStages: number;
  trendEvidence: string;
  isPreparedDemo: boolean;
}): AnalysisResult {
  const mode = resolveMode({
    usedFallback: options.usedFallback,
    failedStages: options.failedStages,
  });
  const trendGroup = options.analysis.trend.length >= 2 && options.trendEvidence.length >= 4
    ? [buildTrendFinding(options.analysis, options.trendEvidence)]
    : [];
  const findings = mergeFindings([trendGroup, ...options.groups]);
  const carrierComparisons = buildCarrierComparisons(
    options.billType,
    options.extraction.total,
    options.isPreparedDemo,
  );
  const briefing = buildBriefing({
    accountHolderFirstName: firstName(options.extraction.accountHolder),
    vendor: options.extraction.vendor,
    analysis: options.analysis,
    mode,
    billType: options.billType,
    comparisons: carrierComparisons,
    isPreparedDemo: options.isPreparedDemo,
  });

  return {
    mode,
    billType: options.billType,
    findings,
    trend: options.analysis.trend,
    baselineAverage: options.analysis.baselineAverage,
    baselinePointCount: options.analysis.baselinePointCount,
    currentVsAverageAmount: options.analysis.currentVsAverageAmount,
    currentVsAveragePercent: options.analysis.currentVsAveragePercent,
    trendDirection: options.analysis.trendDirection,
    increasePercent: options.analysis.increasePercent,
    potentialMonthlyImpact: options.analysis.potentialMonthlyImpact,
    potentialAnnualImpact: options.analysis.potentialAnnualImpact,
    carrierComparisons,
    briefing,
    callToken: issueCallToken('sarah', briefing),
    syntheticComparisonData: carrierComparisons.length > 0,
  };
}
function runFallbackPipeline(
  writer: NdjsonWriter,
  note: string,
  options: { extractAlreadyStarted?: boolean } = {},
): void {
  if (options.extractAlreadyStarted !== true) writer.stage('extract', 'running');
  writer.stage('extract', 'fallback', note);
  for (const stage of ['anomaly', 'market', 'plain'] as const) {
    writer.stage(stage, 'fallback', 'Verified prepared-bill demo data used; the live check did not run.');
  }
  writer.stage('trend', 'running');
  const analysis = calculateTrendAndImpact(FALLBACK_EXTRACTION, 'phone', true);
  writer.stage('trend', 'done');
  writer.stage('merge', 'running');
  const result = buildResult({
    extraction: FALLBACK_EXTRACTION,
    billType: 'phone',
    analysis,
    groups: [
      [...FALLBACK_ANOMALY_FINDINGS],
      [...FALLBACK_MARKET_FINDINGS],
      [...FALLBACK_PLAIN_FINDINGS],
    ],
    usedFallback: true,
    failedStages: 0,
    trendEvidence: trendEvidenceFor(PREPARED_BILL_TEXT),
    isPreparedDemo: true,
  });
  writer.stage('merge', 'done');
  writer.send({ type: 'result', data: result });
  writer.complete('fallback');
}

async function runLivePipeline(
  writer: NdjsonWriter,
  text: string,
  billType: BillType,
  isPreparedDemo: boolean,
): Promise<void> {
  const allowFallback = isPreparedDemo;
  writer.stage('extract', 'running');
  let extraction: Extraction;
  try {
    extraction = await extract(text, billType);
    writer.stage('extract', 'done');
  } catch (error) {
    logStageFailure('extract', error);
    if (!allowFallback) {
      writer.stage('extract', 'failed', 'Extraction failed and no verified fallback applies to this text.');
      writer.send({
        type: 'error',
        message: 'We could not read this document. Check the selected bill type and extracted text.',
        recoverable: true,
      });
      writer.complete('partial');
      return;
    }
    runFallbackPipeline(writer, 'Live extraction failed; using verified demo fallback.', {
      extractAlreadyStarted: true,
    });
    return;
  }

  const pending = [
    { id: 'anomaly' as const, promise: anomalyCheck(extraction, text, billType) },
    { id: 'market' as const, promise: marketCheck(extraction, text, billType) },
    { id: 'plain' as const, promise: plainLanguageCheck(extraction, text, billType) },
  ];
  for (const check of pending) writer.stage(check.id, 'running');
  const settled = await Promise.allSettled(pending.map((check) => check.promise));

  const groups: Finding[][] = [];
  let failedStages = 0;
  let usedFallbackStage = false;
  settled.forEach((outcome, index) => {
    const stage = pending[index]!.id;
    if (outcome.status === 'fulfilled') {
      groups.push(outcome.value);
      writer.stage(stage, 'done');
      return;
    }
    logStageFailure(stage, outcome.reason);
    if (allowFallback) {
      const fallbackFindings = stage === 'anomaly'
        ? FALLBACK_ANOMALY_FINDINGS
        : stage === 'market'
          ? FALLBACK_MARKET_FINDINGS
          : FALLBACK_PLAIN_FINDINGS;
      groups.push([...fallbackFindings]);
      usedFallbackStage = true;
      writer.stage(stage, 'fallback', 'This check used verified demo fallback content.');
      return;
    }
    failedStages += 1;
    writer.stage(stage, 'failed', 'This check did not return usable output.');
  });

  writer.stage('trend', 'running');
  const resultExtraction = isPreparedDemo ? FALLBACK_EXTRACTION : extraction;
  const analysis = calculateTrendAndImpact(resultExtraction, billType, isPreparedDemo);
  writer.stage('trend', 'done');
  writer.stage('merge', 'running');
  const result = buildResult({
    extraction: resultExtraction,
    billType,
    analysis,
    groups,
    usedFallback: usedFallbackStage,
    failedStages,
    trendEvidence: trendEvidenceFor(text),
    isPreparedDemo,
  });
  writer.stage('merge', 'done');
  writer.send({ type: 'result', data: result });
  writer.complete(result.mode);
}
interface AnalyzeInput {
  text: string;
  billType: BillType;
  sourceFileName?: string;
}

async function readInput(request: Request): Promise<AnalyzeInput | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  if (typeof record.text !== 'string' || !isBillType(record.billType)) return null;
  const text = record.text;
  if ('sourceFileName' in record) {
    const sourceFileName = validateSourceFileName(record.sourceFileName);
    if (sourceFileName === null) return null;
    return { text, billType: record.billType, sourceFileName };
  }
  return { text, billType: record.billType };
}

export async function POST(request: Request): Promise<Response> {
  const input = await readInput(request);
  if (input === null) {
    return Response.json(
      { error: 'Expected JSON with text, a valid billType, and an optional safe sourceFileName.' },
      { status: 400 },
    );
  }
  if (input.text.trim().length < MIN_INPUT_CHARS) {
    return Response.json({ error: 'Please provide bill text before starting analysis.' }, { status: 400 });
  }
  if (input.text.length > MAX_INPUT_CHARS) {
    return Response.json(
      { error: `Bill text is too long. Limit is ${MAX_INPUT_CHARS} characters.` },
      { status: 400 },
    );
  }

  const { text: billText, billType } = input;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writer = new NdjsonWriter(controller);
      const overallTimer = setTimeout(() => {
        writer.send({
          type: 'error',
          message: 'Analysis exceeded its time budget. Completed findings are shown above.',
          recoverable: true,
        });
        writer.complete('partial');
        writer.close();
      }, OVERALL_DEADLINE_MS);

      try {
        const isPreparedDemo = fallbackIsAllowed(billText, billType);
        if (isSafeModeEnabled()) {
          if (isPreparedDemo) {
            runFallbackPipeline(writer, 'Safe mode is enabled; no model calls were made.');
          } else {
            writer.stage('extract', 'failed', 'Safe mode only supports the prepared phone demo bill.');
            writer.send({
              type: 'error',
              message: 'Safe mode cannot analyze this document.',
              recoverable: true,
            });
            writer.complete('partial');
          }
        } else if (!hasOpenAiCredentials()) {
          if (isPreparedDemo) {
            runFallbackPipeline(writer, 'No model credentials configured; using verified demo fallback.');
          } else {
            writer.stage('extract', 'failed', 'No model credentials are configured.');
            writer.send({
              type: 'error',
              message: 'Live analysis is not configured for this document.',
              recoverable: true,
            });
            writer.complete('partial');
          }
        } else {
          await runLivePipeline(writer, billText, billType, isPreparedDemo);
        }
      } catch (error) {
        logStageFailure('pipeline', error);
        writer.send({ type: 'error', message: 'Analysis stopped unexpectedly.', recoverable: false });
        writer.complete('partial');
      } finally {
        clearTimeout(overallTimer);
        writer.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
