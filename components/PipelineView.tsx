import type { StageId, StageStatus } from '@/lib/types';

export interface StageView {
  id: StageId;
  label: string;
  description: string;
  status: StageStatus;
  note?: string;
}

const STATUS: Record<StageStatus, { label: string; className: string }> = {
  pending: { label: 'Waiting', className: 'status-waiting' },
  running: { label: 'In progress', className: 'status-running' },
  done: { label: 'Ready', className: 'status-ready' },
  failed: { label: 'Needs attention', className: 'status-failed' },
  fallback: { label: 'Demo result used', className: 'status-demo' },
};

function friendlyNote(stage: StageView): string | null {
  if (stage.note !== undefined) return stage.note;
  if (stage.status === 'fallback') {
    return 'The verified demo result was used because the live check was unavailable.';
  }
  if (stage.status === 'failed') {
    return 'This step could not finish. Any completed results will still appear below.';
  }
  return null;
}

export function PipelineView({ stages }: { stages: readonly StageView[] }) {
  const hasStarted = stages.some((stage) => stage.status !== 'pending');
  const completedCount = stages.filter((stage) => ['done', 'failed', 'fallback'].includes(stage.status)).length;
  return (
    <section aria-labelledby="progress-heading" className="panel progress-panel">
      <div className="section-heading">
        <span className="step-number" aria-hidden="true">3</span>
        <div>
          <h2 id="progress-heading">Review progress</h2>
          <p>{hasStarted ? 'Follow each check as it finishes.' : 'The review steps will appear here after you select Analyze bill.'}</p>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{completedCount} of {stages.length} review steps finished.</p>
      <ol className="pipeline-list">
        {stages.map((stage, index) => {
          const status = STATUS[stage.status];
          const note = friendlyNote(stage);
          return (
            <li key={stage.id} className={`pipeline-card ${status.className}`}>
              <span className="pipeline-number" aria-hidden="true">{index + 1}</span>
              <div className="pipeline-copy">
                <div className="pipeline-title-row">
                  <h3>{stage.label}</h3>
                  <span className="status-pill">{status.label}</span>
                </div>
                <p>{stage.description}</p>
                {note !== null ? <p className="stage-note">{note}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
