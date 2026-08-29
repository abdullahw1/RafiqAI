import 'server-only';
import { callJsonModel, STAGE_DEADLINE_MS, withDeadline } from './openai';
import { fenceUntrusted, UNTRUSTED_TEXT_NOTICE } from './prompt';
import type { BillType, Extraction } from './types';
import { parseJsonObject, validateExtraction } from './validate';

const TYPE_GUIDANCE: Record<BillType, string> = {
  phone: 'This is a phone bill. Identify service, carrier fees, device charges, and phone-bill history.',
  insurance: 'This is an insurance bill. Identify premiums, policy fees, adjustments, and insurance payment history.',
  medical: 'This is a medical bill. Identify provider charges, adjustments, insurance payments, and patient responsibility.',
  other: 'This is another bill type. Use neutral provider and line-item terminology.',
};

function extractionSystem(billType: BillType): string {
  return `You extract structured data from one ${billType} bill.
${TYPE_GUIDANCE[billType]}
${UNTRUSTED_TEXT_NOTICE}
Return ONLY a JSON object with this shape:
{"vendor":string|null,"accountHolder":string|null,"billingPeriod":string|null,"total":number|null,"priorAmount":number|null,"lineItems":[{"label":string,"amount":number|null,"evidence":string}],"history":[{"label":string,"amount":number,"evidence":string}]}
Rules:
- Evidence MUST be copied verbatim from the submitted bill text, including the amount.
- History must contain only dated totals explicitly printed in the document, in document order.
- Never invent history, line items, amounts, names, or phone-specific concepts.
- Amounts are plain numbers without currency symbols. No commentary outside JSON.`;
}

export async function extract(text: string, billType: BillType): Promise<Extraction> {
  const raw = await withDeadline(
    callJsonModel({
      system: extractionSystem(billType),
      user: `DECLARED BILL TYPE: ${billType}\nBILL TEXT:\n${fenceUntrusted(text)}`,
    }),
    STAGE_DEADLINE_MS,
    'extract',
  );
  const validated = validateExtraction(parseJsonObject(raw), text);
  if (validated === null) throw new Error('extract_invalid_output');
  return validated;
}
