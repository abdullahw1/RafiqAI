import { anomalyCheck, marketCheck, plainLanguageCheck } from '@/lib/checks';
import { buildTrendFinding, calculateTrendAndImpact, type TrendAnalysis } from '@/lib/billMath';
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
import type { AnalysisResult, Extraction, Finding } from '@/lib/types';
import { PREPARED_BILL_TEXT } from '@/data/preparedBill';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_INPUT_CHARS = 20_000;
const MIN_INPUT_CHARS = 20;

/** The whole bill is the evidence anchor for the deterministic trend finding. */
const TREND_EVIDENCE = 'TOTAL AMOUNT DUE                                         $82.00';

function trendEvidenceFor(text: string): string {
  const line = text
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => /total amount due/iu.test(candidate));
  return line ?? TREND_EVIDENCE;
}

function buildResult(options: {
  extraction: Extraction;
  analysis: TrendAnalysis;
  groups: Finding[][];
  usedFallback: boolean;
  failedStages: number;
  trendEvidence: string;
}): AnalysisResult {
  const mode = resolveMode({
    usedFallback: options.usedFallback,
    failedStages: options.failedStages,
  });

  const findings = mergeFindings([
    [buildTrendFinding(options.analysis, options.trendEvidence)],
    ...options.groups,
  ]);

  return {
    mode,
    findings,
    trend: options.analysis.trend,
    increasePercent: options.analysis.increasePercent,
    potentialMonthlyImpact: options.analysis.potentialMonthlyImpact,
    potentialAnnualImpact: options.analysis.potentialAnnualImpact,
    briefing: buildBriefing({
      accountHolderFirstName: firstName(options.extraction.accountHolder),
      vendor: options.extraction.vendor,
      analysis: options.analysis,
      findings,
      mode,
    }),
    syntheticComparisonData: true,
  };
}

/** Fully local path: no network calls at all (Task 2 hard gate). */
function runFallbackPipeline(
  writer: NdjsonWriter,
  note: string,
  options: { extractAlreadyStarted?: boolean } = {},
): void {
  if (options.extractAlreadyStarted !== true) writer.stage('extract', 'running');
  writer.stage('extract', 'fallback', note);

  for (const stage of ['anomaly', 'market', 'plain'] as const) {
    writer.stage(stage, 'running');
  }
  for (const stage of ['anomaly', 'market', 'plain'] as const) {
    writer.stage(stage, 'fallback', note);
  }
  writer.stage('trend', 'running');
  const analysis = calculateTrendAndImpact(FALLBACK_EXTRACTION);
  writer.stage('trend', 'done');

  writer.stage('merge', 'running');
  const result = buildResult({
    extraction: FALLBACK_EXTRACTION,
    analysis,
    groups: [
      [...FALLBACK_ANOMALY_FINDINGS],
      [...FALLBACK_MARKET_FINDINGS],
      [...FALLBACK_PLAIN_FINDINGS],
    ],
    usedFallback: true,
    failedStages: 0,
    trendEvidence: trendEvidenceFor(PREPARED_BILL_TEXT),
  });
  writer.stage('merge', 'done');

  writer.send({ type: 'result', data: result });
  writer.complete('fallback');
}

async function runLivePipeline(writer: NdjsonWriter, text: string): Promise<void> {
  const allowFallback = fallbackIsAllowed(text);

  // Stage 1: extraction.
  writer.stage('extract', 'running');
  let extraction: Extraction;
  try {
    extraction = await extract(text);
    writer.stage('extract', 'done');
  } catch (error) {
    logStageFailure('extract', error);
    if (!allowFallback) {
      writer.stage('extract', 'failed', 'Extraction failed and no verified fallback applies to this text.');
      writer.send({
        type: 'error',
        message: 'We could not read this document. Please try the prepared demo bill.',
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

  // Stage 2: three genuinely concurrent checks. All three promises are created and all
  // three running events are emitted BEFORE anything is awaited (Property 3).
  const pending = [
    { id: 'anomaly' as const, promise: anomalyCheck(extraction, text) },
    { id: 'market' as const, promise: marketCheck(extraction, text) },
    { id: 'plain' as const, promise: plainLanguageCheck(extraction, text) },
  ];
  for (const check of pending) {
    writer.stage(check.id, 'running');
  }

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
      const fallbackFindings =
        stage === 'anomaly'
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

  // Stage 3: deterministic local math.
  writer.stage('trend', 'running');
  const analysis = calculateTrendAndImpact(extraction);
  writer.stage('trend', 'done');

  // Stage 4: local merge and briefing.
  writer.stage('merge', 'running');
  const result = buildResult({
    extraction,
    analysis,
    groups,
    usedFallback: usedFallbackStage,
    failedStages,
    trendEvidence: trendEvidenceFor(text),
  });
  writer.stage('merge', 'done');

  writer.send({ type: 'result', data: result });
  writer.complete(result.mode);
}

export async function POST(request: Request): Promise<Response> {
  let text = '';
  try {
    const body: unknown = await request.json();
    if (typeof body === 'object' && body !== null && 'text' in body) {
      const value = (body as { text: unknown }).text;
      if (typeof value === 'string') text = value.trim();
    }
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Requirement 1.4 / design: empty input returns 400 before opening the stream.
  if (text.length < MIN_INPUT_CHARS) {
    return Response.json(
      { error: 'Please paste the bill text before starting analysis.' },
      { status: 400 },
    );
  }
  if (text.length > MAX_INPUT_CHARS) {
    return Response.json(
      { error: `Bill text is too long. Limit is ${MAX_INPUT_CHARS} characters.` },
      { status: 400 },
    );
  }

  const billText = text;

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
        if (isSafeModeEnabled()) {
          runFallbackPipeline(writer, 'Safe mode is enabled; no model calls were made.');
        } else if (!hasOpenAiCredentials()) {
          if (fallbackIsAllowed(billText)) {
            runFallbackPipeline(
              writer,
              'No model credentials configured; using verified demo fallback.',
            );
          } else {
            writer.stage('extract', 'failed', 'No model credentials are configured.');
            writer.send({
              type: 'error',
              message:
                'Live analysis is not configured. Load the prepared demo bill to see the verified fallback.',
              recoverable: true,
            });
            writer.complete('partial');
          }
        } else {
          await runLivePipeline(writer, billText);
        }
      } catch (error) {
        logStageFailure('pipeline', error);
        writer.send({
          type: 'error',
          message: 'Analysis stopped unexpectedly.',
          recoverable: false,
        });
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
