"use client";

import { useMemo, useState } from "react";
import type { AgentName } from "@/lib/agents/events";

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

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

type AgentCardProps = {
  card: AgentCardModel;
};

export function AgentCard({ card }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const label = AGENT_LABEL[card.agent] ?? card.agent;
  const statusLabel = STATUS_LABEL[card.status];

  const elapsedMs = useMemo(() => {
    if (!card.startedAt) return null;
    const end =
      card.finishedAt ??
      (card.status === "running" ? (card.now ?? Date.now()) : card.startedAt);
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

  return (
    <article
      data-testid={`agent-card-${card.agent}`}
      data-agent={card.agent}
      data-status={card.status}
      className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {label}
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {statusLabel}
            {elapsedMs !== null ? ` · ${formatElapsed(elapsedMs)}` : null}
          </p>
        </div>
        {payloadText ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-950 dark:focus-visible:outline-zinc-100"
            aria-expanded={expanded}
          >
            {expanded ? "收起详情" : "展开详情"}
          </button>
        ) : null}
      </div>

      {expanded && payloadText ? (
        <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-white p-3 text-xs leading-5 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          {payloadText}
        </pre>
      ) : null}
    </article>
  );
}
