import type { StageId, StageStatus } from '@/lib/types';

export interface StageView {
  id: StageId;
  label: string;
  description: string;
  status: StageStatus;
  note?: string;
}

const STATUS_STYLE: Record<StageStatus, { badge: string; dot: string; text: string }> = {
  pending: { badge: 'border-slate-700 bg-slate-900/60', dot: 'bg-slate-600', text: 'Pending' },
  running: { badge: 'border-sky-500 bg-sky-950/50', dot: 'bg-sky-400 rafiq-running', text: 'Running' },
  done: { badge: 'border-emerald-600 bg-emerald-950/40', dot: 'bg-emerald-400', text: 'Done' },
  failed: { badge: 'border-rose-600 bg-rose-950/40', dot: 'bg-rose-400', text: 'Failed' },
  fallback: { badge: 'border-amber-500 bg-amber-950/40', dot: 'bg-amber-400', text: 'Fallback' },
};

function StageCard({ stage }: { stage: StageView }) {
  const style = STATUS_STYLE[stage.status];
  return (
    <li
      className={`rounded-lg border p-3 transition-colors ${style.badge}`}
      aria-label={`${stage.label}: ${style.text}`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
        <span className="text-sm font-medium text-slate-100">{stage.label}</span>
        <span className="ml-auto text-xs uppercase tracking-wide text-slate-400">{style.text}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{stage.description}</p>
      {stage.note ? <p className="mt-1 text-xs text-amber-300">{stage.note}</p> : null}
    </li>
  );
}

export function PipelineView({ stages }: { stages: readonly StageView[] }) {
  const extract = stages.find((stage) => stage.id === 'extract');
  const concurrent = stages.filter((stage) => ['anomaly', 'market', 'plain'].includes(stage.id));
  const local = stages.filter((stage) => ['trend', 'merge'].includes(stage.id));

  return (
    <section aria-label="Analysis pipeline" className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Pipeline</h2>

      {extract ? (
        <ul className="grid grid-cols-1">
          <StageCard stage={extract} />
        </ul>
      ) : null}

      <div>
        <p className="mb-1.5 text-xs text-slate-500">
          Three independent checks running concurrently
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {concurrent.map((stage) => (
            <StageCard key={stage.id} stage={stage} />
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-slate-500">Deterministic local calculation</p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {local.map((stage) => (
            <StageCard key={stage.id} stage={stage} />
          ))}
        </ul>
      </div>
    </section>
  );
}
