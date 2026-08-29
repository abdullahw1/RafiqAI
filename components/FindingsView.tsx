import type { AnalysisResult, Finding } from '@/lib/types';

const SOURCE_LABEL: Record<Finding['source'], string> = {
  trend: 'Local trend calculation',
  anomaly: 'Anomaly check',
  market: 'Synthetic market comparison',
  plain: 'Plain-language check',
};

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function TrendStrip({ result }: { result: AnalysisResult }) {
  const max = Math.max(...result.trend.map((point) => point.amount), 1);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-2xl font-semibold text-amber-300">
          ~{result.increasePercent}% increase
        </p>
        <p className="text-sm text-slate-300">
          Potential impact: up to{' '}
          <span className="font-semibold text-slate-100">
            {money(result.potentialMonthlyImpact)}/month
          </span>{' '}
          or{' '}
          <span className="font-semibold text-slate-100">
            {money(result.potentialAnnualImpact)}/year
          </span>
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Conditional on the charges turning out to be removable. Not a guaranteed saving or refund.
      </p>

      <ul className="mt-4 flex items-end gap-4" aria-label="Monthly totals">
        {result.trend.map((point) => (
          <li key={point.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs text-slate-300">{money(point.amount)}</span>
            <div
              className="w-full rounded-t bg-sky-700"
              style={{ height: `${Math.round((point.amount / max) * 72) + 8}px` }}
              aria-hidden="true"
            />
            <span className="text-xs text-slate-500">{point.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Account history is synthetic demonstration data.
      </p>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const isWarning = finding.severity === 'warning';
  return (
    <li
      className={`rounded-lg border p-4 ${
        isWarning ? 'border-amber-700/70 bg-amber-950/20' : 'border-slate-800 bg-slate-900/50'
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isWarning ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700/50 text-slate-300'
          }`}
        >
          {isWarning ? 'Worth questioning' : 'Context'}
        </span>
        <h3 className="text-base font-semibold text-slate-100">{finding.title}</h3>
      </div>

      <figure className="mt-3">
        <figcaption className="text-[10px] uppercase tracking-wide text-slate-500">
          Exact text from the bill
        </figcaption>
        <blockquote className="mt-1 overflow-x-auto rounded border border-slate-700 bg-slate-950/80 px-3 py-2 font-mono text-xs whitespace-pre text-emerald-200">
          {finding.evidence}
        </blockquote>
      </figure>

      <p className="mt-3 text-sm leading-relaxed text-slate-300">{finding.explanation}</p>

      {finding.potentialImpact ? (
        <p className="mt-2 text-sm text-amber-200">
          <span className="font-semibold">Potential impact:</span> {finding.potentialImpact}
        </p>
      ) : null}

      <p className="mt-2 text-sm text-sky-200">
        <span className="font-semibold">Safe next step:</span> {finding.action}
      </p>
      <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
        Source: {SOURCE_LABEL[finding.source]}
      </p>
    </li>
  );
}

export function FindingsView({ result }: { result: AnalysisResult }) {
  return (
    <section aria-label="Findings" className="space-y-4">
      <TrendStrip result={result} />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        {result.findings.length} finding{result.findings.length === 1 ? '' : 's'}
      </h2>
      <ul className="space-y-3">
        {result.findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Findings are informational and may be wrong. They identify charges worth questioning; they do
        not establish fraud, illegality, or a guaranteed refund.
      </p>
    </section>
  );
}
