const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerifyResult = {
  ok: boolean;
  messageZh: string;
};

/**
 * Cloudflare Turnstile siteverify for the platform-key demo path.
 * Missing secret fails closed so a demo cannot spend platform keys
 * without a configured challenge. Tests inject `fetchImpl`.
 */
export async function verifyTurnstile(options: {
  token: string | null | undefined;
  secret: string;
  remoteIp?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<TurnstileVerifyResult> {
  const secret = options.secret.trim();
  if (!secret) {
    return {
      ok: false,
      messageZh:
        "平台演示的人机验证未配置，已拒绝调用平台模型。请改用自己的 API Key。",
    };
  }

  const token = options.token?.trim() ?? "";
  if (!token) {
    return {
      ok: false,
      messageZh: "请先完成人机验证，再使用平台演示。也可以改为粘贴自己的 API Key。",
    };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (options.remoteIp) body.set("remoteip", options.remoteIp);

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      return {
        ok: false,
        messageZh: "人机验证没有通过，平台模型未被调用。请重试或改用自己的 API Key。",
      };
    }
    const payload = (await response.json()) as { success?: boolean };
    if (payload.success === true) {
      return { ok: true, messageZh: "" };
    }
  } catch {
    return {
      ok: false,
      messageZh: "人机验证暂时不可用，平台模型未被调用。请稍后重试或改用自己的 API Key。",
    };
  }

  return {
    ok: false,
    messageZh: "人机验证没有通过，平台模型未被调用。请重试或改用自己的 API Key。",
  };
}
