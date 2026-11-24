import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center sm:px-6">
      <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        404 · 未找到页面或项目
      </div>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          无法访问此页面或项目
        </h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Atoms Studio 的工作台项目链接按当前浏览器匿名会话（Cookie）隔离。如果你清除了浏览器缓存、更换了设备，或打开了他人直接复制的工作台地址栏链接，将无法访问该项目。
        </p>
        <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          如需跨设备查看或分享给他人，请项目作者在工作台点击「创建只读分享链接」生成 <code>/share/...</code> 链接。
        </p>
      </div>
      <Link
        href="/"
        className="atoms-focus-ring atoms-btn-press inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        返回首页
      </Link>
    </main>
  );
}
