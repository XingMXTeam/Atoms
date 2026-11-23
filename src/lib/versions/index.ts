import type { GeneratedFile } from "@/lib/agents/fixtures";

export function mergeFileDelta(
  currentFiles: readonly GeneratedFile[],
  deltaFiles: readonly GeneratedFile[],
): GeneratedFile[] {
  const merged = new Map(currentFiles.map((file) => [file.path, file]));
  for (const file of deltaFiles) merged.set(file.path, file);
  return [...merged.values()];
}

export function parseVersionFiles(files: unknown): GeneratedFile[] {
  if (!Array.isArray(files)) {
    throw new Error("Version snapshot files must be an array");
  }

  return files.map((file) => {
    if (
      typeof file !== "object" ||
      file === null ||
      !("path" in file) ||
      typeof file.path !== "string" ||
      !file.path ||
      !("content" in file) ||
      typeof file.content !== "string"
    ) {
      throw new Error("Version snapshot contains an invalid file");
    }
    return { path: file.path, content: file.content };
  });
}
