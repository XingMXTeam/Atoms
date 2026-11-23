"use client";

import { useState, type FormEvent } from "react";

type FollowUpFormProps = {
  disabled: boolean;
  pending: boolean;
  onSubmit: (prompt: string) => Promise<void> | void;
};

export function FollowUpForm({
  disabled,
  pending,
  onSubmit,
}: FollowUpFormProps) {
  const [prompt, setPrompt] = useState("");
  const trimmed = prompt.trim();
  const canSubmit = trimmed.length > 0 && !disabled && !pending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    await onSubmit(trimmed);
    setPrompt("");
  }

  return (
    <form
      data-testid="follow-up-form"
      onSubmit={handleSubmit}
      className="mt-auto flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-900"
    >
      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="follow-up-prompt">
        后续需求
      </label>
      <textarea
        id="follow-up-prompt"
        name="followUp"
        rows={3}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        disabled={disabled || pending}
        placeholder="补充或修改需求，继续迭代…"
        aria-label="后续需求"
        className="atoms-focus-ring w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
      />
      <button
        type="submit"
        data-testid="follow-up-send"
        disabled={!canSubmit}
        className="atoms-focus-ring inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:enabled:hover:bg-white"
      >
        {pending ? "提交中…" : "发送后续需求"}
      </button>
    </form>
  );
}
