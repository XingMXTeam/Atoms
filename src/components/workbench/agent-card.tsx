"use client";

import { useMemo, useState } from "react";
import type { AgentName } from "@/lib/agents/events";
import { formatElapsed } from "@/lib/agents/timing";

export type AgentCardStatus =
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "interrupted";

export type AgentCardModel = {
  agent: AgentName;
  status: AgentCardStatus;
  startedAt?: number;
  finishedAt?: number;
  payload?: unknown;
  now?: number;
  /** Honest label when a real elapsed time was not recorded. */
  durationLabel?: string;
};

const AGENT_LABEL: Record<AgentName, string> = {
  planner: "规划师",
  architect: "架构师",
  engineer: "工程师",
  qa: "质检",
};

const STATUS_LABEL: Record<AgentCardStatus, string> = {
  pending: "等待中",
  running: "进行中",
  completed: "已完成",
  error: "失败",
  interrupted: "已中断",
};

type AgentCardProps = {
  card: AgentCardModel;
};

export function AgentCard({ card }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const label = AGENT_LABEL[card.agent] ?? card.agent;
  const statusLabel = STATUS_LABEL[card.status];

  const elapsedMs = useMemo(() => {
    if (!card.startedAt) return null;
    // Parent supplies `now` while running; avoid impure Date.now() during render.
    const end =
      card.finishedAt ??
      (card.status === "running" ? (card.now ?? card.startedAt) : card.startedAt);
    return Math.max(0, end - card.startedAt);
  }, [card.finishedAt, card.now, card.startedAt, card.status]);

  const payloadText = useMemo(() => {
    if (card.payload === undefined) return null;
    try {
      return JSON.stringify(card.payload, null, 2);
    } catch {
      return String(card.payload);
    }
  }, [card.payload]);

  const statusDotClass =
    card.status === "completed"
      ? "bg-emerald-500"
      : card.status === "running"
        ? "bg-indigo-500 atoms-running-pulse"
        : card.status === "error"
          ? "bg-rose-500"
          : "bg-zinc-300 dark:bg-zinc-700";

  return (
    <article
      data-testid={`agent-card-${card.agent}`}
      data-agent={card.agent}
      data-status={card.status}
      className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass}`} aria-hidden="true" />
            {label}
          </h3>
          <p className="mt-1 pl-4 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            <span
              className={
                card.status === "running" ? "atoms-running-pulse" : undefined
              }
              data-motion={card.status === "running" ? "pulse" : undefined}
            >
              {statusLabel}
            </span>
            {card.durationLabel
              ? ` · ${card.durationLabel}`
              : elapsedMs !== null
                ? ` · ${formatElapsed(elapsedMs)}`
                : null}
          </p>
        </div>
        {payloadText ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="atoms-focus-ring rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-950"
            aria-expanded={expanded}
          >
            {expanded ? "收起详情" : "展开详情"}
          </button>
        ) : null}
      </div>

      {expanded && payloadText ? (
        <pre className="atoms-expand-panel mt-3 max-h-56 overflow-auto rounded-lg bg-white p-3 text-xs leading-5 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          {payloadText}
        </pre>
      ) : null}
    </article>
  );
}
