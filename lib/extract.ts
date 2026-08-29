import 'server-only';
import { callJsonModel, STAGE_DEADLINE_MS, withDeadline } from './openai';
import { fenceUntrusted, UNTRUSTED_TEXT_NOTICE } from './prompt';
import type { Extraction } from './types';
import { parseJsonObject, validateExtraction } from './validate';

const SYSTEM = `You extract structure from a single mobile-phone bill.
${UNTRUSTED_TEXT_NOTICE}
Return ONLY a JSON object with this shape:
{"vendor":string|null,"accountHolder":string|null,"billingPeriod":string|null,"total":number|null,"priorAmount":number|null,"lineItems":[{"label":string,"amount":number|null,"evidence":string}]}
Rules:
- "evidence" MUST be copied verbatim from the bill text, including the amount.
- Never invent line items, amounts, or names that are not in the text.
- Amounts are plain numbers without currency symbols.
- Be concise. No commentary outside the JSON object.`;

/** Requirement 2.1: exactly one structured extraction model call. */
export async function extract(text: string): Promise<Extraction> {
  const raw = await withDeadline(
    callJsonModel({ system: SYSTEM, user: `BILL TEXT:\n${fenceUntrusted(text)}` }),
    STAGE_DEADLINE_MS,
    'extract',
  );

  const validated = validateExtraction(parseJsonObject(raw), text);
  if (validated === null) throw new Error('extract_invalid_output');
  return validated;
}
