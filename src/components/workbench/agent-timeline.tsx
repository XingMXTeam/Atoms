"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  parseSseChunk,
  type AgentEventRecord,
  type AgentName,
} from "@/lib/agents/events";
import { AgentCard, type AgentCardModel, type AgentCardStatus } from "./agent-card";

type RunStatus = "running" | "completed" | "interrupted" | "failed";

type AgentTimelineProps = {
  projectId: string;
  initialRunId: string;
  initialRunStatus?: RunStatus | string;
};

const AGENT_ORDER: AgentName[] = ["planner", "architect", "engineer"];

function emptyCards(): AgentCardModel[] {
  return AGENT_ORDER.map((agent) => ({
    agent,
    status: "pending",
  }));
}

function applyEvent(
  cards: AgentCardModel[],
  event: AgentEventRecord,
  now: number,
): AgentCardModel[] {
  if (!AGENT_ORDER.includes(event.agent)) return cards;

  return cards.map((card) => {
    if (card.agent !== event.agent) {
      // When a later agent starts, mark earlier pending agents completed if they already have payload.
      if (
        AGENT_ORDER.indexOf(event.agent) > AGENT_ORDER.indexOf(card.agent) &&
        card.status === "running"
      ) {
        return {
          ...card,
          status: "completed",
          finishedAt: card.finishedAt ?? now,
        };
      }
      return card;
    }

    if (event.type === "error") {
      return {
        ...card,
        status: "error",
        finishedAt: now,
        payload: event.payload,
        startedAt: card.startedAt ?? now,
      };
    }

    return {
      ...card,
      status: "completed",
      startedAt: card.startedAt ?? now,
      finishedAt: now,
      payload: event.payload,
    };
  });
}

function markRunning(
  cards: AgentCardModel[],
  agent: AgentName,
  now: number,
): AgentCardModel[] {
  return cards.map((card) => {
    if (card.agent !== agent) return card;
    if (card.status === "completed" || card.status === "error") return card;
    return {
      ...card,
      status: "running",
      startedAt: card.startedAt ?? now,
    };
  });
}

function nextPendingAgent(cards: AgentCardModel[]): AgentName | null {
  for (const agent of AGENT_ORDER) {
    const card = cards.find((c) => c.agent === agent);
    if (!card || card.status === "pending") return agent;
    if (card.status === "running") return agent;
  }
  return null;
}

export function AgentTimeline({
  projectId,
  initialRunId,
  initialRunStatus = "running",
}: AgentTimelineProps) {
  const [runId, setRunId] = useState(initialRunId);
  const [runStatus, setRunStatus] = useState<RunStatus>(
    (initialRunStatus as RunStatus) || "running",
  );
  const [cards, setCards] = useState<AgentCardModel[]>(emptyCards);
  const [now, setNow] = useState(() => Date.now());
  const [continuePending, setContinuePending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const closeSource = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    const win = window as unknown as { __ATOMS_ABORT_SSE__?: () => void };
    delete win.__ATOMS_ABORT_SSE__;
  }, []);

  const connect = useCallback(
    (nextRunId: string) => {
      closeSource();
      setErrorMessage(null);
      setRunStatus("running");

      const delayRaw =
        typeof window !== "undefined"
          ? window.localStorage.getItem("atoms.generate-loop.stageDelayMs")
          : null;
      const delayMs = delayRaw ? Number(delayRaw) : 0;
      const params = new URLSearchParams();
      if (Number.isFinite(delayMs) && delayMs > 0) {
        params.set("stageDelayMs", String(Math.floor(delayMs)));
      }
      const qs = params.toString();
      const url = `/api/projects/${projectId}/runs/${nextRunId}/stream${
        qs ? `?${qs}` : ""
      }`;

      const source = new EventSource(url);
      sourceRef.current = source;

      const abortHook = () => {
        // Documented test hook (REQ-9): force client-side SSE disconnect.
        source.close();
        sourceRef.current = null;
        setRunStatus("interrupted");
        setCards((prev) =>
          prev.map((card) =>
            card.status === "running"
              ? { ...card, status: "interrupted", finishedAt: Date.now() }
              : card,
          ),
        );
        setErrorMessage("连接已中断。可点击「继续」重新生成。");
      };
      (window as unknown as { __ATOMS_ABORT_SSE__: () => void }).__ATOMS_ABORT_SSE__ =
        abortHook;

      // Kick the first pending agent into running so elapsed time starts.
      setCards((prev) => {
        const nextAgent = nextPendingAgent(prev) ?? "planner";
        return markRunning(prev, nextAgent, Date.now());
      });

      source.onmessage = (message) => {
        const event = parseSseChunk(`data: ${message.data}`);
        if (!event) return;
        const stamp = Date.now();

        setCards((prev) => {
          let next = applyEvent(prev, event, stamp);
          const idx = AGENT_ORDER.indexOf(event.agent);
          if (idx >= 0 && idx < AGENT_ORDER.length - 1) {
            const following = AGENT_ORDER[idx + 1];
            const followingCard = next.find((c) => c.agent === following);
            if (followingCard?.status === "pending") {
              next = markRunning(next, following, stamp);
            }
          }
          return next;
        });

        if (event.type === "error") {
          const payload = event.payload as { messageZh?: string } | null;
          setErrorMessage(payload?.messageZh ?? "生成失败，请稍后重试");
          setRunStatus("failed");
        }

        if (event.agent === "engineer" && event.type === "file") {
          setRunStatus("completed");
        }
      };

      source.onerror = () => {
        // Browser fires error on intentional close too; only mark interrupted
        // while we still expected the stream to be open.
        if (sourceRef.current !== source) return;
        source.close();
        sourceRef.current = null;
        const win = window as unknown as { __ATOMS_ABORT_SSE__?: () => void };
        delete win.__ATOMS_ABORT_SSE__;

        setRunStatus((prev) => {
          if (prev === "completed" || prev === "failed") return prev;
          return "interrupted";
        });
        setCards((prev) => {
          const hasOpen = prev.some(
            (card) => card.status === "running" || card.status === "pending",
          );
          if (!hasOpen) return prev;
          return prev.map((card) =>
            card.status === "running" || card.status === "pending"
              ? {
                  ...card,
                  status:
                    card.status === "running" ? "interrupted" : card.status,
                  finishedAt:
                    card.status === "running" ? Date.now() : card.finishedAt,
                }
              : card,
          );
        });
        setErrorMessage((prev) => prev ?? "连接已中断。可点击「继续」重新生成。");
      };
    },
    [closeSource, projectId],
  );

  useEffect(() => {
    if (!runId) return;
    if (initialRunStatus === "interrupted") {
      setRunStatus("interrupted");
      setErrorMessage("连接已中断。可点击「继续」重新生成。");
      return;
    }
    if (initialRunStatus === "completed" || initialRunStatus === "failed") {
      // Still open the stream once to hydrate persisted events.
    }
    connect(runId);
    return () => {
      closeSource();
    };
    // Intentionally connect once per mount / runId change via continue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const handleContinue = async () => {
    // Known limitation (REQ-9): 「继续」 starts a fresh run for this project;
    // it does not resume from an exact checkpoint.
    setContinuePending(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/runs/${runId}/continue`,
        { method: "POST" },
      );
      const data = (await response.json()) as {
        runId?: string;
        messageZh?: string;
      };
      if (!response.ok || !data.runId) {
        setErrorMessage(data.messageZh ?? "无法继续，请稍后重试");
        setContinuePending(false);
        return;
      }

      const url = new URL(window.location.href);
      url.searchParams.set("run", data.runId);
      window.history.replaceState({}, "", url.toString());

      setCards(emptyCards());
      setRunId(data.runId);
      setContinuePending(false);
    } catch {
      setErrorMessage("网络异常，请检查连接后重试");
      setContinuePending(false);
    }
  };

  const visibleCards = useMemo(
    () => cards.map((card) => ({ ...card, now })),
    [cards, now],
  );

  const showContinue =
    runStatus === "interrupted" ||
    runStatus === "failed" ||
    Boolean(errorMessage && runStatus !== "completed" && runStatus !== "running");

  return (
    <aside
      data-testid="agent-timeline"
      data-agent-timeline
      data-run-status={runStatus}
      className="flex min-h-64 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Agent 时间线
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {runStatus === "running"
            ? "生成中"
            : runStatus === "completed"
              ? "已完成"
              : runStatus === "interrupted"
                ? "已中断"
                : "失败"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {visibleCards.map((card) => (
          <AgentCard key={card.agent} card={card} />
        ))}
      </div>

      {errorMessage ? (
        <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
          {errorMessage}
        </p>
      ) : null}

      {showContinue ? (
        <button
          type="button"
          onClick={handleContinue}
          disabled={continuePending}
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:enabled:hover:bg-white"
        >
          {continuePending ? "继续中…" : "继续"}
        </button>
      ) : null}
    </aside>
  );
}

export type { AgentCardStatus };
