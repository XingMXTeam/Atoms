export type SandboxBackend =
  | "cloudflare-sandbox"
  | "local-node-sandbox"
  | "worker-static-verifier";

export type SandboxFile = {
  path: string;
  content: string;
};

export type SandboxCommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type SandboxVerifyReport = {
  backend: SandboxBackend;
  /** True when code ran inside an OS/container isolated execution environment. */
  isolated: boolean;
  ok: boolean;
  commands: SandboxCommandResult[];
  errors: string[];
  durationMs: number;
};
