# Requirements Document

## Introduction

RafiqAI helps a caregiver understand a family member's confusing mobile-phone bill and then calls
the family member so they can ask questions without installing an app.

The three-hour hackathon MVP uses one coherent story: Yusuf submits his mother Sarah's
English-language phone bill. Sarah is more comfortable speaking Arabic. The voice agent begins in
English and switches to Arabic if Sarah speaks Arabic or asks for Arabic.

### Scope

The MVP supports pasted text from one mobile-phone-bill scenario. Medical bills, government/scam
letters, leases, warranties, image/PDF upload, OCR, extra recipients, persistence, authentication,
deployment, transcript polling, and user-selected languages are out of scope.

## Glossary

- **Prepared fixture:** The seeded Sarah phone bill used in the hackathon demonstration.
- **Live mode:** Analysis produced from current model responses.
- **Verified demo fallback:** Clearly labelled, pre-verified output available only for the prepared fixture or explicit safe mode.
- **Potential impact:** A conditional amount worth questioning, not guaranteed savings or a refund.
- **Concurrent checks:** The independent anomaly, market, and plain-language model calls started together.

## Requirements

## Requirement 1: Focused bill intake

**User Story:** As Yusuf, I want to submit Sarah's phone bill with minimal setup so I can quickly see
which changes are worth questioning.

### Acceptance Criteria

1. WHEN the app loads THEN it SHALL present a phone-bill analysis flow without a category picker.
2. THE app SHALL accept pasted text and SHALL provide a one-click action that loads the prepared demo bill.
3. THE prepared bill SHALL contain a $58 base service, a $9 Premium Network Access Fee, a $15
   device-protection add-on, and an $82 total.
4. IF the text field is empty THEN submission SHALL be blocked with an inline message.
5. THE app SHALL identify Sarah as the bill recipient and outbound-call recipient.
6. THE app SHALL NOT display a language selector.

## Requirement 2: Structured extraction

**User Story:** As the analysis pipeline, I need a normalized view of the bill so each independent
check evaluates the same facts.

### Acceptance Criteria

1. WHEN valid text is submitted THEN the system SHALL make one structured extraction model call.
2. Extraction SHALL return vendor, account holder, billing period, total, line items, prior amount,
   and exact evidence snippets from the source text.
3. Model output SHALL be runtime-validated and normalized before downstream use.
4. THE extraction call SHALL have an 8–12 second deadline.
5. IF extraction fails or returns invalid output THEN the system SHALL use the transparent demo
   fallback only when the input matches the prepared fixture or explicit safe mode is enabled.
6. IF fallback is unavailable THEN the system SHALL return a readable error and stop analysis.

## Requirement 3: Concurrent independent checks

**User Story:** As a judge, I want to see independent checks run concurrently so the architecture is
more than one large prompt.

### Acceptance Criteria

1. AFTER extraction succeeds THEN the system SHALL start three separate model calls before awaiting
   any of them: anomaly check, market comparison, and plain-language explanation.
2. THE system SHALL execute those calls concurrently with `Promise.allSettled` or equivalent.
3. THE anomaly check SHALL identify new charges, unexpected increases, and internally inconsistent amounts.
4. THE market check SHALL compare relevant items against clearly labelled synthetic seeded data.
5. THE plain-language check SHALL explain vague fee names without claiming that a fee is illegal or removable.
6. EACH check SHALL return exact evidence from the submitted bill for every proposed finding.
7. IF one check fails or times out THEN the remaining checks SHALL continue and the failed stage SHALL
   be visibly marked without failing the entire run.
8. EACH model call SHALL have an 8–12 second deadline.

## Requirement 4: Deterministic trend, impact, and result merge

**User Story:** As Yusuf, I want quantified, cautious findings so I know what to ask the carrier.

### Acceptance Criteria

1. THE system SHALL use seeded totals of $58, $67, and $82 for the prepared scenario.
2. THE system SHALL calculate the increase from $58 to $82 locally and report it as approximately 41%.
3. THE system SHALL calculate $24/month and up to $288/year locally from the two questioned charges.
4. THE system SHALL describe those numbers as potential impact only, conditional on the charges being removable.
5. THE system SHALL merge and sort findings locally without a separate synthesis model call.
6. EACH finding SHALL contain severity, title, exact evidence, explanation, potential impact, suggested
   action, and source check.
7. THE English voice briefing SHALL be generated locally from normalized findings.
8. Suggested actions SHALL favor verification: inspect plan terms, ask whether protection is optional,
   request an explanation, and contact the carrier through a verified channel.

## Requirement 5: Live and robust pipeline visualization

**User Story:** As a presenter, I want the audience to understand what is happening without waiting
at a frozen screen.

### Acceptance Criteria

1. WHILE analysis runs THEN the UI SHALL show pending, running, done, failed, or fallback status for
   extraction and each concurrent check.
2. THE three independent checks SHALL visibly enter running state together.
3. THE analysis route SHALL stream newline-delimited JSON stage and result events.
4. THE client SHALL preserve incomplete lines between network chunks and parse only complete records.
5. THE stream SHALL end with an explicit `complete` event.
6. IF the connection closes early THEN any running stages SHALL become failed while completed results remain visible.
7. THE final UI SHALL emphasize exact evidence, potential monthly/annual impact, and one recommended next action.

## Requirement 6: Controlled bilingual voice call

**User Story:** As Sarah, I want to ask follow-up questions naturally and receive answers in the
language I use during the call.

### Acceptance Criteria

1. AFTER findings appear THEN the UI SHALL show a manual Call Sarah action.
2. THE system SHALL NOT place an outbound call automatically.
3. THE call route SHALL accept a recipient ID, resolve the number server-side, and reject any
   recipient not present in the local allow-list.
4. THE voice agent SHALL greet Sarah in English.
5. IF Sarah speaks Arabic or explicitly asks for Arabic THEN the agent SHALL respond and continue in Arabic.
6. IF Sarah returns to English THEN the agent MAY switch back to English.
7. THE configured speech recognition, model, speech generation, and voice SHALL support both English and Arabic.
8. THE agent SHALL answer only from the supplied findings and SHALL not invent carrier policy or guaranteed savings.
9. IF Vapi credentials are absent or the call fails THEN the UI SHALL display the English briefing
   and a Retry action without changing the successful analysis result.
10. Transcript polling SHALL NOT be required for the MVP.

## Requirement 7: Honest demo fallback and reliability

**User Story:** As a presenter, I want the demo to remain useful during API failure without misleading judges.

### Acceptance Criteria

1. THE prepared demo document SHALL have verified fallback extraction and findings.
2. Fallback SHALL activate only when input matches the prepared fixture or explicit safe mode is enabled.
3. WHEN fallback is used THEN a persistent **Verified demo fallback** banner SHALL be shown.
4. THE system SHALL never label fallback output as live model output.
5. Arbitrary submitted text SHALL NOT receive findings prepared for the demo fixture.
6. THE analysis pipeline SHALL target an overall 25–30 second deadline.
7. IF the overall deadline expires THEN completed findings SHALL remain visible and unfinished stages
   SHALL be marked failed or fallback.
8. THE product SHALL remain demoable without Vapi network access.

## Requirement 8: Security, privacy, and claim boundaries

**User Story:** As a presenter, I want the prototype's limitations to be explicit and safe.

### Acceptance Criteria

1. All API credentials and phone numbers SHALL remain server-side and SHALL not be serialized to the browser.
2. Submitted text SHALL be held only for the request and SHALL not be written to local storage or disk.
3. THE UI and README SHALL disclose that bill text is sent to the configured OpenAI provider and that
   briefing/call content is sent to Vapi and its configured providers.
4. Seeded comparison data SHALL be labelled synthetic.
5. Findings SHALL use cautious wording such as “worth questioning” and “potential impact.”
6. THE app SHALL not claim that a charge is fraudulent, illegal, guaranteed removable, or guaranteed refundable.
7. THE localhost prototype SHALL not be exposed publicly and SHALL not be used with real sensitive bills.