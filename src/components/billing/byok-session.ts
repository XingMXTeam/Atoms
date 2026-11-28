import {
  credentialsFromFields,
  type ByokCredentials,
} from "@/lib/llm/byok";

const STORAGE_KEY = "atoms.byok.session";

/**
 * Holds the visitor key in sessionStorage for the tab only, so the home
 * form can hand it to the workbench without putting it in the URL or a cookie.
 * The server still receives it per request and must not persist it.
 */
export function readByokSession(): ByokCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    };
    return credentialsFromFields({
      provider: parsed.provider ?? "",
      apiKey: parsed.apiKey ?? "",
      baseUrl: parsed.baseUrl,
      model: parsed.model,
    });
  } catch {
    return null;
  }
}

export function writeByokSession(credentials: ByokCredentials | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!credentials) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload =
      credentials.kind === "gemini"
        ? { provider: "gemini", apiKey: credentials.apiKey }
        : {
            provider: "openai",
            apiKey: credentials.apiKey,
            baseUrl: credentials.baseUrl,
            model: credentials.model,
          };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode can reject storage; the next request still sends the key.
  }
}
