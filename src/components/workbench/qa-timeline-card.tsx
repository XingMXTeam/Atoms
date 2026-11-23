"use client";

import { useMemo, useState } from "react";
import type { AgentEventRecord } from "@/lib/agents/events";
import type { AgentCardStatus } from "./agent-card";

type QaTimelineCardProps = {
  events: AgentEventRecord[];
  status: AgentCardStatus;
};

type QaVerdict = {
  criterion: string;
  verdict: "pass" | "fail";
  reason: string;
};

type QaEventPayload = {
  round?: number;
  verdicts?: QaVerdict[];
  qa_score?: number;
  fixInstruction?: string;
  files?: string[];
  exhausted?: boolean;
  messageZh?: string;
  report?: unknown;
};

type CriterionHistory = {
  criterion: string;
  verdicts: Array<{ round: number; verdict: "pass" | "fail"; reason: string }>;
  failureRound: number | null;
  resolvedRound: number | null;
};

function payloadOf(event: AgentEventRecord): QaEventPayload {
  if (!event.payload || typeof event.payload !== "object") return {};
  return event.payload as QaEventPayload;
}

function buildCriterionHistory(events: AgentEventRecord[]): CriterionHistory[] {
  const histories = new Map<string, CriterionHistory>();
  for (const event of events) {
    if (event.type !== "verdict") continue;
    const payload = payloadOf(event);
    for (const verdict of payload.verdicts ?? []) {
      if (!verdict || typeof verdict.criterion !== "string") continue;
      const round = Number.isInteger(payload.round) ? payload.round! : 0;
      const history = histories.get(verdict.criterion) ?? {
        criterion: verdict.criterion,
        verdicts: [],
        failureRound: null,
        resolvedRound: null,
      };
      history.verdicts.push({ round, verdict: verdict.verdict, reason: verdict.reason });
      if (verdict.verdict === "fail" && history.failureRound === null) {
        history.failureRound = round;
      } else if (
        verdict.verdict === "pass" &&
        history.failureRound !== null &&
        round > history.failureRound &&
        history.resolvedRound === null
      ) {
        history.resolvedRound = round;
      }
      histories.set(verdict.criterion, history);
    }
  }
  return [...histories.values()];
}

const STATUS_LABEL: Record<AgentCardStatus, string> = {
  pending: "等待中",
  running: "进行中",
  completed: "已完成",
  error: "失败",
  interrupted: "已中断",
};

export function QaTimelineCard({ events, status }: QaTimelineCardProps) {
  const [expanded, setExpanded] = useState(false);
  const histories = useMemo(() => buildCriterionHistory(events), [events]);
  const exhaustedEvent = events.find(
    (event) => event.type === "fix" && payloadOf(event).exhausted,
  );
  const exhaustedRound = exhaustedEvent
    ? payloadOf(exhaustedEvent).round ?? 0
    : null;

  return (
    <article
      data-testid="agent-card-qa"
      data-agent="qa"
      data-status={status}
      className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">质检</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {STATUS_LABEL[status]}
          </p>
        </div>
        {events.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-950 dark:focus-visible:outline-zinc-100"
            aria-expanded={expanded}
          >
            {expanded ? "收起质检详情" : "展开质检详情"}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
          <ol aria-label="质检事件" className="space-y-1">
            {events.map((event) => {
              const payload = payloadOf(event);
              const round = payload.round ?? 0;
              const label = event.type === "probe"
                ? `探测 · 第 ${round} 轮`
                : event.type === "verdict"
                  ? `判定 · 第 ${round} 轮`
                  : event.type === "fix"
                    ? payload.exhausted
                      ? `修复上限 · 第 ${round} 轮`
                      : `修复 · 第 ${round} 轮`
                    : `错误 · 第 ${round} 轮`;
              return (
                <li key={event.id} className="rounded-lg bg-white px-3 py-2 dark:bg-zinc-950">
                  <span>{label}</span>
                  {payload.fixInstruction ? <p>{payload.fixInstruction}</p> : null}
                  {payload.messageZh ? <p>{payload.messageZh}</p> : null}
                  {event.type === "probe" ? (
                    <p>{payload.report ? "已收到预览探测报告" : "预览探测"}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {histories.map((history) => {
            const lastVerdict = history.verdicts.at(-1);
            const resolution = history.resolvedRound !== null
              ? `已由第 ${history.resolvedRound} 轮修复`
              : exhaustedRound !== null && history.failureRound !== null
                ? `已达修复上限（第 ${exhaustedRound} 轮）`
                : lastVerdict
                  ? `第 ${lastVerdict.round} 轮${lastVerdict.verdict === "pass" ? "通过" : "未通过"}`
                  : "等待判定";
            return (
              <section key={history.criterion} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-medium">{history.criterion}</h4>
                  <span>{resolution}</span>
                </div>
                {history.verdicts.map((verdict, index) => (
                  <p key={`${verdict.round}-${index}`}>
                    第 {verdict.round} 轮 · {verdict.verdict === "pass" ? "通过" : "未通过"}：{verdict.reason}
                  </p>
                ))}
              </section>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
