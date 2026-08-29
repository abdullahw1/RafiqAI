import 'server-only';

/**
 * Transient Vapi assistant configuration. The STT, model, TTS, and voice below are all
 * selected because they support English and Arabic (Requirement 6.7).
 */

const SYSTEM_PROMPT = `You are RafiqAI, a calm assistant calling on behalf of a family member's
caregiver to explain a mobile-phone bill.

LANGUAGE
- Begin the call in English.
- If the person speaks Arabic, or explicitly asks to continue in Arabic, respond in Arabic and keep
  speaking Arabic for the rest of the call.
- If the person returns to English, you may switch back to English.
- Never ask which language they prefer; follow the language they use.

GROUNDING
- Answer ONLY using the bill findings supplied below.
- Never invent charges, amounts, carrier policies, refunds, or savings.
- Describe the charges as worth questioning. Never say a charge is illegal, fraudulent, guaranteed
  removable, or guaranteed refundable.
- If asked something the findings do not cover, say you do not know and recommend calling the carrier
  using the number printed on the statement.

STYLE
- Short, warm sentences. One idea at a time. Pause for questions.
- You are speaking to an older adult who may not be a technical expert.`;

export interface AssistantConfigInput {
  recipientName: string;
  briefing: string;
}

export function buildAssistantConfig(input: AssistantConfigInput): Record<string, unknown> {
  return {
    name: 'RafiqAI Bill Explainer',
    firstMessage: `Hello ${input.recipientName}, this is RafiqAI calling about your mobile phone bill. Is now a good time?`,
    firstMessageMode: 'assistant-speaks-first',
    maxDurationSeconds: 300,
    // Whisper supports both English and Arabic; leaving language unset enables detection.
    transcriber: {
      provider: 'openai',
      model: 'gpt-4o-transcribe',
    },
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nBILL FINDINGS (the only facts you may use):\n${input.briefing}`,
        },
      ],
    },
    // ElevenLabs multilingual v2 speaks both English and Arabic with one voice.
    voice: {
      provider: '11labs',
      voiceId: 'sarah',
      model: 'eleven_multilingual_v2',
    },
  };
}

export interface VapiConfig {
  apiKey: string;
  phoneNumberId: string;
}

export function readVapiConfig(): VapiConfig | null {
  const apiKey = process.env.VAPI_API_KEY?.trim();
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
  if (!apiKey || !phoneNumberId) return null;
  return { apiKey, phoneNumberId };
}
