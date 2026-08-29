# RafiqAI

**Understand a confusing phone bill. Then get a phone call explaining what to question.**

RafiqAI helps caregivers protect family members from confusing household charges. Yusuf submits his
mother Sarah's English-language mobile bill; RafiqAI identifies unusual changes, compares charges
with seeded reference data, explains the evidence plainly, and can call Sarah so she can ask
follow-up questions without installing an app.

> **Status:** MVP implemented. The app builds, runs, and completes the full analysis flow offline in
> safe mode. Live model analysis and voice calling activate when credentials are supplied.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in what you have; all keys are optional
npm run dev                  # http://localhost:3000
```

With no keys at all, the prepared demo bill still runs end-to-end through the verified fallback and
is labelled as such. Set `DEMO_SAFE_MODE=true` to force the fallback with zero network calls.

| Variable | Effect when omitted |
|---|---|
| `OPENAI_API_KEY` | Prepared bill uses verified fallback; arbitrary text returns a readable error |
| `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID` | Call returns `unavailable`; the English briefing is shown |
| `SARAH_PHONE_NUMBER` | Same as above; no outbound destination is resolvable |

`OPENAI_API_KEY` accepts either an OpenAI key or an Anthropic `sk-ant-` key. Leave
`OPENAI_MODEL` blank to select the matching default automatically (`gpt-4o-mini` for OpenAI or
`claude-sonnet-4-5` for Anthropic), or set a model from the same provider. Live analysis also
requires available provider credits. `SARAH_PHONE_NUMBER` is normalized to E.164, so `(408) 555-0311` and `+14085550311` both work.

```bash
npm test        # 26 unit tests over the deterministic math, merge, validation, and fallback
npm run build   # production build and type-check
```


## Three-hour MVP

The MVP intentionally supports one excellent scenario rather than several incomplete categories:

- Pasted text from one prepared mobile-phone bill
- One structured extraction call
- Three genuine concurrent checks: anomaly, market comparison, and plain-language explanation
- Local trend and potential-impact calculations
- Evidence-backed findings and an English briefing
- A manually triggered Vapi call to an allow-listed recipient
- Transparent fallback modes for failed model or telephony services

Medical bills, government/scam letters, leases, warranties, uploads, OCR, and additional recipients
are roadmap items, not implemented MVP features.

## Golden demo scenario

Sarah's base mobile service costs **$58**. A **$9 Premium Network Access Fee** appears the next month,
then a **$15 device-protection add-on** appears after that:

| Period | Total | Change |
|---|---:|---|
| June | $58 | Base service |
| July | $67 | $9 access fee added |
| August | $82 | $15 protection add-on added |

RafiqAI describes the $24/month as **charges worth questioning**, not guaranteed savings. If both
charges prove removable, the potential impact is **up to $288/year**.

## How analysis works

```text
Pasted bill
  → structured extraction
  → three concurrent checks
      • anomaly and unexpected-change detection
      • comparison with synthetic seeded reference data
      • plain-language explanation
  → local trend and potential-impact calculation
  → evidence-backed findings and English briefing
  → optional manual call to Sarah
```

Each finding shows the exact bill text that supports it, what it may mean, its potential impact, and
a safe next step. The three checks are separate concurrent model calls; trend math and result merging
are deterministic local code.

## Voice behavior

The voice agent starts every call in English. If Sarah speaks Arabic or asks to continue in Arabic,
the agent switches to Arabic for subsequent responses. If she returns to English, it may switch back.
The configured speech-to-text, model, text-to-speech, and voice must all support both languages.

The MVP has no language selector. If Vapi is unavailable, RafiqAI displays the English briefing and a
Retry button; analysis remains successful.

## Demo reliability

- Calling is manual, never automatic.
- Sarah's phone number is stored server-side and is the only allowed outbound destination.
- Model stages use short deadlines and return partial results when one concurrent check fails.
- The prepared fixture has a verified fallback for explicit safe mode or model failure.
- Fallback output is always labelled **Verified demo fallback** and is never presented as live AI.
- The stream emits an explicit completion event, and the client buffers partial NDJSON lines.

## Privacy and safety

The prototype runs on localhost, has no authentication, and does not persist documents. However,
document text is sent to the configured OpenAI provider, and briefing/call content is sent to Vapi
and its configured speech/model providers. Do not use real sensitive bills during the demo.

Seeded market comparisons are synthetic demonstration data. Findings are informational and may be
wrong. They identify charges worth questioning; they do not guarantee refunds, savings, or fraud.

## Five-minute demo

| Time | Beat |
|---|---|
| 0:00 | Introduce Yusuf helping Sarah understand an English phone bill |
| 0:25 | Load the prepared bill and start analysis |
| 0:45 | Show three checks running concurrently |
| 1:20 | Reveal the 41% increase, exact fee evidence, and up-to-$288/year potential impact |
| 2:10 | Click **Call Sarah**; the agent greets her in English |
| 2:40 | Sarah asks in Arabic about the access fee; the agent answers in Arabic |
| 4:00 | Explain allow-listing, synthetic data, graceful fallback, and privacy boundaries |
| 4:35 | Close with the caregiver/no-app value proposition and roadmap |

## Implementation layout

```text
app/page.tsx              paste input, buffered NDJSON reader, stage row, findings, briefing
app/api/analyze/route.ts  NDJSON pipeline: extraction → 3 concurrent checks → local math → merge
app/api/call/route.ts     allow-list validation then one Vapi outbound call
lib/                      openai, extract, checks, billMath, merge, validate, fallback, stream, vapi
components/               PipelineView, FindingsView, CallControls
data/                     prepared bill, synthetic seed data, server-only recipient allow-list
tests/                    unit tests for the deterministic and safety-critical local logic
.kiro/specs/rafiqai/      requirements, design, and implementation plan
```

Implementation order and hard timeboxes are in `.kiro/specs/rafiqai/tasks.md`.

## Roadmap

After the hackathon MVP is reliable, the same caregiver-first interaction can expand to medical
bills, suspicious official letters, lease renewals, warranties, uploads, and additional languages.
Those extensions require sourced reference data, stronger privacy controls, and domain-specific
safety review.