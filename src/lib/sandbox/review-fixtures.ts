import type { SandboxReviewPlan } from "./review-types";
import type { SandboxFile } from "./types";

export function createDemo2048Files(options?: { brokenReset?: boolean }): SandboxFile[] {
  const brokenReset = options?.brokenReset === true;
  return [
    {
      path: "src/main.tsx",
      content: `import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);`,
    },
    {
      path: "src/game/engine.ts",
      content: `export type Board = number[][];

export function createInitialBoard(): Board {
  return [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
}

export function slideLineLeft(line: number[]): { next: number[]; gained: number } {
  const nonZero = line.filter((n) => n !== 0);
  const merged: number[] = [];
  let gained = 0;
  for (let i = 0; i < nonZero.length; i += 1) {
    if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
      const val = nonZero[i]! * 2;
      merged.push(val);
      gained += val;
      i += 1;
    } else {
      merged.push(nonZero[i]!);
    }
  }
  while (merged.length < 4) merged.push(0);
  return { next: merged, gained };
}

export function moveLeft(board: Board): { board: Board; gained: number; moved: boolean } {
  let gained = 0;
  let moved = false;
  const next = board.map((row) => {
    const res = slideLineLeft(row);
    gained += res.gained;
    if (res.next.some((v, idx) => v !== row[idx])) moved = true;
    return res.next;
  });
  return { board: next, gained, moved };
}

export function spawnTile(board: Board): Board {
  const copy = board.map((row) => [...row]);
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      if (copy[r]![c] === 0) {
        copy[r]![c] = 2;
        return copy;
      }
    }
  }
  return copy;
}

export function isGameOver(board: Board): boolean {
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const v = board[r]![c];
      if (v === 0) return false;
      if (c < 3 && v === board[r]![c + 1]) return false;
      if (r < 3 && v === board[r + 1]![c]) return false;
    }
  }
  return true;
}`,
    },
    {
      path: "src/App.tsx",
      content: `import { useEffect, useState } from "react";
import { createInitialBoard, isGameOver, moveLeft, spawnTile, type Board } from "./game/engine";

const STORAGE_KEY = "atoms-2048-state";

type SavedState = { board: Board; score: number };

function loadState(): SavedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedState;
      if (Array.isArray(parsed.board) && typeof parsed.score === "number") {
        return parsed;
      }
    }
  } catch {}
  return { board: createInitialBoard(), score: 0 };
}

export default function App({ initialBoard }: { initialBoard?: Board }) {
  const [state, setState] = useState<SavedState>(() =>
    initialBoard ? { board: initialBoard, score: 0 } : loadState(),
  );
  const gameOver = isGameOver(state.board);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        setState((prev) => {
          const moved = moveLeft(prev.board);
          if (!moved.moved) return prev;
          return {
            board: spawnTile(moved.board),
            score: prev.score + moved.gained,
          };
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleReset = () => {
    ${
      brokenReset
        ? `// Intentional bug for reviewer verification: fails to reset score
    setState((prev) => ({ ...prev, board: createInitialBoard() }));`
        : `setState({ board: createInitialBoard(), score: 0 });`
    }
  };

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">2048 经典版</h1>
      <div className="mt-2 flex items-center justify-between">
        <p data-testid="score">当前得分：{state.score}</p>
        <button type="button" onClick={handleReset} className="rounded border px-3 py-1">
          重新开始
        </button>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {state.board.flat().map((cell, i) => (
          <div key={i} className="flex h-16 items-center justify-center rounded border text-lg font-semibold">
            {cell === 0 ? "" : cell}
          </div>
        ))}
      </div>
      {gameOver ? (
        <div role="dialog" className="mt-4 rounded border bg-rose-50 p-4">
          <h2>游戏结束</h2>
          <p>已无法进行有效移动</p>
        </div>
      ) : null}
    </main>
  );
}`,
    },
  ];
}

export const DEMO_2048_REVIEW_PLAN: SandboxReviewPlan = {
  cases: [
    {
      criterion: "AC-1: 方向键移动数字方块并合并得分",
      strategy: "playwright",
      steps: [
        { type: "press", key: "ArrowLeft", count: 1 },
        { type: "wait", ms: 100 },
        { type: "assert", expectText: "当前得分：4", expectTextChanged: true, expectNoErrors: true },
      ],
      expectDescription: "按左方向键后 [2,2] 合并为 4 且得分变为 4",
    },
    {
      criterion: "AC-2: 移动后生成新数字且刷新页面持久化保留状态",
      strategy: "playwright",
      steps: [
        { type: "press", key: "ArrowLeft", count: 1 },
        { type: "wait", ms: 100 },
        { type: "reload" },
        { type: "wait", ms: 150 },
        { type: "assert", expectText: "当前得分：4", expectStorageChanged: true, expectNoErrors: true },
      ],
      expectDescription: "刷新页面后通过 localStorage 恢复得分 4 与盘面",
    },
    {
      criterion: "AC-3: 无法进行任何有效移动时触发游戏结束弹窗",
      strategy: "vitest",
      vitestCode: `
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App";
import { isGameOver } from "../src/game/engine";

describe("AC-3 Game Over boundary", () => {
  it("triggers game over modal on full deadlocked 4x4 board", () => {
    const deadlocked = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(isGameOver(deadlocked)).toBe(true);
    render(<App initialBoard={deadlocked} />);
    expect(screen.getByText("游戏结束")).toBeTruthy();
  });
});
`,
      expectDescription: "满盘死局时 isGameOver 为 true 且渲染「游戏结束」弹窗",
    },
    {
      criterion: "AC-4: 点击重置按钮清空棋盘并重置分数为 0",
      strategy: "playwright",
      steps: [
        { type: "press", key: "ArrowLeft", count: 1 },
        { type: "wait", ms: 80 },
        { type: "click", text: "重新开始", role: "button" },
        { type: "wait", ms: 100 },
        { type: "assert", expectText: "当前得分：0", expectNoErrors: true },
      ],
      expectDescription: "点击「重新开始」后得分清零回到 0",
    },
  ],
};
