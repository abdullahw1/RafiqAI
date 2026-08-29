export type StageId = 'extract' | 'anomaly' | 'market' | 'plain' | 'trend' | 'merge';
export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'fallback';
export type Severity = 'warning' | 'info';
export type AnalysisMode = 'live' | 'fallback' | 'partial';
export type FindingSource = 'anomaly' | 'market' | 'plain' | 'trend';

export const STAGE_IDS: readonly StageId[] = [
  'extract',
  'anomaly',
  'market',
  'plain',
  'trend',
  'merge',
] as const;

export const CONCURRENT_STAGE_IDS: readonly StageId[] = ['anomaly', 'market', 'plain'] as const;

export interface LineItem {
  label: string;
  amount: number | null;
  evidence: string;
}

export interface Extraction {
  vendor: string | null;
  accountHolder: string | null;
  billingPeriod: string | null;
  total: number | null;
  priorAmount: number | null;
  lineItems: LineItem[];
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  evidence: string;
  explanation: string;
  potentialImpact: string | null;
  action: string;
  source: FindingSource;
}

export interface TrendPoint {
  label: string;
  amount: number;
}

export interface AnalysisResult {
  mode: AnalysisMode;
  findings: Finding[];
  trend: TrendPoint[];
  increasePercent: number;
  potentialMonthlyImpact: number;
  potentialAnnualImpact: number;
  briefing: string;
  syntheticComparisonData: true;
}

export type StreamEvent =
  | { type: 'stage'; id: StageId; status: StageStatus; note?: string }
  | { type: 'result'; data: AnalysisResult }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'complete'; mode: AnalysisMode };

export type CallStatus =
  | { status: 'placed'; recipientName: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'failed'; reason: string };
