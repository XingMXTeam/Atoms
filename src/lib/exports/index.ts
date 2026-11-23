import JSZip from "jszip";
import type { GeneratedFile } from "@/lib/agents/fixtures";

export async function createVersionZip(files: readonly GeneratedFile[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const addedPaths = new Set<string>();

  for (const file of files) {
    if (!isSafeArchivePath(file.path)) {
      throw new Error(`Unsafe export path: ${file.path}`);
    }
    if (addedPaths.has(file.path)) {
      throw new Error(`Duplicate export path: ${file.path}`);
    }
    addedPaths.add(file.path);
    zip.file(file.path, file.content);
  }

  return zip.generateAsync({ type: "uint8array" });
}

function isSafeArchivePath(path: string): boolean {
  if (!path || path.includes("\\") || path.includes("\0") || path.startsWith("/")) {
    return false;
  }
  const segments = path.split("/");
  return segments.every(
    (segment) => segment !== "" && segment !== "." && segment !== "..",
  ) && !/^[a-zA-Z]:/.test(path);
}
