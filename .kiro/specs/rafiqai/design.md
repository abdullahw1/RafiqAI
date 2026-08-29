# RafiqAI — Design

## 1. Stack decision

**Next.js 15 (App Router) + TypeScript + Tailwind CSS, single process, `localhost:3000`.**

Why this and not something else, given a 3-hour budget:

| Concern | Decision | Rationale |
|---|---|---|
| Frontend + backend | One Next.js app | No CORS, no second process, no separate deploy story. Route handlers are the backend. |
| Streaming progress | POST route handler returning a `ReadableStream` of NDJSON | Native to Next route handlers. Avoids WebSockets and avoids a run-store + second SSE connection. |
| Styling | Tailwind only, no component library | `shadcn` CLI + registry costs 15+ minutes and adds files to review. Tailwind classes are enough. |
| Chart | Hand-rolled inline SVG sparkline (~30 lines) | Faster than installing and learning Recharts; zero dependency risk. |
| LLM | `openai` SDK | Vision, JSON mode, and tool calling in one client. |
| Voice | Vapi REST (`POST /call`) via `fetch` | No SDK needed for outbound calls. |
| Persistence | `data/seed.json` (read-only) + in-memory `Map` for run history | A DB buys nothing for a 5-minute demo. |
| Tests | Vitest, unit tests on pure logic only | See §8. Do not chase 80% coverage here. |

Node 20+. Package manager: npm.

## 2. Architecture

```
Browser (app/page.tsx)
  │  POST /api/analyze  (FormData: category, text?, file?, concern?, recipientId, language)
  ▼
Route handler  ──── streams NDJSON events ────▶  Browser updates stage cards live
  │
  ├─ Stage 1  extract()                 gpt-4o (vision) | text passthrough → JSON
  ├─ Stage 2  specialist(category)      category-specific prompt + check_market_data tool
  ├─ Stage 3  Promise.allSettled([      ← the "multi-agent moment", genuinely concurrent
  │             scamDetector(),
  │             marketComparator(),
  │             plainLanguage() ])
  ├─ Stage 4  trendAgent()              seeded prior docs; skipped if none
  ├─ Stage 5  synthesize()              → { findings[], briefing }
  └─ Stage 6  POST /api/call            Vapi outbound; non-blocking, failure is non-fatal
```

Every stage emits `{type:"stage", id, status}` before and after it runs. Stage 3 emits three
`running` events before awaiting, so all three cards light up simultaneously on screen.

## 3. File layout

```
app/
  layout.tsx
  page.tsx                    # single-screen UI
  api/analyze/route.ts        # streaming orchestrator
  api/call/route.ts           # Vapi outbound + transcript fetch
components/
  CategoryPicker.tsx
  DocumentInput.tsx           # paste textarea + demo loaders + file input
  RecipientPicker.tsx         # recipient + language selects
  PipelineView.tsx            # stage cards, parallel row for stage 3
  FindingsList.tsx
  TrendChart.tsx              # inline SVG
  CallPanel.tsx               # call status + transcript
lib/
  types.ts                    # shared types (§4)
  openai.ts                   # client + jsonCall() helper w/ retry + 25s timeout
  agents/extract.ts
  agents/specialists.ts       # 3 category prompts + dispatch map
  agents/crosschecks.ts       # scam / market / plain-language
  agents/trend.ts
  agents/synthesize.ts
  marketData.ts               # check_market_data tool impl
  history.ts                  # seeded prior docs lookup
  vapi.ts
  stream.ts                   # NDJSON event writer
data/
  seed.json                   # household, marketData, history
  demoDocs.ts                 # 3 prepared demo document texts
```

Keep every file under ~200 lines. Prompts live as exported string constants next to their agent.

## 4. Data model (`lib/types.ts`)

```ts
export type Category = 'bill' | 'medical' | 'government' | 'lease' | 'warranty';
export type Language = 'en' | 'ur' | 'es';
export type Severity = 'critical' | 'warning' | 'info';
export type StageId =
  | 'extract' | 'specialist' | 'scam' | 'market' | 'plain' | 'trend' | 'synthesis' | 'call';
export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface LineItem { label: string; amount: number | null; note?: string }

export interface Extraction {
  sender: string | null;
  addressee: string | null;
  totalAmount: number | null;
  lineItems: LineItem[];
  keyDates: { label: string; date: string }[];
  codes: string[];        // CPT-style codes, denial codes, statute refs
  clauses: string[];      // contract/legal clauses worth flagging
  rawSummary: string;
}

export interface Finding {
  severity: Severity;
  title: string;          // one line, plain language
  detail: string;         // 1–2 sentences
  source: StageId;        // which agent produced it — shown as a badge in the demo
}

export interface Synthesis {
  concernAnswer: string | null;   // present iff user typed a concern
  findings: Finding[];            // ordered: critical → warning → info
  briefing: string;               // context doc for the voice agent
}

export type StreamEvent =
  | { type: 'stage'; id: StageId; status: StageStatus; note?: string }
  | { type: 'extraction'; data: Extraction }
  | { type: 'trend'; data: { label: string; amount: number }[] }
  | { type: 'synthesis'; data: Synthesis }
  | { type: 'call'; data: { callId: string | null; status: string; error?: string } }
  | { type: 'error'; message: string };
```

Immutability: agents are pure `async (input) => output`; the orchestrator builds a new context
object per stage rather than mutating a shared accumulator.

## 5. Seed data (`data/seed.json`)

```json
{
  "household": [
    { "id": "yusuf", "name": "Yusuf Ali", "phone": "+1XXXXXXXXXX", "relation": "self" },
    { "id": "sarah", "name": "Sarah Ali", "phone": "+1XXXXXXXXXX", "relation": "mother" }
  ],
  "marketData": {
    "bill": [
      { "item": "unlimited talk+text+data, 2 lines", "fairRange": [70, 95], "unit": "USD/mo" },
      { "item": "premium network access fee", "fairRange": [0, 0], "note": "junk fee; not a government charge" },
      { "item": "device protection add-on", "fairRange": [0, 17] },
      { "item": "home internet 300Mbps", "fairRange": [45, 70] }
    ],
    "medical": [
      { "item": "99213 office visit, established patient", "fairRange": [90, 180] },
      { "item": "80053 comprehensive metabolic panel", "fairRange": [15, 60] },
      { "item": "71046 chest X-ray, 2 views", "fairRange": [45, 120] }
    ],
    "lease": [{ "item": "1BR Bay Area renewal increase", "fairRange": [2, 6], "unit": "percent" }]
  },
  "history": {
    "bill:yusuf": [
      { "label": "Jun", "amount": 58.0 },
      { "label": "Jul", "amount": 67.0 },
      { "label": "Aug", "amount": 82.0 }
    ],
    "medical:sarah": [
      { "label": "Mar visit", "amount": 145.0 },
      { "label": "Jun visit", "amount": 160.0 }
    ]
  }
}
```

History key = `${category}:${recipientId}`. Missing key → stage 4 emits `skipped`.

Phone numbers double as the R6.4 allow-list: `api/call` refuses any number not in `household`.

## 6. Agent contracts

| Agent | Model | Output |
|---|---|---|
| `extract` | `gpt-4o` (vision) / `gpt-4o-mini` (text) | `Extraction`, JSON mode, 1 retry |
| `specialist` | `gpt-4o-mini` + `check_market_data` tool | `Finding[]` |
| `scamDetector` | `gpt-4o-mini` | `Finding[]` |
| `marketComparator` | `gpt-4o-mini` + `check_market_data` tool | `Finding[]` |
| `plainLanguage` | `gpt-4o-mini` | `{ glossary: {term, plain}[] }` |
| `trend` | `gpt-4o-mini` | `Finding[]` + series for the chart |
| `synthesize` | `gpt-4o` | `Synthesis` |

Government-letter scam rule is enforced in code, not left to the model: if the extraction/scam output
indicates urgency AND (gift card OR wire transfer) AND (arrest OR legal threat), the orchestrator
injects a hard-coded `critical` finding. Deterministic behavior for the demo's money moment.

`jsonCall()` wraps every call with: `response_format: json_object`, 25 s `AbortSignal.timeout`,
one retry on parse failure, and it throws a typed `AgentError` carrying the stage id.

## 7. Voice layer

`POST /api/call` body: `{ recipientId, language, briefing }`.

1. Validate `recipientId` against `household` (reject otherwise, 400).
2. `POST https://api.vapi.ai/call` with `phoneNumberId`, `customer.number`, and a transient
   assistant: `model.messages[0].content = briefing + languageInstruction`,
   `voice` chosen per language, `firstMessage` a short localized greeting.
3. Return `callId`. UI polls `GET /api/call?id=` every 3 s for status + transcript.
4. Missing `VAPI_*` env vars → return `{ callId: null, status: 'unavailable' }`; UI shows the briefing
   text plus a Retry button (R6.6). The demo survives without telephony.

Env (`.env.local`, server-only, gitignored):
`OPENAI_API_KEY`, `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`.

## 8. Testing posture (deliberate deviation, stated plainly)

The standing 80%-coverage rule is not achievable or useful inside a 3-hour build whose surface is
mostly LLM prompts and UI. What gets tested with Vitest:

- `marketData.check_market_data` lookup + deviation math
- the deterministic scam-rule predicate
- `history` key lookup incl. the missing-history skip path
- the NDJSON stream writer

Everything else is verified by running the demo script end-to-end (Task 6). No LLM calls in tests.

## 9. Demo choreography (5 minutes)

| Time | Beat |
|---|---|
| 0:00–0:30 | Problem framing: Yusuf + Sarah. |
| 0:30–1:30 | Government letter for Sarah, Urdu callback → deterministic **fraudulent** flag. |
| 1:30–3:00 | Phone bill for Yusuf → parallel agents light up, trend chart shows $58→$67→$82, junk fee flagged. |
| 3:00–4:15 | Answer the phone on speaker; ask "what's a premium network access fee?" live. |
| 4:15–5:00 | Show transcript in UI, name the stubbed categories honestly, business model one-liner. |

Pre-demo checklist: `.env.local` populated, phone off silent, demo doc buttons verified, one full
practice run completed, browser zoom set so all stage cards fit on screen.
