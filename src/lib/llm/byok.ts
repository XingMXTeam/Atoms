/**
 * Request-scoped bring-your-own-key credentials.
 * Callers must not write these values to D1, cookies, SSE payloads, or logs.
 */

export const BYOK_PROVIDER_HEADER = "x-atoms-byok-provider";
export const BYOK_KEY_HEADER = "x-atoms-byok-key";
export const BYOK_BASE_URL_HEADER = "x-atoms-byok-base-url";
export const BYOK_MODEL_HEADER = "x-atoms-byok-model";
export const TURNSTILE_TOKEN_HEADER = "x-atoms-turnstile-token";

export type ByokCredentials =
  | { kind: "gemini"; apiKey: string }
  | { kind: "openai"; apiKey: string; baseUrl: string; model: string };

export type ParsedByok =
  | { attempted: false; credentials: null }
  | { attempted: true; credentials: ByokCredentials }
  | { attempted: true; credentials: null; errorZh: string };

const KEY_MIN = 8;
const KEY_MAX = 512;

export function credentialsFromFields(input: {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}): ByokCredentials | null {
  const headers = new Headers();
  if (input.provider.trim()) {
    headers.set(BYOK_PROVIDER_HEADER, input.provider.trim());
  }
  if (input.apiKey.trim()) headers.set(BYOK_KEY_HEADER, input.apiKey.trim());
  if (input.baseUrl?.trim()) {
    headers.set(BYOK_BASE_URL_HEADER, input.baseUrl.trim());
  }
  if (input.model?.trim()) headers.set(BYOK_MODEL_HEADER, input.model.trim());
  const parsed = parseByokHeaders(headers);
  return parsed.credentials;
}

export function byokHeaders(
  credentials: ByokCredentials,
): Record<string, string> {
  if (credentials.kind === "gemini") {
    return {
      [BYOK_PROVIDER_HEADER]: "gemini",
      [BYOK_KEY_HEADER]: credentials.apiKey,
    };
  }
  return {
    [BYOK_PROVIDER_HEADER]: "openai",
    [BYOK_KEY_HEADER]: credentials.apiKey,
    [BYOK_BASE_URL_HEADER]: credentials.baseUrl,
    [BYOK_MODEL_HEADER]: credentials.model,
  };
}

function headerValue(headers: Headers, name: string): string {
  return headers.get(name)?.trim() ?? "";
}

function validKey(value: string): boolean {
  return value.length >= KEY_MIN && value.length <= KEY_MAX && !/\s/.test(value);
}

/** https required, except localhost for development. Blocks obvious metadata targets. */
export function normalizeModelBaseUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const local =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    return null;
  }
  if (
    host === "169.254.169.254" ||
    host === "metadata.google.internal" ||
    host.endsWith(".internal")
  ) {
    return null;
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return null;
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${path}`;
}

function validModel(value: string): boolean {
  return /^[A-Za-z0-9._:/-]{1,128}$/.test(value);
}

/**
 * Read BYOK headers. Any provided header counts as an attempt: invalid
 * input must fail, never fall through to platform keys.
 */
export function parseByokHeaders(headers: Headers): ParsedByok {
  const provider = headerValue(headers, BYOK_PROVIDER_HEADER).toLowerCase();
  const apiKey = headerValue(headers, BYOK_KEY_HEADER);
  const baseUrl = headerValue(headers, BYOK_BASE_URL_HEADER);
  const model = headerValue(headers, BYOK_MODEL_HEADER);
  const attempted = Boolean(provider || apiKey || baseUrl || model);
  if (!attempted) return { attempted: false, credentials: null };

  if (provider === "gemini") {
    if (!validKey(apiKey) || baseUrl || model) {
      return {
        attempted: true,
        credentials: null,
        errorZh:
          "Gemini 密钥无效。请只填写 API Key（不要附带 Base URL 或模型名）。本次不会改用平台密钥。",
      };
    }
    return { attempted: true, credentials: { kind: "gemini", apiKey } };
  }

  if (provider === "openai") {
    const normalized = normalizeModelBaseUrl(baseUrl);
    if (!validKey(apiKey) || !normalized || !validModel(model)) {
      return {
        attempted: true,
        credentials: null,
        errorZh:
          "OpenAI 兼容接口需要有效的 Base URL（https）、API Key 和模型名。本次不会改用平台密钥。",
      };
    }
    return {
      attempted: true,
      credentials: { kind: "openai", apiKey, baseUrl: normalized, model },
    };
  }

  return {
    attempted: true,
    credentials: null,
    errorZh:
      "请选择 Gemini 或 OpenAI 兼容接口。本次不会改用平台密钥。",
  };
}

/** User-facing BYOK failure. Never echoes upstream bodies or the key. */
export function publicByokFailureMessage(reason: string): string {
  if (/401|403|unauth|permission|api key/i.test(reason)) {
    return "你的 API Key 无效或没有权限。本次不会改用平台密钥，请检查后重试。";
  }
  if (/402|429|quota|resource_exhausted|billing/i.test(reason)) {
    return "你的 API Key 额度不足或被限流。本次不会改用平台密钥，请检查账单后重试。";
  }
  if (/abort|timeout|network|fetch|econn|enotfound|empty/i.test(reason)) {
    return "调用你的模型接口失败（网络、超时或空响应）。本次不会改用平台密钥。";
  }
  return "调用你的模型失败。本次不会改用平台密钥，请检查密钥、模型和 Base URL 后重试。";
}
