'use client';

import { useCallback, useRef, useState } from 'react';
import { PREPARED_BILL_TEXT } from '@/data/preparedBill';
import { readNdjsonStream } from '@/lib/ndjsonClient';
import { STAGE_IDS, type AnalysisMode, type AnalysisResult, type StageId } from '@/lib/types';
import { CallControls } from '@/components/CallControls';
import { FindingsView } from '@/components/FindingsView';
import { PipelineView, type StageView } from '@/components/PipelineView';

const STAGE_META: Record<StageId, { label: string; description: string }> = {
  extract: { label: 'Structured extraction', description: 'One model call normalizes the bill.' },
  anomaly: { label: 'Anomaly check', description: 'New charges and unexpected increases.' },
  market: { label: 'Market comparison', description: 'Against synthetic seeded reference data.' },
  plain: { label: 'Plain-language check', description: 'What vague fee names actually say.' },
  trend: { label: 'Trend & impact', description: 'Deterministic local math, no model call.' },
  merge: { label: 'Merge & briefing', description: 'Local de-duplication, sort, and briefing.' },
};

function initialStages(): StageView[] {
  return STAGE_IDS.map((id) => ({ id, status: 'pending', ...STAGE_META[id] }));
}

export default function Page() {
  const [text, setText] = useState('');
  const [stages, setStages] = useState<StageView[]>(initialStages);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [mode, setMode] = useState<AnalysisMode | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const started = useRef(false);

  const updateStage = useCallback((id: StageId, status: StageView['status'], note?: string) => {
    setStages((current) =>
      current.map((stage) => (stage.id === id ? { ...stage, status, note } : stage)),
    );
  }, []);

  async function analyze() {
    // Requirement 1.4: block empty submission with an inline message.
    if (text.trim().length === 0) {
      setInlineError('Paste the bill text or load the prepared demo bill first.');
      return;
    }
    if (started.current) return;

    started.current = true;
    setInlineError(null);
    setStreamError(null);
    setResult(null);
    setMode(null);
    setStages(initialStages());
    setRunning(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok || response.body === null) {
        const payload: unknown = await response.json().catch(() => null);
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : 'Analysis could not be started.';
        setInlineError(message);
        return;
      }

      await readNdjsonStream(response.body, (event) => {
        switch (event.type) {
          case 'stage':
            updateStage(event.id, event.status, event.note);
            break;
          case 'result':
            setResult(event.data);
            setMode(event.data.mode);
            break;
          case 'error':
            setStreamError(event.message);
            break;
          case 'complete':
            setMode((current) => current ?? event.mode);
            break;
        }
      });
    } catch {
      setStreamError('The connection closed before analysis finished.');
    } finally {
      // Requirement 5.6: still-running stages become failed on premature close.
      setStages((current) =>
        current.map((stage) =>
          stage.status === 'running'
            ? { ...stage, status: 'failed', note: 'Connection closed before this stage finished.' }
            : stage,
        ),
      );
      setRunning(false);
      started.current = false;
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-50">RafiqAI</h1>
        <p className="mt-1 text-sm text-slate-400">
          Understand a confusing phone bill. Then get a phone call explaining what to question.
        </p>
      </header>

      {/* Property 1: persistent fallback banner whenever fallback output is used. */}
      {mode === 'fallback' ? (
        <p
          role="status"
          className="rounded-md border border-amber-500 bg-amber-950/50 px-4 py-3 text-sm font-semibold text-amber-200"
        >
          Verified demo fallback — this output comes from pre-verified demonstration data for the
          prepared bill, not from a live model response.
        </p>
      ) : null}
      {mode === 'partial' ? (
        <p
          role="status"
          className="rounded-md border border-rose-600 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          Partial result — at least one check did not complete. Completed findings are shown below.
        </p>
      ) : null}

      <section aria-label="Bill input" className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setText(PREPARED_BILL_TEXT);
              setInlineError(null);
            }}
            className="rounded-md border border-sky-600 px-3 py-2 text-sm font-medium text-sky-200 hover:bg-sky-950/60"
          >
            Load demo bill
          </button>
          <button
            type="button"
            onClick={analyze}
            disabled={running}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {running ? 'Analyzing…' : 'Analyze bill'}
          </button>
          <span className="text-xs text-slate-500">Bill recipient: Sarah</span>
        </div>

        <label htmlFor="bill-text" className="block text-xs uppercase tracking-wide text-slate-500">
          Paste the phone bill text
        </label>
        <textarea
          id="bill-text"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (inlineError !== null) setInlineError(null);
          }}
          rows={10}
          spellCheck={false}
          placeholder="Paste Sarah's phone bill here, or click Load demo bill."
          className="w-full rounded-md border border-slate-700 bg-slate-950/80 p-3 font-mono text-xs text-slate-200 outline-none focus:border-sky-500"
        />
        {inlineError !== null ? (
          <p role="alert" className="text-sm text-rose-300">
            {inlineError}
          </p>
        ) : null}
      </section>

      <PipelineView stages={stages} />

      {streamError !== null ? (
        <p role="alert" className="rounded-md border border-rose-700 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {streamError}
        </p>
      ) : null}

      {result !== null ? (
        <>
          <FindingsView result={result} />
          <CallControls briefing={result.briefing} />
        </>
      ) : null}

      <footer className="border-t border-slate-800 pt-4 text-xs leading-relaxed text-slate-500">
        <p>
          Prototype running on localhost with no authentication. Nothing you paste is saved to disk or
          local storage, but the bill text is sent to the configured OpenAI provider, and the briefing
          and call content are sent to Vapi and its configured speech and model providers. Do not use
          real sensitive bills.
        </p>
        <p className="mt-2">
          Market comparisons and account history are synthetic demonstration data. Findings are
          informational, may be wrong, and do not establish fraud or guarantee refunds.
        </p>
      </footer>
    </main>
  );
}
