# RafiqAI — Tasks

6 tasks, 3-hour budget. Each task ends in a runnable, demoable state — if the clock runs out
mid-plan, whatever is finished is still presentable. Do them in order.

**Timeboxes are hard.** If a task overruns by 10 minutes, cut its optional items and move on.

---

## Task 1 — Scaffold + data foundation (25 min)

- [ ] `npx create-next-app@latest . --ts --tailwind --app --eslint --no-src-dir` (bind dev server to localhost)
- [ ] `npm i openai` · `npm i -D vitest`
- [ ] `.env.local` with `OPENAI_API_KEY`, `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`; confirm `.env*` is gitignored
- [ ] `lib/types.ts` — all types from design §4
- [ ] `data/seed.json` — household (real demo phone numbers), marketData, history from design §5
- [ ] `data/demoDocs.ts` — 3 prepared document texts: padded phone bill, denied medical EOB, gift-card scam letter
- [ ] `lib/openai.ts` — client + `jsonCall()` with JSON mode, 25 s timeout, 1 retry, typed `AgentError`
- [ ] `lib/marketData.ts` + `lib/history.ts` with deviation math and the missing-history skip path

**Done when:** `npm run dev` serves the default page and `node --experimental-strip-types` /a scratch
script can call `jsonCall()` successfully once.

_Covers R7.4, and the data half of R3.3/R3.4._

---

## Task 2 — Pipeline: extraction → specialist → parallel cross-checks (35 min)

- [ ] `lib/agents/extract.ts` — **text passthrough path first**, then the vision path (R2.4 retry included)
- [ ] `lib/agents/specialists.ts` — bill / medical / government prompts implementing every check in R4, plus the dispatch map; lease + warranty entries throw `NotImplemented`
- [ ] `lib/agents/crosschecks.ts` — `scamDetector`, `marketComparator` (tool-calling), `plainLanguage`
- [ ] Deterministic government scam predicate in code (design §6), unit-tested
- [ ] `lib/agents/trend.ts` and `lib/agents/synthesize.ts` — synthesis must put the user's concern answer first
- [ ] `lib/stream.ts` — NDJSON writer
- [ ] `app/api/analyze/route.ts` — orchestrator: stage events, `Promise.allSettled` for the three cross-checks (emit all three `running` before awaiting), `allSettled` so one failure doesn't kill the run

**Done when:** `curl -N -F category=bill -F text=@- -F recipientId=yusuf localhost:3000/api/analyze`
streams stage events and ends with a `synthesis` event containing findings.

_Covers R2, R3, R4._

---

## Task 3 — UI: intake + live pipeline + findings (40 min)

- [ ] `CategoryPicker` — 5 buttons, Lease/Warranty rendered but disabled with a visible "Coming soon" badge
- [ ] `DocumentInput` — paste textarea, 3 "Load demo document" buttons, file input (≤10 MB, image/PDF only), inline validation when both inputs are empty
- [ ] `RecipientPicker` — Self (Yusuf) / Mom (Sarah) + language select (English / Urdu / Spanish)
- [ ] `PipelineView` — stage cards with pending/running/done/failed/skipped states; the three cross-checks in one horizontal row so simultaneity is obvious on screen
- [ ] `page.tsx` — POST FormData, read the streamed NDJSON with a `fetch` body reader, reduce events into state
- [ ] `FindingsList` — severity colour, agent-source badge, ordered critical → info
- [ ] `TrendChart` — inline SVG sparkline, renders only when the trend event arrives

**Done when:** a full bill run and a full government-letter run both complete visually in the browser,
including the trend chart and findings. This is the demo's minimum viable state.

_Covers R1, R5._

---

## Task 4 — Voice callback (30 min)

- [ ] `lib/vapi.ts` — `placeCall({ phone, briefing, language })` against `POST /call`, transient assistant, per-language voice + greeting
- [ ] `app/api/call/route.ts` — POST validates `recipientId` against the `household` allow-list (400 otherwise); GET polls call status + transcript
- [ ] Orchestrator triggers the call after synthesis and emits the `call` event; failure is non-fatal
- [ ] `CallPanel` — call status, 3 s transcript polling, and the fallback view (briefing text + Retry) when Vapi is unavailable
- [ ] Verify the agent handles a live follow-up question ("what's a premium network access fee?") from the briefing context

**Done when:** the phone rings, the agent explains findings in the selected language, answers one
follow-up, and the transcript appears in the UI. Also verify with `VAPI_API_KEY` unset that the run
still succeeds in findings-only mode.

_Covers R6._

---

## Task 5 — Tests + hardening (20 min)

- [ ] Vitest unit tests: market-data lookup/deviation, scam predicate, history lookup + skip, stream writer
- [ ] Kill-switch check: with the network to Vapi blocked, the whole flow still finishes (R7.5)
- [ ] Confirm no secret is referenced from a client component; no uploaded file written to disk
- [ ] Friendly error surface for extraction failure and for any single failed cross-check
- [ ] `npm run build` clean, no type errors

**Done when:** `npx vitest run` green and `npm run build` succeeds.

_Covers R2.4, R3.9, R7.3–R7.5._

---

## Task 6 — Demo rehearsal + README (20 min)

- [ ] One full timed run-through of the design §9 choreography, out loud, with the phone on speaker
- [ ] Fix whatever the rehearsal exposes — nothing else
- [ ] README: one-liner, `.env.local` keys, `npm i && npm run dev`, the 5-minute demo script, and an honest note that Categories 4–5 are stubs
- [ ] Pre-demo checklist taped to the top of the README

**Done when:** the run-through lands under 5:00 with no unhandled error.

_Covers R7.1, R7.2._

---

## Cut list (in order, if time runs short)

1. Vision/file upload path — paste-text alone demos fine (R1.4 exists for exactly this)
2. Trend chart animation / styling polish
3. Spanish language option (keep English + Urdu)
4. Transcript polling — show the briefing text instead
5. Task 5 tests — but never Task 6 rehearsal

Never cut: the parallel cross-check visualization, the deterministic scam flag, or the outbound call.
Those three are the pitch.
