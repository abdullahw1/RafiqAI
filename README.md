# RafiqAI

**Understand a confusing household bill. Then get a phone call explaining what to question.**

RafiqAI helps caregivers protect family members from confusing household charges. Yusuf submits his
mother Sarah's English-language bill—as a PDF or pasted text—and RafiqAI identifies unusual changes,
compares charges with seeded reference data, explains the evidence plainly, and can call Sarah so she
can ask follow-up questions without installing an app.

> **Status:** MVP implemented. The app builds, runs, and completes the full analysis flow. The
> prepared AT&T demo bill runs end-to-end offline through the verified fallback in safe mode. Live
> model analysis (any pasted or uploaded bill) and voice calling activate when credentials are
> supplied.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in what you have; all keys are optional
npm run dev                  # http://localhost:3000
```

With no keys at all, the prepared AT&T demo bill still runs end-to-end through the verified fallback
and is labelled as such. Any other bill needs live model credentials. Set `DEMO_SAFE_MODE=true` to
force the fallback with zero network calls; in safe mode only the prepared demo bill is analyzable.

| Variable | Effect when omitted |
|---|---|
| `OPENAI_API_KEY` | Prepared AT&T bill uses the verified fallback; any other bill returns a readable error |
| `OPENAI_MODEL` | Defaults to `gpt-4o-mini` for an OpenAI key or `claude-sonnet-4-5` for an `sk-ant-` key |
| `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`, `VAPI_ASSISTANT_ID` | **Call Sarah** returns `unavailable`; the English briefing is shown. No call token is issued |
| `VAPI_API_BASE_URL` | Defaults to `https://api.vapi.ai` |
| `SARAH_PHONE_NUMBER` | Call fails with "recipient unavailable"; the English briefing is shown |

`OPENAI_API_KEY` accepts either an OpenAI key or an Anthropic `sk-ant-` key; an Anthropic key is
routed to Anthropic's OpenAI-compatible endpoint. Leave `OPENAI_MODEL` blank to select the matching
default automatically, or set a model from the same provider. Live analysis also requires available
provider credits. `SARAH_PHONE_NUMBER` is normalized to E.164, so `(408) 555-0311` and `+14085550311`
both work.

```bash
npm test        # 34 unit tests over the deterministic math, merge, validation, PDF-name, and fallback logic
npm run build   # production build and type-check
```

## MVP scope

The MVP intentionally supports one excellent scenario well rather than several incomplete ones:

- One bill at a time, provided as a **PDF** (server-side text extraction) or **pasted text**
- Four declared bill categories: **phone, insurance, medical, other**
- One structured extraction call, then three genuine concurrent checks: anomaly, market comparison,
  and plain-language explanation
- Local trend and potential-impact calculations
- Evidence-backed findings and an English briefing
- A manually triggered Vapi call to a single allow-listed recipient, gated by a signed one-time token
- Transparent fallback modes for failed model or telephony services

The **verified offline fallback** is available only for the exact prepared AT&T phone bill; every
other bill (including other phone bills) requires live model credentials. Image-only/scanned PDFs,
OCR, medical-coding lookups, sourced market data, government/scam-letter and lease/warranty
categories, and additional recipients are roadmap items, not implemented MVP features.

## Golden demo scenario

The prepared bill is an **AT&T** wireless statement for **Sarah Rahman** with a six-month history:

| Period | Total | Change |
|---|---:|---|
| March | $57 | Base service |
| April – June | $58 | Base service |
| July | $67 | $9 Premium Network Access Fee added |
| August | $82 | $15 Device Protection Plus add-on added (enrolled Jul 28) |

RafiqAI reports the current total as **about 38% above** the previous five-month average of **$59.60**
($22.40 higher). It describes the **$24/month** in add-on charges as **worth questioning**, not
guaranteed savings. If both charges prove removable, the potential impact is **up to $288/year**.

## How analysis works

```text
PDF upload  → server-side text extraction (unpdf, in memory)   ─┐
Pasted text ─────────────────────────────────────────────────── ┤
                                                                ▼
  structured extraction
  → three concurrent model checks
      • anomaly and unexpected-change detection
      • comparison with synthetic seeded reference data (phone demo only)
      • plain-language explanation
  → local trend and potential-impact calculation
  → evidence-backed findings and an English briefing
  → optional manual call to Sarah (signed one-time call token)
```

The UI surfaces six stages as they finish: **extract, anomaly, market, plain, trend, merge**. The
anomaly/market/plain checks run as separate concurrent model calls; trend math and result merging are
deterministic local code. Each finding shows the exact bill text that supports it, what it may mean,
its potential impact, and a safe next step. Model-generated evidence is rejected unless it appears
verbatim in the submitted bill.

## PDF handling

`POST /api/extract-pdf` accepts exactly one `application/pdf` file (`.pdf` name required, valid `%PDF-`
signature). Limits: 10 MB, 25 pages, 40,000 extracted characters, 15 s extraction timeout. Text is
extracted in memory with `unpdf` (eval and scripting disabled) and returned to the browser; the PDF
and its text are never written to storage. Image-only PDFs with no extractable text are rejected with
a message pointing the user to paste text instead.

## Voice behavior

**Call Sarah** is enabled only when a `callToken` is present in the analysis result, which is issued
solely when Vapi is configured. The token is HMAC-signed with the Vapi key, single-use, expires after
10 minutes, and carries the briefing server-side; a per-recipient 2-minute cooldown throttles repeat
calls. Sarah's number is resolved from `SARAH_PHONE_NUMBER` on the server and is never sent to the
browser.

The voice agent starts every call in English. If Sarah speaks Arabic or asks to continue in Arabic,
the agent switches to Arabic for subsequent responses, and may switch back if she returns to English.
The configured speech-to-text, model, text-to-speech, and voice must all support both languages.
There is no language selector. If Vapi is unavailable, RafiqAI displays the English briefing and a
Retry button; analysis remains successful.

## Demo reliability

- Calling is manual, never automatic, and requires a fresh signed token from the latest analysis.
- Sarah's phone number is stored server-side and is the only allowed outbound destination.
- Model stages use short deadlines (11 s per stage, 28 s overall) and return partial results when one
  concurrent check fails.
- The prepared AT&T fixture has a verified fallback for explicit safe mode or model failure; it is
  matched by exact text so edited, pasted, or uploaded variants never receive demo data.
- Fallback output is always labelled **verified demo result** and is never presented as live AI.
- The stream emits an explicit completion event, and the client buffers partial NDJSON lines.

## Privacy and safety

The prototype runs on localhost, has no authentication, and does not persist documents or extracted
text. However, document text is sent to the configured model provider, and briefing/call content is
sent to Vapi and its configured speech/model providers. Do not use real sensitive bills during the
demo.

Seeded market comparisons are synthetic demonstration data and apply only to the prepared phone demo.
Findings are informational and may be wrong. They identify charges worth questioning; they do not
guarantee refunds, savings, or fraud.

## Five-minute demo

| Time | Beat |
|---|---|
| 0:00 | Introduce Yusuf helping Sarah understand an English AT&T phone bill |
| 0:25 | Load the AT&T demo (or select a PDF) and start the review |
| 0:45 | Show the six pipeline stages, with anomaly/market/plain running concurrently |
| 1:20 | Reveal the ~38% increase over the five-month average, exact fee evidence, and up-to-$288/year potential impact |
| 2:10 | Click **Call Sarah**; the agent greets her in English |
| 2:40 | Sarah asks in Arabic about the access fee; the agent answers in Arabic |
| 4:00 | Explain the single allow-listed recipient, one-time call token, synthetic data, graceful fallback, and privacy boundaries |
| 4:35 | Close with the caregiver/no-app value proposition and roadmap |

## Implementation layout

```text
app/page.tsx                  category select, PDF picker, paste box, buffered NDJSON reader, stages, findings, briefing
app/api/analyze/route.ts      NDJSON pipeline: extraction → 3 concurrent checks → local math → merge
app/api/extract-pdf/route.ts  validates and extracts text from an uploaded PDF (unpdf, in memory)
app/api/call/route.ts         call-token check, allow-list resolution, then one Vapi outbound call
lib/                          openai, prompt, extract, checks, billMath, merge, validate, fallback, stream, ndjsonClient, callToken, vapi, phone, types
components/                   PipelineView, FindingsView, CallControls
data/                         prepared AT&T bill, synthetic seed data, server-only recipient allow-list
tests/local.test.ts           unit tests for the deterministic and safety-critical local logic
.kiro/specs/rafiqai/          requirements, design, and implementation plan
```

Implementation order and hard timeboxes are in `.kiro/specs/rafiqai/tasks.md`.

## Roadmap

After the hackathon MVP is reliable, the same caregiver-first interaction can expand to OCR for
scanned/image-only bills, medical-coding lookups, suspicious official letters, lease renewals,
warranties, additional recipients, and more languages. Those extensions require sourced reference
data, stronger privacy controls, and domain-specific safety review.
