import JSZip from "jszip";
import type { GeneratedFile } from "@/lib/agents/fixtures";

export type CreateVersionZipOptions = {
  /** Include runnable Vite + React + TypeScript + Tailwind scaffold files (#9). */
  includeScaffold?: boolean;
  /** Project title used in index.html and README.md when scaffolding. */
  title?: string;
};

function buildScaffoldFiles(
  existingPaths: ReadonlySet<string>,
  title: string,
): GeneratedFile[] {
  const safeTitle = title.replace(/[<>]/g, "").trim() || "Atoms App";
  const scaffold: GeneratedFile[] = [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "atoms-exported-app",
          private: true,
          version: "0.1.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "tsc --noEmit && vite build",
            preview: "vite preview",
          },
          dependencies: {
            react: "^19.0.0",
            "react-dom": "^19.0.0",
          },
          devDependencies: {
            "@tailwindcss/vite": "^4.1.0",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            "@vitejs/plugin-react": "^4.4.0",
            tailwindcss: "^4.1.0",
            typescript: "^5.8.0",
            vite: "^6.3.0",
          },
        },
        null,
        2,
      ) + "\n",
    },
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`,
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify(
        {
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
          },
          include: ["src"],
        },
        null,
        2,
      ) + "\n",
    },
    {
      path: "src/index.css",
      content: '@import "tailwindcss";\n',
    },
    {
      path: "README.md",
      content: `# ${safeTitle}

由 [Atoms Studio](https://atoms.maoxunxing.com) 导出的独立可运行工程（Vite + React + TypeScript + Tailwind CSS）。

## 本地运行

\`\`\`bash
npm install
npm run dev
\`\`\`

## 生产构建

\`\`\`bash
npm run build
npm run preview
\`\`\`
`,
    },
  ];

  return scaffold.filter((file) => !existingPaths.has(file.path));
}

export async function createVersionZip(
  files: readonly GeneratedFile[],
  options: CreateVersionZipOptions = {},
): Promise<Uint8Array> {
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
    const content =
      options.includeScaffold &&
      file.path === "src/main.tsx" &&
      !file.content.includes("./index.css")
        ? `import "./index.css";\n${file.content}`
        : file.content;
    zip.file(file.path, content);
  }

  if (options.includeScaffold) {
    for (const scaffoldFile of buildScaffoldFiles(
      addedPaths,
      options.title ?? "Atoms App",
    )) {
      zip.file(scaffoldFile.path, scaffoldFile.content);
    }
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
