# RafiqAI — Design

## Overview

RafiqAI is a three-hour hackathon prototype focused on one reliable story. Yusuf pastes his mother
Sarah's English-language mobile bill. The system extracts its structure, runs three independent
checks concurrently, calculates the trend and potential impact locally, and presents findings with
exact evidence and a clear action. Yusuf may then manually trigger a Vapi call to Sarah.

The call starts in English. If Sarah speaks Arabic or explicitly requests Arabic, the voice agent
continues in Arabic; it may switch back when she returns to English. There is no language selector.

The prepared bill moves from $58 to $67 to $82 through a $9 Premium Network Access Fee followed by a
$15 device-protection add-on. The product calls these charges worth questioning and presents
$24/month or $288/year only as potential impact, never guaranteed savings.

## Architecture

```text
Browser
  │ POST /api/analyze { text }
  ▼
NDJSON route handler
  ├─ extract(text)                         one structured model call
  ├─ Promise.allSettled([
  │    anomalyCheck(extraction),           model call
  │    marketCheck(extraction, seedData),  model call
  │    plainLanguageCheck(extraction)      model call
  │  ])                                   genuinely concurrent
  ├─ calculateTrendAndImpact()             local deterministic logic
  ├─ mergeFindingsAndBriefing()            local deterministic logic
  └─ complete event

Browser
  │ user clicks “Call Sarah”
  ▼
POST /api/call → allow-list validation → Vapi outbound call
```

The analysis and call lifecycles are separate. Analysis never places a call automatically.

### Stack Decisions

- Next.js App Router, TypeScript, and Tailwind in one localhost process
- OpenAI SDK with one environment-configurable text model
- POST response streamed as NDJSON; no WebSockets or second SSE connection
- Direct Vapi REST calls; no Vapi SDK
- Read-only seeded JSON and deterministic local calculations; no database
- Inline CSS/SVG only where needed; no chart or component library
- Exact dependency versions and a lockfile recorded during the dependency spike

## Components and Interfaces

### `app/page.tsx`

Owns the prepared-document loader, paste input, analysis action, buffered NDJSON reader, stage state,
findings view, English briefing, and manual Call Sarah action. It does not receive phone numbers or
provider credentials.

### `app/api/analyze/route.ts`

Accepts JSON `{ text: string }`. It validates input, streams stage events, performs extraction, emits
all three concurrent `running` events before awaiting `Promise.allSettled`, runs local calculations,
and emits `result` followed by `complete`. It has an overall target budget of 25–30 seconds.

### Analysis modules

- `extract.ts`: structured extraction with runtime validation and normalization
- `checks.ts`: independent anomaly, market, and plain-language model calls
- `billMath.ts`: deterministic trend, percentage, monthly, and annual calculations
- `merge.ts`: de-duplicates and sorts findings, then builds the English briefing
- `fallback.ts`: verified outputs keyed to the normalized prepared fixture
- `stream.ts`: NDJSON event encoder

Prompts require concise JSON and exact evidence copied from the bill. Market reference rows are
injected from local synthetic seed data; no web search or fragile tool-call loop is required.

### `POST /api/call`

Accepts `{ recipientId: "sarah", briefing: string }`. The route resolves the phone number from
server-side seed data, rejects unknown recipients, and calls Vapi. It never accepts a destination
number from the browser.

The transient voice-agent instruction is conceptually:

```text
Begin in English. Explain only the supplied phone-bill findings.
If the callee speaks Arabic or explicitly asks for Arabic, respond in Arabic and continue in Arabic.
If the callee returns to English, you may switch back. Never invent charges, savings, or carrier policy.
When uncertain, recommend contacting the carrier through a verified number.
```

The first message is a short English greeting. The selected STT, model, TTS, and voice configuration
must support both English and Arabic before the live call is considered demo-ready. No transcript
polling is included in the MVP.

### Seed data

The seed file contains only:

- Sarah's server-side allow-listed number
- Synthetic history: June $58, July $67, August $82
- Synthetic reference notes for the access fee and device protection
- A clear `synthetic: true` marker consumed by the UI

### Demo fallback

A normalized hash or exact fixture identifier selects the verified fallback. Fallback may run only
when the input is the prepared document or `DEMO_SAFE_MODE` is explicitly enabled. Every fallback
stage and final result carries `mode: "fallback"`; the UI renders a persistent **Verified demo
fallback** banner. Arbitrary user text never receives prepared fixture findings.

## Data Models

```ts
export type StageId = 'extract' | 'anomaly' | 'market' | 'plain' | 'trend' | 'merge';
export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'fallback';
export type Severity = 'warning' | 'info';
export type AnalysisMode = 'live' | 'fallback' | 'partial';

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
  source: 'anomaly' | 'market' | 'plain' | 'trend';
}

export interface AnalysisResult {
  mode: AnalysisMode;
  findings: Finding[];
  trend: { label: string; amount: number }[];
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
```

The runtime validator rejects unknown severities/sources, clamps non-finite amounts to `null`, limits
string and array sizes, and requires each finding to include evidence present in the submitted text.

## Correctness Properties

### Property 1: No silent fallback

**Validates: Requirements 7.3, 7.4**

When `mode === "fallback"`, the persistent fallback banner is visible.

### Property 2: Fixture isolation

**Validates: Requirements 7.2, 7.5**

Fallback findings are returned only for the prepared normalized fixture or explicit safe mode.

### Property 3: True concurrency

**Validates: Requirements 3.1, 3.2**

All three check calls start and all three running events are emitted before results are awaited.

### Property 4: Partial progress

**Validates: Requirements 3.7, 5.6**

One rejected check cannot erase successful check outputs.

### Property 5: Evidence grounding

**Validates: Requirements 2.2, 3.6**

Every model-generated finding contains evidence found verbatim in the submitted bill.

### Property 6: Deterministic math

**Validates: Requirements 4.1, 4.2, 4.3**

The local calculations produce `$82 - $58 = $24`, `$24 × 12 = $288`, and an increase of approximately 41%.

### Property 7: Cautious claims

**Validates: Requirements 4.4, 8.5, 8.6**

The UI never converts potential impact into guaranteed savings.

### Property 8: Call control

**Validates: Requirements 6.1, 6.2, 6.3**

No call occurs without a user action, and no browser-supplied phone number is dialed.

### Property 9: Completion

**Validates: Requirements 5.5**

Every normally closed analysis stream emits exactly one complete event.

### Property 10: Secret boundary

**Validates: Requirements 8.1**

Provider credentials and Sarah's number never enter client props, events, or logs.

## Error Handling

- Empty input returns HTTP 400 before opening the stream.
- Extraction failure stops arbitrary-input analysis; prepared-fixture analysis may switch to labelled fallback.
- Each concurrent check has an 8–12 second deadline and is isolated with `Promise.allSettled`.
- Invalid model fields are normalized where safe; unusable outputs fail only their originating stage.
- The route targets a 25–30 second overall budget and preserves completed findings on timeout.
- The NDJSON client buffers incomplete records, ignores unknown event types, flushes the final buffer,
  and marks still-running stages failed on premature close.
- Missing Vapi configuration returns `unavailable`, not an analysis error.
- Vapi timeout or rejection preserves the result and shows the English briefing plus Retry.
- Provider error details are logged server-side without document text, secrets, or phone numbers; the
  browser receives a short safe message.

## Testing Strategy

No automated test-suite dependency is added during the three-hour MVP. Validation focuses on the
actual presentation paths:

1. Run the production build/type-check.
2. Rehearse the prepared bill with live model calls and a live Vapi call.
3. Verify the agent greets in English, understands an Arabic question, and answers in Arabic.
4. Rehearse with explicit safe mode and Vapi unavailable.
5. Confirm the fallback banner is persistent and the English briefing remains usable.
6. Confirm arbitrary input cannot receive prepared-fixture findings.
7. Inspect browser payloads/logs for accidental credentials or phone numbers.
8. Time both rehearsals and fix only failures that affect the five-minute demo.

## Demo Choreography

| Time | Beat |
|---|---|
| 0:00–0:25 | Yusuf helps Sarah understand an English bill without making her install an app |
| 0:25–0:45 | Load the prepared bill and start analysis |
| 0:45–1:20 | Three independent checks visibly run together |
| 1:20–2:10 | Show exact evidence, the 41% increase, and up-to-$288/year potential impact |
| 2:10–2:40 | Yusuf clicks Call Sarah; the agent greets in English |
| 2:40–4:00 | Sarah asks in Arabic about the access fee; the agent answers in Arabic |
| 4:00–4:35 | Show synthetic-data, allow-list, privacy, and fallback boundaries |
| 4:35–5:00 | Close on the caregiver/no-app value and roadmap |

The presenter keeps a completed result available in another tab, keeps the phone beside the laptop
with call screening disabled, and never starts a second analysis or second call during the demo.