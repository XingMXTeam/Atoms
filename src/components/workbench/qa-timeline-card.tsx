"use client";

import { useMemo, useState } from "react";
import type { AgentEventRecord } from "@/lib/agents/events";
import {
  aggregateTiming,
  formatElapsed,
  readDurationLabel,
  UNRECORDED_DURATION_LABEL,
} from "@/lib/agents/timing";
import type { SandboxVerifyReport } from "@/lib/sandbox/types";
import type { AgentCardStatus } from "./agent-card";

type QaTimelineCardProps = {
  events: AgentEventRecord[];
  status: AgentCardStatus;
};

type QaVerdict = {
  criterion: string;
  verdict: "pass" | "fail" | "unverified";
  reason: string;
};

type QaEventPayload = {
  round?: number;
  verdicts?: QaVerdict[];
  qa_score?: number;
  coverage?: { verified: number; unverified: number; total: number };
  fixInstruction?: string;
  files?: string[];
  exhausted?: boolean;
  messageZh?: string;
  report?: unknown;
  sandbox?: SandboxVerifyReport;
};

const VERDICT_LABEL: Record<QaVerdict["verdict"], string> = {
  pass: "通过",
  fail: "未通过",
  unverified: "需人工复核",
};

const SANDBOX_BACKEND_LABEL: Record<SandboxVerifyReport["backend"], string> = {
  "cloudflare-sandbox": "Cloudflare Sandbox 容器",
  "local-node-sandbox": "Node 隔离执行沙箱",
  "worker-static-verifier": "Worker 服务端校验器",
};

type CriterionHistory = {
  criterion: string;
  verdicts: Array<{ round: number; verdict: "pass" | "fail" | "unverified"; reason: string }>;
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
  const presetLabel = events
    .map((event) => readDurationLabel(event.payload))
    .find((label): label is string => Boolean(label));
  const timing = aggregateTiming(events.map((event) => event.payload));
  const presetExample = events.some((event) => {
    const payload = payloadOf(event);
    return (payload as { evidenceKind?: unknown }).evidenceKind === "preset-example";
  });
  const durationText = timing
    ? formatElapsed(timing.finishedAt - timing.startedAt)
    : presetLabel
      ? presetLabel
      : status === "completed" || status === "error"
        ? UNRECORDED_DURATION_LABEL
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
            {durationText ? ` · ${durationText}` : null}
          </p>
        </div>
        {events.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="atoms-focus-ring rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-950"
            aria-expanded={expanded}
          >
            {expanded ? "收起质检详情" : "展开质检详情"}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="atoms-expand-panel mt-3 space-y-3 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
          {presetExample ? (
            <p data-testid="qa-preset-evidence">
              以下为预置示例证据，不是这次打开时的实时探测结论。
            </p>
          ) : null}
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
                    <div className="mt-1 space-y-2">
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {payload.report ? "已收到预览探测报告" : "预览探测"}
                      </p>
                      {payload.sandbox ? (
                        <div
                          data-testid="qa-sandbox-report"
                          data-sandbox-backend={payload.sandbox.backend}
                          className="rounded-lg border border-zinc-200/80 bg-zinc-50/90 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/70"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              后台沙箱 · {SANDBOX_BACKEND_LABEL[payload.sandbox.backend]}
                            </span>
                            <span
                              className={
                                payload.sandbox.ok
                                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                  : "rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                              }
                            >
                              {payload.sandbox.ok ? "通过" : "失败"} · {payload.sandbox.durationMs}ms
                            </span>
                          </div>
                          {payload.sandbox.commands.map((cmd, idx) => (
                            <div
                              key={`${cmd.command}-${idx}`}
                              className="mt-2 rounded-md border border-zinc-200/70 bg-zinc-950 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-zinc-100 dark:border-zinc-800"
                            >
                              <div className="flex items-center justify-between gap-2 text-zinc-400">
                                <span className="truncate">$ {cmd.command}</span>
                                <span
                                  className={
                                    cmd.exitCode === 0
                                      ? "shrink-0 tabular-nums text-emerald-400"
                                      : "shrink-0 tabular-nums text-rose-400"
                                  }
                                >
                                  exit {cmd.exitCode} · {cmd.durationMs}ms
                                </span>
                              </div>
                              {cmd.stdout ? (
                                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-zinc-200">
                                  {cmd.stdout}
                                </pre>
                              ) : null}
                              {cmd.stderr ? (
                                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-rose-300">
                                  {cmd.stderr}
                                </pre>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
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
                  ? `第 ${lastVerdict.round} 轮${VERDICT_LABEL[lastVerdict.verdict]}`
                  : "等待判定";
            return (
              <section key={history.criterion} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-medium">{history.criterion}</h4>
                  <span
                    className={
                      lastVerdict?.verdict === "unverified"
                        ? "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        : undefined
                    }
                  >
                    {resolution}
                  </span>
                </div>
                {history.verdicts.map((verdict, index) => (
                  <p key={`${verdict.round}-${index}`}>
                    第 {verdict.round} 轮 · {VERDICT_LABEL[verdict.verdict]}：{verdict.reason}
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
