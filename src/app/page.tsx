export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="max-w-xl text-center">
        <p className="mb-3 text-sm font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
          Atoms Studio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          可验证的 AI 应用生成
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          需求 → 验收标准 → QA 评分与自修复。脚手架已就绪，后续功能按 F1–F5
          逐步接入。
        </p>
      </div>
    </main>
  );
}
