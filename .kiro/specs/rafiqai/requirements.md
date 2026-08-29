# RafiqAI — Requirements

## Context

RafiqAI reads a confusing household document (phone bill, medical bill/EOB, official-looking
letter), checks it for scams, errors, and bad deals, then phones the user back and explains the
findings conversationally in their preferred language.

**Scope constraint:** hackathon build, 3 hours, localhost only, optimized for a 5-minute live demo.
Anything not visible or narratable in 5 minutes is out of scope.

**Demo persona:** Yusuf Ali (34, Bay Area) manages paperwork for himself and his mother Sarah (68,
limited English, Urdu speaker).

## Non-Goals

- Deployment, hosting, custom domains, HTTPS
- Auth, signup, multi-tenancy, real user accounts
- Persistent database (seed data is a JSON file; run history is in-memory)
- Full implementation of Category 4 (Lease) and Category 5 (Warranty Denial)
- Mobile-native app, responsive polish beyond "looks fine on the presenter's laptop"

---

## R1 — Document intake

**Story:** As Yusuf, I want to submit a document with minimal steps so a non-technical person could
do the same.

Acceptance criteria:

1. WHEN the app loads THEN the system SHALL display 5 category buttons: Bill, Medical, Government
   Letter, Lease (Coming soon), Warranty Denial (Coming soon).
2. WHEN the user selects Lease or Warranty Denial THEN the system SHALL show a "Coming soon" state
   and SHALL NOT start a pipeline run.
3. THE system SHALL accept input by either (a) pasted raw text or (b) uploaded image/PDF.
4. THE pasted-text path SHALL be implemented and working before the upload path (OCR de-risking).
5. THE system SHALL offer an optional free-text "what's your concern?" field, and SHALL NOT require it.
6. THE system SHALL let the user pick a recipient (Self — Yusuf / Household member — Sarah) and a
   callback language (English / Urdu / Spanish).
7. IF no document input is provided (neither text nor file) THEN the system SHALL block submission
   with an inline validation message.
8. THE system SHALL reject uploads over 10 MB and non-image/non-PDF MIME types with a clear message.

## R2 — Extraction

**Story:** As the pipeline, I need a structured view of the document before any analysis.

1. WHEN input is a file THEN the system SHALL extract structure using a vision-capable model.
2. WHEN input is pasted text THEN the system SHALL pass the text through to the same extraction
   prompt with no vision call.
3. THE extraction output SHALL be JSON containing: sender/vendor, addressee, total amount,
   line items (label + amount), key dates, and any codes/clauses found.
4. IF extraction returns unparseable output THEN the system SHALL retry once, and on second failure
   SHALL surface a readable error and stop the run.

## R3 — Multi-agent analysis pipeline

**Story:** As a judge, I want to see that this is genuinely multi-agent, not one mega-prompt.

1. THE system SHALL route directly to a category specialist based on the user's chosen category,
   with no classification step.
2. THE system SHALL run three cross-check agents as **concurrent** model calls: Anomaly/Scam
   Detector, Market Comparator, Plain-Language Translator.
3. THE Market Comparator SHALL call a `check_market_data(category, item)` tool backed by the seeded
   reference dataset.
4. THE system SHALL run a History/Trend agent comparing the current document against 2–3 seeded
   prior documents for the same category and recipient.
5. IF no history exists for that category+recipient THEN the system SHALL skip the trend step
   without failing the run.
6. THE Synthesis agent SHALL receive all specialist outputs plus the user's typed concern.
7. IF the user typed a concern THEN synthesis SHALL address that concern first, ahead of generic
   findings.
8. THE Synthesis agent SHALL emit both (a) a prioritized findings list for screen and (b) a
   natural-language briefing for the voice agent.
9. IF any single cross-check agent fails THEN the run SHALL continue with the remaining outputs and
   mark that agent as failed in the UI.

## R4 — Category checks

1. **Bill:** promo-rate expiry / upcoming price jump, vague or junk fees, unneeded add-ons, price vs.
   seeded market comparison.
2. **Medical:** billed amount vs. seeded fair-price range by procedure code, plain-language
   translation of denial/insurance jargon, whether the denial reason is commonly appealed successfully.
3. **Government letter:** SHALL flag as fraudulent when urgency + gift-card/wire demand + arrest or
   legal threat co-occur; SHALL state what action is actually required and by when; SHALL support a
   document addressed to a household member other than the submitter.

## R5 — Live pipeline visualization

**Story:** As a presenter, I need the audience to see the agents working.

1. WHILE a run is in progress THE UI SHALL show per-stage status (pending / running / done / failed)
   for extraction, each of the 3 parallel cross-checks, trend, and synthesis.
2. THE three cross-checks SHALL visibly enter the "running" state at the same time.
3. THE system SHALL stream stage updates to the UI as they happen (no single blocking request).
4. WHEN seeded history exists THE UI SHALL render a small trend chart of the prior amounts plus the
   current one.
5. THE UI SHALL display the prioritized findings as text after synthesis, each with a severity
   (critical / warning / info) and a one-line explanation.

## R6 — Voice callback

**Story:** As Sarah, I want to be told what my letter means, out loud, in Urdu.

1. WHEN synthesis completes THEN the system SHALL place an outbound call via Vapi to the phone number
   configured for the selected recipient.
2. THE voice agent's system prompt SHALL be the synthesis briefing plus the selected language.
3. THE voice agent SHALL answer 1–2 natural follow-up questions by reasoning over the findings
   rather than reading a fixed script.
4. THE system SHALL only dial phone numbers present in the local config allow-list.
5. WHEN the call ends THEN the UI SHALL display the call summary/transcript.
6. IF the Vapi call fails or credentials are missing THEN the UI SHALL show the briefing text and a
   "Retry call" button, and the run SHALL still be considered successful.

## R7 — Demo reliability (treated as a first-class requirement)

1. THE app SHALL run with a single command on localhost.
2. THE system SHALL provide one-click "Load demo document" buttons that populate the paste-text field
   with prepared examples for Bill, Medical, and Government Letter.
3. IF any model call times out (>25 s) THEN the stage SHALL fail fast and the run SHALL continue.
4. All secrets SHALL be read from `.env.local` server-side only and SHALL NOT be exposed to the
   browser or committed.
5. THE app SHALL be usable end-to-end with no network access to Vapi (findings-only mode), so a
   telecom failure on stage does not kill the demo.

## Security notes (acknowledged, deliberately minimal)

- No authentication: this is a localhost demo binding to `127.0.0.1`. Do not expose the port publicly.
- Outbound calling is an abusable capability; the allow-list in R6.4 is the mitigation.
- Uploaded documents are held in memory for the request and not written to disk.
