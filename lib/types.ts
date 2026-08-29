export type StageId = 'extract' | 'anomaly' | 'market' | 'plain' | 'trend' | 'merge';
export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'fallback';
export type Severity = 'warning' | 'info';
export type AnalysisMode = 'live' | 'fallback' | 'partial';
export type FindingSource = 'anomaly' | 'market' | 'plain' | 'trend';
export type BillType = 'phone' | 'insurance' | 'medical' | 'other';
export type CarrierName = 'AT&T' | 'Verizon' | 'T-Mobile';
export type TrendDirection = 'increase' | 'flat' | 'decrease' | 'unknown';

export const BILL_TYPES: readonly BillType[] = ['phone', 'insurance', 'medical', 'other'] as const;
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

export interface HistoryPoint {
  label: string;
  amount: number;
  evidence: string;
}

export interface Extraction {
  vendor: string | null;
  accountHolder: string | null;
  billingPeriod: string | null;
  total: number | null;
  priorAmount: number | null;
  lineItems: LineItem[];
  history: HistoryPoint[];
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

export interface CarrierComparison {
  carrier: CarrierName;
  planName: string;
  monthlyPrice: number;
  potentialMonthlySavings: number;
  note: string;
  synthetic: true;
}

export interface AnalysisResult {
  mode: AnalysisMode;
  billType: BillType;
  findings: Finding[];
  trend: TrendPoint[];
  baselineAverage: number | null;
  baselinePointCount: number;
  currentVsAverageAmount: number | null;
  currentVsAveragePercent: number | null;
  trendDirection: TrendDirection;
  increasePercent: number;
  potentialMonthlyImpact: number;
  potentialAnnualImpact: number;
  carrierComparisons: CarrierComparison[];
  briefing: string;
  callToken: string | null;
  syntheticComparisonData: boolean;
}

export type StreamEvent =
  | { type: 'stage'; id: StageId; status: StageStatus; note?: string }
  | { type: 'result'; data: AnalysisResult }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'complete'; mode: AnalysisMode };

export type CallStatus =
  | { status: 'placed'; recipientName: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'unknown'; reason: string }
  | { status: 'failed'; reason: string };
