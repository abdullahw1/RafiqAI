import 'server-only';

const DEFAULT_VAPI_API_BASE_URL = 'https://api.vapi.ai';

export interface VapiConfig {
  apiBaseUrl: string;
  apiKey: string;
  phoneNumberId: string;
  assistantId: string;
}

export function readVapiConfig(): VapiConfig | null {
  const apiKey = process.env.VAPI_API_KEY?.trim();
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
  const assistantId = process.env.VAPI_ASSISTANT_ID?.trim();
  const apiBaseUrl =
    process.env.VAPI_API_BASE_URL?.trim().replace(/\/$/u, '') || DEFAULT_VAPI_API_BASE_URL;

  if (!apiKey || !phoneNumberId || !assistantId) return null;
  return { apiBaseUrl, apiKey, phoneNumberId, assistantId };
}
