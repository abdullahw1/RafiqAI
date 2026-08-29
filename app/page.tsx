'use client';

import { type ChangeEvent, useCallback, useRef, useState } from 'react';
import { CallControls } from '@/components/CallControls';
import { FindingsView } from '@/components/FindingsView';
import { PipelineView, type StageView } from '@/components/PipelineView';
import { PREPARED_BILL_TEXT } from '@/data/preparedBill';
import { readNdjsonStream } from '@/lib/ndjsonClient';
import {
  BILL_TYPES,
  STAGE_IDS,
  type AnalysisMode,
  type AnalysisResult,
  type BillType,
  type StageId,
} from '@/lib/types';

const STAGE_META: Record<StageId, { label: string; description: string }> = {
  extract: { label: 'Read the bill', description: 'Find the provider, total, charges, and bill history.' },
  anomaly: { label: 'Check for changes', description: 'Look for new charges and unexpected increases.' },
  market: { label: 'Check typical costs', description: 'Review relevant cost information for this bill category.' },
  plain: { label: 'Explain confusing terms', description: 'Turn unclear charge names into everyday language.' },
  trend: { label: 'Compare bill history', description: 'Compare the current total with earlier months.' },
  merge: { label: 'Prepare your next steps', description: 'Organize the findings and create a call briefing.' },
};

const BILL_TYPE_LABEL: Record<BillType, string> = {
  phone: 'Phone',
  insurance: 'Insurance',
  medical: 'Medical',
  other: 'Other',
};

type PdfState =
  | { status: 'idle' }
  | { status: 'reading'; fileName: string }
  | { status: 'ready'; fileName: string; pages: number }
  | { status: 'error'; message: string };

function initialStages(): StageView[] {
  return STAGE_IDS.map((id) => ({ id, status: 'pending', ...STAGE_META[id] }));
}
function responseMessage(payload: unknown, fallback: string): string {
  return typeof payload === 'object' && payload !== null && 'error' in payload
    ? String((payload as { error: unknown }).error)
    : fallback;
}

export default function Page() {
  const [text, setText] = useState('');
  const [billType, setBillType] = useState<BillType>('phone');
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<PdfState>({ status: 'idle' });
  const [stages, setStages] = useState<StageView[]>(initialStages);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [mode, setMode] = useState<AnalysisMode | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const clearAnalysis = useCallback(() => {
    setInlineError(null);
    setStreamError(null);
    setResult(null);
    setMode(null);
    setStages(initialStages());
  }, []);

  const updateStage = useCallback((id: StageId, status: StageView['status'], note?: string) => {
    setStages((current) =>
      current.map((stage) => (stage.id === id ? { ...stage, status, note } : stage)),
    );
  }, []);

  function loadDemo() {
    setBillType('phone');
    setText(PREPARED_BILL_TEXT);
    setSourceFileName(null);
    setPdfState({ status: 'idle' });
    clearAnalysis();
  }

  function changeText(nextText: string) {
    setText(nextText);
    setSourceFileName(null);
    setPdfState({ status: 'idle' });
    clearAnalysis();
  }

  async function selectPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file === undefined) return;

    clearAnalysis();
    setText('');
    setSourceFileName(null);
    setPdfState({ status: 'reading', fileName: file.name });

    if (!file.name.toLowerCase().endsWith('.pdf') || (file.type !== '' && file.type !== 'application/pdf')) {
      setPdfState({ status: 'error', message: 'Please choose a PDF file ending in .pdf.' });
      return;
    }

    const pdfFile = file.type === ''
      ? new File([file], file.name, { type: 'application/pdf' })
      : file;
    const form = new FormData();
    form.append('file', pdfFile);
    try {
      const response = await fetch('/api/extract-pdf', { method: 'POST', body: form });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setPdfState({
          status: 'error',
          message: responseMessage(payload, 'We could not read that PDF. You can paste the bill text instead.'),
        });
        return;
      }
      if (
        typeof payload !== 'object' || payload === null ||
        typeof (payload as { text?: unknown }).text !== 'string' ||
        typeof (payload as { fileName?: unknown }).fileName !== 'string' ||
        typeof (payload as { pages?: unknown }).pages !== 'number'
      ) {
        setPdfState({ status: 'error', message: 'The PDF was read, but its text could not be returned.' });
        return;
      }
      const extracted = payload as { text: string; fileName: string; pages: number };
      setText(extracted.text);
      setSourceFileName(extracted.fileName);
      setPdfState({ status: 'ready', fileName: extracted.fileName, pages: extracted.pages });
    } catch {
      setPdfState({
        status: 'error',
        message: 'We could not reach the PDF reader. Please try again or paste the bill text below.',
      });
    }
  }
  async function analyze() {
    if (text.trim().length === 0) {
      setInlineError('Select a PDF, paste bill text, or load the demo before continuing.');
      return;
    }
    if (started.current) return;

    started.current = true;
    clearAnalysis();
    setRunning(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          billType,
          ...(sourceFileName === null ? {} : { sourceFileName }),
        }),
      });

      if (!response.ok || response.body === null) {
        const payload: unknown = await response.json().catch(() => null);
        setInlineError(responseMessage(payload, 'We could not start the review. Please try again.'));
        return;
      }

      let streamCompleted = false;
      await readNdjsonStream(response.body, (event) => {
        if (streamCompleted) return;
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
            streamCompleted = true;
            setMode(event.mode);
            setStages((current) =>
              current.map((stage) =>
                stage.status === 'pending' || stage.status === 'running'
                  ? {
                      ...stage,
                      status: 'failed',
                      note: 'Review completed before this step reported a final status.',
                    }
                  : stage,
              ),
            );
            break;
        }
      });
    } catch {
      setStreamError('The review connection ended early. Please try again.');
    } finally {
      setStages((current) =>
        current.map((stage) =>
          stage.status === 'running' || stage.status === 'pending'
            ? { ...stage, status: 'failed', note: 'Review ended before this step reported a final status.' }
            : stage,
        ),
      );
      setRunning(false);
      started.current = false;
    }
  }

  const pdfIsReading = pdfState.status === 'reading';

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">A calm second look at a confusing bill</p>
        <h1>RafiqAI</h1>
        <p className="hero-copy">
          Review a phone, insurance, medical, or other bill in plain language—then decide what to ask next.
        </p>
      </header>

      {mode === 'fallback' ? (
        <div role="status" className="notice notice-warning">
          <strong>Showing the verified demo result.</strong> The live review was unavailable, so these
          findings come from the prepared AT&amp;T example—not a new live analysis.
        </div>
      ) : null}
      {mode === 'partial' ? (
        <div role="status" className="notice notice-warning">
          <strong>Some checks did not finish.</strong> You can still review any completed findings below.
        </div>
      ) : null}

      <section aria-labelledby="bill-input-heading" className="panel input-panel">
        <div className="section-heading">
          <span className="step-number" aria-hidden="true">1</span>
          <div>
            <h2 id="bill-input-heading">Choose the bill category</h2>
            <p>This helps RafiqAI review the document in the right context.</p>
          </div>
        </div>
        <label htmlFor="bill-type" className="field-label">Bill category</label>
        <select
          id="bill-type"
          value={billType}
          disabled={running || pdfIsReading}
          onChange={(event) => {
            setBillType(event.target.value as BillType);
            clearAnalysis();
          }}
          className="select-control"
        >
          {BILL_TYPES.map((type) => <option key={type} value={type}>{BILL_TYPE_LABEL[type]}</option>)}
        </select>

        <div className="section-divider" />
        <div className="section-heading">
          <span className="step-number" aria-hidden="true">2</span>
          <div>
            <h2>Provide the bill</h2>
            <p>Select a PDF for automatic text extraction, or paste the text yourself.</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={selectPdf}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="input-actions">
          <button
            type="button"
            className="button button-secondary button-large"
            onClick={() => fileInputRef.current?.click()}
            disabled={running || pdfIsReading}
          >
            {pdfIsReading ? 'Reading PDF…' : 'Select PDF'}
          </button>
          <button type="button" className="button button-quiet" onClick={loadDemo} disabled={running || pdfIsReading}>
            Load AT&amp;T demo
          </button>
        </div>
        <div className="pdf-status" aria-live="polite">
          {pdfState.status === 'reading' ? <p><strong>Reading:</strong> {pdfState.fileName}</p> : null}
          {pdfState.status === 'ready' ? (
            <p className="success-text"><strong>PDF ready:</strong> {pdfState.fileName} · {pdfState.pages} page{pdfState.pages === 1 ? '' : 's'}</p>
          ) : null}
          {pdfState.status === 'error' ? <p role="alert" className="error-text">{pdfState.message}</p> : null}
        </div>

        <div className="or-divider"><span>or paste text</span></div>
        <label htmlFor="bill-text" className="field-label">Bill text</label>
        <textarea
          id="bill-text"
          value={text}
          onChange={(event) => changeText(event.target.value)}
          disabled={running || pdfIsReading}
          rows={11}
          placeholder="Paste the bill text here. You can remove account numbers or other personal details first."
          className="text-control"
          aria-describedby={inlineError === null ? undefined : 'bill-error'}
        />
        {inlineError !== null ? <p id="bill-error" role="alert" className="error-text">{inlineError}</p> : null}

        <div className="section-divider" />
        <div className="review-row">
          <div className="section-heading compact-heading">
            <span className="step-number" aria-hidden="true">3</span>
            <div>
              <h2>Review the bill</h2>
              <p>RafiqAI will show each step as it finishes.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={analyze}
            disabled={running || pdfIsReading}
            className="button button-primary button-large"
          >
            {running ? 'Reviewing bill…' : 'Analyze bill'}
          </button>
        </div>
      </section>

      <PipelineView stages={stages} />

      {streamError !== null ? <div role="alert" className="notice notice-error">{streamError}</div> : null}

      {result !== null ? (
        <div className="results-stack">
          <FindingsView result={result} />
          <CallControls
            key={result.callToken ?? result.briefing}
            briefing={result.briefing}
            callToken={result.callToken}
            ready={!running}
          />
        </div>
      ) : null}

      <footer className="site-footer">
        <p>
          PDF text is extracted on the server in memory, then sent to the configured model for review.
          RafiqAI does not write the PDF or extracted text to its storage.
        </p>
        <p>
          Vapi receives the configured recipient name and phone number when you manually request a call;
          the prepared briefing is sent only at that time. Carrier comparisons and the loaded AT&amp;T bill
          are synthetic demo data. Findings may be wrong and do not prove fraud or guarantee savings or refunds.
        </p>
      </footer>
    </main>
  );
}
