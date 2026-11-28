"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { byokHeaders, TURNSTILE_TOKEN_HEADER } from "@/lib/llm/byok";
import {
  draftCredentials,
  EMPTY_BYOK_DRAFT,
  ModelAccessFields,
  type ByokDraft,
} from "@/components/billing/model-access-fields";
import { writeByokSession } from "@/components/billing/byok-session";
import { TurnstileWidget } from "@/components/billing/turnstile-widget";
import { ExampleCards } from "./example-cards";

type PromptFormProps = {
  initialPrompt?: string;
};

type CreateResponse = {
  projectId?: string;
  runId?: string;
  messageZh?: string;
  label?: string;
  mode?: string;
  code?: string;
  replayAvailable?: boolean;
};

export function PromptForm({ initialPrompt = "" }: PromptFormProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"demo" | "byok">("demo");
  const [draft, setDraft] = useState<ByokDraft>(EMPTY_BYOK_DRAFT);
  const [replayAvailable, setReplayAvailable] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/billing/config")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { turnstileSiteKey?: string } | null) => {
        if (cancelled || !data?.turnstileSiteKey) return;
        setTurnstileSiteKey(data.turnstileSiteKey);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmed = prompt.trim();
  const turnstileRequired = mode === "demo" && turnstileSiteKey.length > 0;
  const canSubmit =
    trimmed.length > 0 && !pending && (!turnstileRequired || turnstileToken.length > 0);

  async function submit(useReplay: boolean) {
    if (!trimmed || pending) return;
    const credentials = mode === "byok" ? draftCredentials(draft) : null;
    if (mode === "byok" && !credentials) {
      setError("请完整填写你的 API Key。Gemini 只需密钥；OpenAI 兼容接口还需要 Base URL 和模型名。");
      return;
    }

    setPending(true);
    setError(null);

    if (credentials) writeByokSession(credentials);
    else writeByokSession(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(credentials ? byokHeaders(credentials) : {}),
          ...(mode === "demo" && turnstileToken
            ? { [TURNSTILE_TOKEN_HEADER]: turnstileToken }
            : {}),
        },
        body: JSON.stringify({
          prompt: trimmed,
          ...(useReplay ? { useReplay: true } : {}),
        }),
      });

      const data = (await response.json()) as CreateResponse;

      if (!response.ok || !data.projectId || !data.runId) {
        setReplayAvailable(data.replayAvailable === true);
        setError(data.messageZh ?? "创建失败，请稍后重试");
        setPending(false);
        return;
      }

      const params = new URLSearchParams({ run: data.runId });
      if (data.label === "演示回放" || data.mode === "replay") {
        params.set("provider", "replay");
      }
      router.push(`/projects/${data.projectId}?${params.toString()}`);
    } catch {
      setError("网络异常，请检查连接后重试");
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(false);
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="sr-only" htmlFor="home-prompt">
          描述你想生成的应用
        </label>
        <textarea
          id="home-prompt"
          name="prompt"
          rows={4}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canSubmit) {
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="描述你想生成的应用…"
          aria-label="描述你想生成的应用"
          className="atoms-focus-ring w-full resize-y rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 text-base text-zinc-900 shadow-sm transition placeholder:text-zinc-400 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/95 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:hover:border-zinc-700"
        />

        <ModelAccessFields
          mode={mode}
          onModeChange={(next) => {
            setMode(next);
            setError(null);
            setReplayAvailable(false);
          }}
          draft={draft}
          onDraftChange={setDraft}
        />

        {turnstileRequired ? (
          <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : !trimmed ? (
            <span className="text-sm text-zinc-500" data-testid="prompt-empty-hint">
              请先输入应用需求，或点击下方示例卡片快速填入
            </span>
          ) : (
            <span className="text-sm text-zinc-500">
              平台演示极有限 · 自己的密钥用于正式生成 · ⌘/Ctrl + Enter
            </span>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="atoms-focus-ring atoms-btn-press inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-xs enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:enabled:hover:bg-white"
          >
            {pending ? "创建中…" : "开始生成"}
          </button>
        </div>
        {replayAvailable ? (
          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={pending || trimmed.length === 0}
            className="atoms-focus-ring self-start text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            改用演示回放
          </button>
        ) : null}
      </form>

      <ExampleCards onSelect={setPrompt} />
    </div>
  );
}
