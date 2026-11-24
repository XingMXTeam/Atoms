import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { SandboxCommandResult, SandboxFile, SandboxVerifyReport } from "./types";

const execFileAsync = promisify(execFile);
const SANDBOX_CMD_TIMEOUT_MS = 15_000;

function resolveTscBin(): string | null {
  const candidate = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsc.cmd" : "tsc",
  );
  return fs.existsSync(candidate) ? candidate : null;
}

function sanitizeRelativePath(filePath: string): string | null {
  const normalized = path.posix
    .normalize(filePath.replace(/\\/g, "/"))
    .replace(/^\/+/, "");
  if (!normalized || normalized.startsWith("..") || normalized.includes("/../")) {
    return null;
  }
  return normalized;
}

function parseTscErrors(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && /error TS\d+:/.test(line))
    .slice(0, 12);
}

/**
 * Executes real `tsc --noEmit` inside an isolated temporary workspace directory
 * with stripped environment variables (zero secrets) and a strict timeout.
 */
export async function runLocalNodeSandbox(
  files: SandboxFile[],
): Promise<SandboxVerifyReport | null> {
  const tscBin = resolveTscBin();
  if (!tscBin) return null;

  const started = Date.now();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "atoms-sbx-"));

  try {
    const nodeModulesSrc = path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "node_modules",
    );
    if (fs.existsSync(nodeModulesSrc)) {
      fs.symlinkSync(nodeModulesSrc, path.join(tmpDir, "node_modules"), "dir");
    }

    const writtenPaths: string[] = [];
    for (const file of files) {
      const rel = sanitizeRelativePath(file.path);
      if (!rel) continue;
      const target = path.join(tmpDir, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content, "utf8");
      writtenPaths.push(rel);
    }

    const tsconfig = {
      compilerOptions: {
        target: "ES2022",
        lib: ["DOM", "DOM.Iterable", "ES2022"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: false,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        isolatedModules: true,
        types: [],
      },
      include: ["src/**/*"],
    };
    fs.writeFileSync(
      path.join(tmpDir, "tsconfig.json"),
      JSON.stringify(tsconfig, null, 2),
      "utf8",
    );

    const cmdStart = Date.now();
    let exitCode = 0;
    let stdout = "";
    let stderr = "";
    try {
      const res = await execFileAsync(tscBin, ["--noEmit", "-p", "tsconfig.json"], {
        cwd: tmpDir,
        timeout: SANDBOX_CMD_TIMEOUT_MS,
        maxBuffer: 256 * 1024,
        env: {
          PATH: process.env.PATH ?? "",
          NODE_ENV: "production",
        },
      });
      stdout = String(res.stdout ?? "").trim();
      stderr = String(res.stderr ?? "").trim();
    } catch (err) {
      const execErr = err as {
        code?: number | string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      exitCode = typeof execErr.code === "number" ? execErr.code : 1;
      stdout = String(execErr.stdout ?? "").trim();
      stderr = String(execErr.stderr ?? execErr.message ?? "tsc failed").trim();
    }

    const cmdDurationMs = Math.max(1, Date.now() - cmdStart);
    const combinedOutput = [stdout, stderr].filter(Boolean).join("\n");
    const parsedErrors = exitCode === 0 ? [] : parseTscErrors(combinedOutput);
    const errors =
      exitCode === 0
        ? []
        : parsedErrors.length > 0
          ? parsedErrors
          : [combinedOutput.slice(0, 400) || "TypeScript 编译校验失败"];

    const commandResult: SandboxCommandResult = {
      command: "tsc --noEmit -p tsconfig.json",
      exitCode,
      stdout: (stdout || (exitCode === 0 ? `Checked ${writtenPaths.length} files cleanly.` : "")).slice(0, 2000),
      stderr: stderr.slice(0, 2000),
      durationMs: cmdDurationMs,
    };

    return {
      backend: "local-node-sandbox",
      isolated: true,
      ok: exitCode === 0,
      commands: [commandResult],
      errors,
      durationMs: Math.max(1, Date.now() - started),
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort temp cleanup.
    }
  }
}
