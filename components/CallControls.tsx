'use client';

import { useState } from 'react';
import type { CallStatus } from '@/lib/types';

const RECIPIENT_ID = 'sarah';

export function CallControls({ briefing }: { briefing: string }) {
  const [status, setStatus] = useState<CallStatus | null>(null);
  const [calling, setCalling] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);

  // Requirement 6.2: only ever triggered by this click handler.
  async function placeCall() {
    setCalling(true);
    setStatus(null);
    try {
      const response = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: RECIPIENT_ID, briefing }),
      });
      const data: unknown = await response.json();
      if (typeof data === 'object' && data !== null && 'status' in data) {
        setStatus(data as CallStatus);
        if ((data as CallStatus).status !== 'placed') setShowBriefing(true);
      } else {
        setStatus({ status: 'failed', reason: 'Unexpected response from the call service.' });
        setShowBriefing(true);
      }
    } catch {
      setStatus({ status: 'failed', reason: 'Network error while placing the call.' });
      setShowBriefing(true);
    } finally {
      setCalling(false);
    }
  }

  const needsRetry = status !== null && status.status !== 'placed';

  return (
    <section aria-label="Call controls" className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={placeCall}
          disabled={calling}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {calling ? 'Calling…' : needsRetry ? 'Retry call to Sarah' : 'Call Sarah'}
        </button>
        <button
          type="button"
          onClick={() => setShowBriefing((value) => !value)}
          className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          aria-expanded={showBriefing}
        >
          {showBriefing ? 'Hide English briefing' : 'Show English briefing'}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        The call is never placed automatically. Sarah&apos;s number is stored server-side and is the
        only allowed destination. The agent greets her in English and continues in Arabic if she
        speaks Arabic.
      </p>

      {status !== null ? (
        <p
          role="status"
          className={`text-sm ${
            status.status === 'placed'
              ? 'text-emerald-300'
              : status.status === 'unavailable'
                ? 'text-amber-300'
                : 'text-rose-300'
          }`}
        >
          {status.status === 'placed'
            ? `Call placed to ${status.recipientName}. The agent will greet her in English.`
            : status.reason}
        </p>
      ) : null}

      {showBriefing ? (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500">English briefing</h3>
          <p className="mt-1 rounded border border-slate-700 bg-slate-950/70 p-3 text-sm leading-relaxed text-slate-200">
            {briefing}
          </p>
        </div>
      ) : null}
    </section>
  );
}
