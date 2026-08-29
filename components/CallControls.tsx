'use client';

import { useRef, useState } from 'react';
import type { CallStatus } from '@/lib/types';

interface CallControlsProps {
  briefing: string;
  callToken: string | null;
  ready: boolean;
}

function parseCallStatus(data: unknown): CallStatus | null {
  if (typeof data !== 'object' || data === null || !('status' in data)) return null;
  const value = data as { status: unknown; recipientName?: unknown; reason?: unknown };
  if (value.status === 'placed' && typeof value.recipientName === 'string') {
    return { status: 'placed', recipientName: value.recipientName };
  }
  if (
    (value.status === 'unavailable' || value.status === 'unknown' || value.status === 'failed') &&
    typeof value.reason === 'string'
  ) {
    return { status: value.status, reason: value.reason };
  }
  return null;
}

export function CallControls({ briefing, callToken, ready }: CallControlsProps) {
  const [status, setStatus] = useState<CallStatus | null>(null);
  const [calling, setCalling] = useState(false);
  const requestLocked = useRef(false);

  async function placeCall() {
    if (!ready || callToken === null || status !== null || calling || requestLocked.current) return;
    requestLocked.current = true;
    setCalling(true);
    try {
      const response = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callToken }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const reason =
          typeof data === 'object' && data !== null && 'reason' in data
            ? String((data as { reason: unknown }).reason)
            : 'The call could not be requested. You can use the briefing below instead.';
        setStatus({ status: 'failed', reason });
      } else {
        const parsedStatus = parseCallStatus(data);
        setStatus(
          parsedStatus ?? {
            status: 'failed',
            reason: 'The call service returned an unexpected response.',
          },
        );
      }
    } catch {
      setStatus({
        status: 'unknown',
        reason: 'We did not receive confirmation. A call may still start, so please do not press the button again.',
      });
    } finally {
      setCalling(false);
    }
  }

  const callDisabled = !ready || calling || callToken === null || status !== null;
  const callLabel = !ready
    ? 'Finishing the review…'
    : calling
      ? 'Requesting the call…'
      : callToken === null
        ? 'Manual call unavailable'
        : status === null
          ? 'Call Sarah now'
          : 'Call request complete';

  return (
    <section aria-labelledby="call-heading" className="panel call-panel">
      <div className="section-heading">
        <span className="step-number" aria-hidden="true">6</span>
        <div>
          <h2 id="call-heading">Choose whether to make a call</h2>
          <p>The call never starts on its own. You must press the button below.</p>
        </div>
      </div>

      <div className="call-explanation">
        <h3>What the voice assistant will know</h3>
        <p>
          It receives the readable briefing below, including the available bill history (six months in
          the AT&amp;T demo) and synthetic carrier comparisons when they are available. It does not receive
          the PDF itself.
        </p>
      </div>

      <div className="briefing-box">
        <h3>Briefing for Sarah</h3>
        <p>{briefing}</p>
      </div>

      <button
        type="button"
        onClick={placeCall}
        disabled={callDisabled}
        className="button button-call button-large"
      >
        {callLabel}
      </button>
      <p className="call-safety">This is a manual action. The page allows only one request for this analysis.</p>

      {status !== null ? (
        <div
          role="status"
          className={`call-status ${status.status === 'placed' ? 'call-success' : status.status === 'failed' ? 'call-error' : 'call-warning'}`}
        >
          {status.status === 'placed'
            ? `The call request was accepted for ${status.recipientName}.`
            : status.reason}
        </div>
      ) : null}
    </section>
  );
}
