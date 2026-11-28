"use client";

import { credentialsFromFields } from "@/lib/llm/byok";

export type ByokDraft = {
  provider: "gemini" | "openai";
  apiKey: string;
  baseUrl: string;
  model: string;
};

export const EMPTY_BYOK_DRAFT: ByokDraft = {
  provider: "gemini",
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
};

type ModelAccessFieldsProps = {
  mode: "demo" | "byok";
  onModeChange?: (mode: "demo" | "byok") => void;
  draft: ByokDraft;
  onDraftChange: (draft: ByokDraft) => void;
  showModeToggle?: boolean;
  compact?: boolean;
};

const fieldClass =
  "atoms-focus-ring w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

export function ModelAccessFields({
  mode,
  onModeChange,
  draft,
  onDraftChange,
  showModeToggle = true,
  compact = false,
}: ModelAccessFieldsProps) {
  const patch = (partial: Partial<ByokDraft>) =>
    onDraftChange({ ...draft, ...partial });

  return (
    <fieldset className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {showModeToggle ? "模型来源" : "你的 API Key"}
      </legend>
      {showModeToggle ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
            <input
              type="radio"
              name="model-access"
              value="demo"
              checked={mode === "demo"}
              onChange={() => onModeChange?.("demo")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-zinc-900 dark:text-zinc-50">
                平台演示
              </span>
              <span className="block text-xs leading-5 text-zinc-500">
                每位访客仅 1 次完整生成，不能用于后续修改
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
            <input
              type="radio"
              name="model-access"
              value="byok"
              checked={mode === "byok"}
              onChange={() => onModeChange?.("byok")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-zinc-900 dark:text-zinc-50">
                使用我的 API Key
              </span>
              <span className="block text-xs leading-5 text-zinc-500">
                真实生成与后续修改，费用由你的密钥承担
              </span>
            </span>
          </label>
        </div>
      ) : (
        <p className="text-xs leading-5 text-zinc-500">
          后续修改和「继续」不会使用平台模型。填写你自己的密钥后才会调用模型。
        </p>
      )}

      {mode === "byok" || !showModeToggle ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            接口
            <select
              aria-label="模型接口"
              value={draft.provider}
              onChange={(event) =>
                patch({
                  provider: event.target.value === "openai" ? "openai" : "gemini",
                })
              }
              className={fieldClass}
            >
              <option value="gemini">Google Gemini API Key</option>
              <option value="openai">OpenAI 兼容（DeepSeek 等）</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            API Key
            <input
              aria-label="API Key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft.apiKey}
              onChange={(event) => patch({ apiKey: event.target.value })}
              placeholder="仅用于本次请求，不写入数据库"
              className={fieldClass}
            />
          </label>
          {draft.provider === "openai" ? (
            <>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                Base URL
                <input
                  aria-label="Base URL"
                  type="url"
                  autoComplete="off"
                  value={draft.baseUrl}
                  onChange={(event) => patch({ baseUrl: event.target.value })}
                  placeholder="https://api.deepseek.com"
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                模型名
                <input
                  aria-label="模型名"
                  autoComplete="off"
                  value={draft.model}
                  onChange={(event) => patch({ model: event.target.value })}
                  placeholder="deepseek-chat"
                  className={fieldClass}
                />
              </label>
            </>
          ) : null}
          <p className="text-xs leading-5 text-zinc-500">
            密钥会随请求发到服务器，由服务器代为调用模型，用完即弃，不会写入数据库、Cookie 或日志。调用失败时不会改用平台密钥。
          </p>
        </div>
      ) : (
        <p className="text-xs leading-5 text-zinc-500">
          演示额度用完后请改用自己的 API Key，或选择演示回放。清除 Cookie 会换一个新设备号，但不能绕过人机验证和全站额度，也不能算作防刷。
        </p>
      )}
    </fieldset>
  );
}

export function draftCredentials(draft: ByokDraft) {
  return credentialsFromFields({
    provider: draft.provider,
    apiKey: draft.apiKey,
    baseUrl: draft.baseUrl,
    model: draft.model,
  });
}
