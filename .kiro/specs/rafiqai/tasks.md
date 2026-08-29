# Implementation Plan: RafiqAI

## Overview

Six hard-timeboxed tasks total exactly 180 minutes. Each task must leave the app in a more demoable
state. If a hard gate is missed, cut integration work rather than stealing time from rehearsal.

## Tasks

- [x] 1. Dependency and telephony risk spike (15 minutes)
  - Preserve the existing README and `.kiro` specifications while scaffolding the Next.js app.
  - Select compatible Next.js, React, OpenAI, TypeScript, and Tailwind versions; save exact versions
    and the lockfile rather than relying on unbounded `@latest` dependencies.
  - Add server-only environment handling for `OPENAI_API_KEY`, `VAPI_API_KEY`, and
    `VAPI_PHONE_NUMBER_ID`; confirm local env files are ignored.
  - Verify one minimal structured OpenAI response using the intended model.
  - Attempt one minimal Vapi call to Sarah's allow-listed number and verify the selected STT/TTS/voice
    stack can understand and speak both English and Arabic.
  - If the Vapi call or Arabic behavior is not proven by minute 15, keep voice optional and prioritize
    the visible English briefing fallback.
  - **Hard gate:** the app builds/starts, model access is known, and voice risk is classified.

- [x] 2. Build a no-network golden path (30 minutes; cumulative 45)
  - Create the prepared phone-bill text: $58 base service, $9 Premium Network Access Fee, $15 device
    protection, and $82 total.
  - Add seeded history for $58 → $67 → $82 and clearly label all comparison data as synthetic.
  - Implement deterministic trend, percentage, monthly-impact, and annual-impact calculations.
  - Add verified fallback extraction, findings, and English briefing for the prepared fixture.
  - Build a minimal page with Load demo bill, Analyze, evidence-backed findings, and briefing.
  - Display a prominent “Verified demo fallback” banner whenever fixture output is used.
  - **Hard gate:** by minute 45, the prepared document works end-to-end with no external network.

- [x] 3. Add the streamed concurrent pipeline and evidence UI (45 minutes; cumulative 90)
  - Define normalized extraction, finding, result, stage, and stream-event types.
  - Implement runtime guards/defaults for all external model output.
  - Implement NDJSON encoding plus a browser reader with carry-over buffering and final flush.
  - Add pending/running/done/failed/fallback stage states and show the three checks in one row.
  - Wire anomaly, market, and plain-language check contracts through `Promise.allSettled`; emit all
    three running events before awaiting them.
  - Merge and sort findings locally with exact evidence, explanation, potential impact, action,
    severity, and source.
  - Emit an explicit complete event and preserve partial results after a failed check or disconnect.
  - **Hard gate:** the UI visibly demonstrates concurrency and produces useful evidence-backed output.

- [x] 4. Connect live OpenAI analysis (25 minutes; cumulative 115)
  - Implement one structured extraction call and the three independent check calls using the model
    verified in Task 1.
  - Inject only relevant synthetic market rows into the market-check prompt; do not add web search or
    a model tool-call loop.
  - Apply 8–12 second deadlines and a 25–30 second overall analysis budget.
  - On model failure, use verified fallback only for the prepared fixture or explicit safe mode and
    label it in every affected event.
  - Ensure arbitrary text cannot receive the prepared bill's fallback findings.
  - **Hard gate:** complete one live run; if it is unstable, retain transparent safe mode for the demo.

- [x] 5. Add the manually triggered English/Arabic voice call (20 minutes; cumulative 135)
  - Add a prominent Call Sarah button that appears only after analysis; never call automatically.
  - Implement a server-side call route that accepts a recipient ID, resolves Sarah's number locally,
    and rejects every non-allow-listed recipient.
  - Configure the agent to greet in English, switch to Arabic when the callee speaks or requests
    Arabic, remain in Arabic while the callee does, and optionally switch back with the callee.
  - Keep the agent grounded in supplied findings and prohibit invented savings or carrier policies.
  - On missing credentials, timeout, or provider error, show the English briefing and Retry without
    changing the successful analysis state.
  - Do not add transcript polling.
  - **Hard gate:** either one bilingual call succeeds or the English briefing fallback is presentation-ready.

- [x] 6. Harden and rehearse only (45 minutes; cumulative 180)
  - Stop adding features at minute 135.
  - Run the production build/type-check and fix only blocking errors.
  - Confirm credentials and Sarah's phone number never reach client bundles, stream events, or logs.
  - Confirm no submitted document is persisted and the UI discloses OpenAI/Vapi data transfer.
  - Rehearse the five-minute script once with live OpenAI and the live call: the agent greets in
    English, Sarah asks in Arabic about the Premium Network Access Fee, and the agent answers in Arabic.
  - Rehearse again with safe mode and Vapi unavailable; verify the fallback banner and English
    briefing are obvious and the analysis still completes.
  - Fix only failures exposed by those rehearsals, then repeat the affected path once.
  - Set phone volume, disable call screening/silent mode, prevent laptop sleep, and frame the browser
    so the three concurrent checks and findings remain visible.
  - **Done when:** both online and degraded-mode demos complete coherently in under five minutes.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"], "description": "Dependency and telephony risk spike" },
    { "wave": 2, "tasks": ["2"], "description": "No-network golden path" },
    { "wave": 3, "tasks": ["3"], "description": "Streamed concurrent pipeline" },
    { "wave": 4, "tasks": ["4"], "description": "Live OpenAI analysis" },
    { "wave": 5, "tasks": ["5"], "description": "Manual voice call" },
    { "wave": 6, "tasks": ["6"], "description": "Hardening and rehearsals" }
  ]
}
```

Tasks are intentionally sequential so every hard gate leaves a presentable fallback path.

## Notes

### Cut Rules

If any hard gate is missed, cut in this order:

1. Decorative animation and chart polish
2. Live model-generated market wording; retain seeded local comparison and label it
3. Live model-generated plain-language wording; retain verified fallback wording
4. Live voice; retain the English briefing and explain the designed language-switch behavior

Never cut the one-document narrative, visible concurrent checks, exact evidence, cautious potential
impact, transparent fallback label, allow-list, or final rehearsals.