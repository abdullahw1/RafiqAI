# RafiqAI

**Upload a confusing document. Get a phone call explaining it in your language.**

RafiqAI reads any household document — a phone bill, a medical bill, a scam-looking government
letter — checks it for scams, errors, and bad deals through a pipeline of specialist AI agents, then
calls you back and explains what it found in plain language, in the language you picked. Built for
anyone who's ever stared at a bill and thought "wait, is this right?" — especially elderly and
non-native-English-speaking family members, who get taken advantage of the most.

Status: hackathon prototype. Localhost only, no auth, no database.

---

## Pre-demo checklist

Run this list before presenting. In order.

- [ ] `.env.local` populated with all three keys
- [ ] `npm run dev` up, page loads clean
- [ ] All three "Load demo document" buttons verified
- [ ] One full practice run completed end-to-end
- [ ] Phone **off silent**, on speaker, volume up
- [ ] Browser zoom set so every pipeline stage card fits on screen at once

---

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

`.env.local` (server-side only, never exposed to the browser, gitignored):

```
OPENAI_API_KEY=
VAPI_API_KEY=
VAPI_PHONE_NUMBER_ID=
```

Demo phone numbers live in `data/seed.json` under `household`. That list doubles as the outbound-dial
allow-list — `/api/call` refuses any number not in it.

**Without `VAPI_API_KEY` the app still works.** It drops to findings-only mode: everything renders on
screen and the voice briefing is shown as text. Useful when conference wifi eats your telephony.

---

## How it works

```
Document (pasted text or image/PDF)
   ↓
1  Extraction agent            →  structured JSON: sender, amounts, line items, dates, codes
2  Category specialist         →  domain checks + check_market_data tool
3  Three cross-checks IN PARALLEL
      • Anomaly / scam detector
      • Market comparator      (vs. seeded fair-price data)
      • Plain-language translator
4  History / trend agent       →  creeping increases across prior months
5  Synthesis agent             →  prioritized findings + a voice briefing
6  Voice delivery (Vapi)       →  outbound call, conversational, handles follow-up questions
```

Stage 3 is genuinely three concurrent model calls, not one prompt pretending to be three agents. The
UI streams stage status live so you can watch them fire together.

The government-letter fraud rule is enforced **in code**, not by the model: urgency + gift-card/wire
demand + arrest or legal threat, co-occurring, is a hard-coded critical flag. Deterministic on stage.

## Document categories

| Category | Status | Checks |
|---|---|---|
| Phone / Internet / Utility bill | Built | Promo expiry, junk fees, unneeded add-ons, price vs. market |
| Medical bill / EOB | Built | Billed vs. fair-price range by code, jargon translation, appeal likelihood |
| Government / official letter | Built | Scam-pattern detection, what action is actually required and by when |
| Lease / rent renewal | **Stub** | Rent increase vs. local average, predatory clause flagging |
| Warranty / claim denial | **Stub** | Plain-language denial reason, whether it's worth appealing |

Categories 4 and 5 appear as real buttons but are deliberately unbuilt — scoped out to keep the three
strongest categories genuinely working. They're marked "Coming soon" in the UI rather than faked.

## 5-minute demo script

| Time | Beat |
|---|---|
| 0:00 | Problem framing — Yusuf, 34, manages paperwork for his mother Sarah, 68, limited English |
| 0:30 | Government letter for Sarah, Urdu callback → deterministic **fraudulent** flag |
| 1:30 | Phone bill for Yusuf → parallel agents light up, trend chart shows $58 → $67 → $82, junk fee caught |
| 3:00 | Answer the phone on speaker. Ask live: "what's a premium network access fee?" |
| 4:15 | Transcript in UI, name the stubbed categories honestly, business model one-liner |

Business model (pitch only, not built): freemium — free occasional checks, subscription for ongoing
household monitoring and history, optional take-rate on identified savings.

---

## Project layout

```
app/       page.tsx (single-screen UI), api/analyze (streaming orchestrator), api/call (Vapi)
lib/       agents/ (extract, specialists, crosschecks, trend, synthesize), openai, vapi, stream
components/ CategoryPicker, DocumentInput, RecipientPicker, PipelineView, FindingsList, TrendChart, CallPanel
data/      seed.json (household, market data, history), demoDocs.ts
.kiro/specs/rafiqai/  requirements.md, design.md, tasks.md
```

```bash
npx vitest run    # unit tests: market math, scam predicate, history lookup, stream writer
npm run build     # type check
```

Tests cover pure logic only — prompt-heavy agents and UI are verified by the demo run-through.
Rationale in `.kiro/specs/rafiqai/design.md` §8.

## Known limitations

- No authentication. Binds to localhost; don't expose the port.
- No persistence — history is seeded JSON, runs are in-memory and lost on restart.
- Outbound calling is restricted to the `data/seed.json` allow-list. Keep it that way.
- Uploaded documents are held in memory for the request only, never written to disk.
- Not medical, legal, or financial advice. Findings are AI-generated and can be wrong.
