import { SIGNIFICANT_INCREASE_PERCENT, baselineLabel } from '@/lib/billMath';
import type { AnalysisResult, Finding } from '@/lib/types';

const SOURCE_LABEL: Record<Finding['source'], string> = {
  trend: 'Bill history calculation',
  anomaly: 'Unexpected-change check',
  market: 'Cost comparison check',
  plain: 'Plain-language check',
};

function money(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function HistorySummary({ result }: { result: AnalysisResult }) {
  const current = result.trend.at(-1);
  const max = Math.max(...result.trend.map((point) => point.amount), 1);
  const hasComparison =
    current !== undefined &&
    result.baselinePointCount > 0 &&
    result.baselineAverage !== null &&
    result.currentVsAverageAmount !== null;
  const averageLabel = baselineLabel(result.baselinePointCount);
  const absoluteDifference = Math.abs(result.currentVsAverageAmount ?? 0);
  const absolutePercent = result.currentVsAveragePercent === null
    ? null
    : Math.abs(result.currentVsAveragePercent);
  const isSignificantIncrease =
    result.trendDirection === 'increase' &&
    absolutePercent !== null &&
    absolutePercent >= SIGNIFICANT_INCREASE_PERCENT;
  const summaryTitle = !hasComparison
    ? 'Your bill history at a glance'
    : isSignificantIncrease
      ? `${current.label} is exceptionally high compared with the ${averageLabel}`
      : result.trendDirection === 'increase'
        ? `${current.label} is slightly above the ${averageLabel}`
        : result.trendDirection === 'decrease'
          ? `${current.label} is below the ${averageLabel}`
          : `${current.label} matches the ${averageLabel}`;

  return (
    <section aria-labelledby="history-heading" className="summary-card">
      <p className="eyebrow">Your clearest finding</p>
      <h2 id="history-heading">{summaryTitle}</h2>
      {hasComparison ? (
        <p className="summary-lead">
          The {current.label} total is <strong>{money(current.amount)}</strong>—{' '}
          {result.trendDirection === 'flat' ? (
            <>the same as the {averageLabel} of <strong>{money(result.baselineAverage as number)}</strong>.</>
          ) : (
            <>
              <strong>{money(absoluteDifference)} {result.trendDirection === 'decrease' ? 'lower' : 'higher'}</strong>{' '}
              than the {averageLabel} of <strong>{money(result.baselineAverage as number)}</strong>
              {absolutePercent === null ? '.' : (
                <> ({absolutePercent}% {result.trendDirection === 'decrease' ? 'lower' : 'higher'}).</>
              )}
            </>
          )}
        </p>
      ) : (
        <p className="summary-lead">The document did not include enough earlier totals for a reliable comparison.</p>
      )}

      {result.trend.length > 0 ? (
        <div className="table-scroll">
          <table className="history-table">
            <caption>Monthly totals found in the bill</caption>
            <thead><tr><th scope="col">Month</th><th scope="col">Total</th><th scope="col">Relative amount</th></tr></thead>
            <tbody>
              {result.trend.map((point, index) => (
                <tr key={`${point.label}-${index}`} className={index === result.trend.length - 1 ? 'current-row' : undefined}>
                  <th scope="row">{point.label}{index === result.trend.length - 1 ? ' (current)' : ''}</th>
                  <td>{money(point.amount)}</td>
                  <td>
                    <div className="bar-track" role="img" aria-label={`${point.label}: ${money(point.amount)}`}>
                      <span className="bar-fill" style={{ width: `${Math.max(8, (point.amount / max) * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {isSignificantIncrease ? (
        <div className="why-box">
          <h3>Why this is unusual</h3>
          <p>
            The current total is about {absolutePercent}% above the {averageLabel}. That makes it
            worth checking which charges changed, even though an increase alone does not mean the bill is wrong.
          </p>
        </div>
      ) : null}
      {result.potentialMonthlyImpact > 0 ? (
        <p className="impact-note">
          If every questioned charge can be removed, the possible impact is up to{' '}
          <strong>{money(result.potentialMonthlyImpact)} a month</strong> or{' '}
          <strong>{money(result.potentialAnnualImpact)} a year</strong>. This is not guaranteed.
        </p>
      ) : null}
    </section>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <li className={`finding-card ${finding.severity === 'warning' ? 'finding-warning' : ''}`}>
      <p className="finding-label">{finding.severity === 'warning' ? 'Worth asking about' : 'Helpful context'}</p>
      <h3>{finding.title}</h3>
      <div className="finding-section">
        <h4>Why it may be unusual</h4>
        <p>{finding.explanation}</p>
      </div>
      {finding.potentialImpact ? <p className="impact-note"><strong>Possible impact:</strong> {finding.potentialImpact}</p> : null}
      <details className="evidence-details">
        <summary>View evidence and source</summary>
        <blockquote>{finding.evidence}</blockquote>
        <p><strong>Source:</strong> {SOURCE_LABEL[finding.source]}</p>
      </details>
    </li>
  );
}

function Comparisons({ result }: { result: AnalysisResult }) {
  if (result.billType !== 'phone' || result.carrierComparisons.length === 0) return null;
  return (
    <section aria-labelledby="comparison-heading" className="panel results-section">
      <div className="section-heading">
        <span className="step-number" aria-hidden="true">5</span>
        <div>
          <h2 id="comparison-heading">Phone plan comparisons</h2>
          <p>These figures are invented for this demo. They are not live prices or offers.</p>
        </div>
      </div>
      <div className="comparison-grid">
        {result.carrierComparisons.map((comparison) => (
          <article key={comparison.carrier} className="comparison-card">
            <p className="synthetic-label">Synthetic demo estimate</p>
            <h3>{comparison.carrier}</h3>
            <p className="comparison-price">{money(comparison.monthlyPrice)}<span> / month</span></p>
            <p>Possible difference from this bill: {money(comparison.potentialMonthlySavings)} a month.</p>
            <p className="small-note">{comparison.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
export function FindingsView({ result }: { result: AnalysisResult }) {
  const actions = [...new Set(result.findings.map((finding) => finding.action).filter(Boolean))];

  return (
    <section aria-labelledby="findings-heading" className="results-stack">
      <div className="section-heading result-heading">
        <span className="step-number" aria-hidden="true">4</span>
        <div>
          <h2 id="findings-heading">What the review found</h2>
          <p>{result.findings.length} item{result.findings.length === 1 ? '' : 's'} to consider.</p>
        </div>
      </div>

      <HistorySummary result={result} />

      {result.findings.length > 0 ? (
        <section aria-labelledby="details-heading" className="panel results-section">
          <h2 id="details-heading">Why these charges may be unusual</h2>
          <ul className="finding-list">
            {result.findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
          </ul>
        </section>
      ) : null}

      <Comparisons result={result} />

      <section aria-labelledby="next-heading" className="panel next-steps">
        <h2 id="next-heading">What to do next</h2>
        {actions.length > 0 ? (
          <ol>
            {actions.map((action) => <li key={action}>{action}</li>)}
          </ol>
        ) : (
          <p>Keep the bill nearby and ask the provider to explain any amount you do not recognize.</p>
        )}
        <p className="small-note">
          Use the official contact information printed on the bill. These findings are informational and may be wrong;
          they do not prove fraud or guarantee a refund.
        </p>
      </section>
    </section>
  );
}
