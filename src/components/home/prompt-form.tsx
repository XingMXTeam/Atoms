"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ExampleCards } from "./example-cards";

type PromptFormProps = {
  initialPrompt?: string;
};

export function PromptForm({ initialPrompt = "" }: PromptFormProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const trimmed = prompt.trim();
  const canSubmit = trimmed.length > 0 && !pending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = (await response.json()) as {
        projectId?: string;
        runId?: string;
        messageZh?: string;
      };

      if (!response.ok || !data.projectId || !data.runId) {
        setError(data.messageZh ?? "创建失败，请稍后重试");
        setPending(false);
        return;
      }

      router.push(`/projects/${data.projectId}?run=${data.runId}`);
    } catch {
      setError("网络异常，请检查连接后重试");
      setPending(false);
    }
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
          placeholder="描述你想生成的应用…"
          aria-label="描述你想生成的应用"
          className="w-full resize-y rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
        />
        <div className="flex items-center justify-between gap-3">
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : (
            <span className="text-sm text-zinc-500">用一句话描述即可</span>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition enabled:hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:enabled:hover:bg-white"
          >
            {pending ? "创建中…" : "开始生成"}
          </button>
        </div>
      </form>

      <ExampleCards onSelect={setPrompt} />
    </div>
  );
}
