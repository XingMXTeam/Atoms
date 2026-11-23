import { getEnv } from "@/lib/env";

export type ModelClass = "flash" | "pro";

/** Map Planner/Architect → Flash, Engineer → Pro (REQ-8). */
export function resolveModelId(
  modelClass: ModelClass,
  source?: Record<string, string | undefined>,
): string {
  const env = getEnv(source);
  return modelClass === "flash" ? env.GEMINI_MODEL_FLASH : env.GEMINI_MODEL_PRO;
}

export function modelClassForStage(
  stage: "planner" | "architect" | "engineer" | "qa",
): ModelClass {
  return stage === "engineer" ? "pro" : "flash";
}
