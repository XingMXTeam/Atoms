# Atoms Studio — 可验证的 AI 应用生成

Atoms Studio 是一个面向 mainland-China 可达网络的演示产品：用可见的多 Agent 流水线（Planner / Architect / Engineer / QA）把自然语言需求变成可预览的前端应用，并用「生成后再验证」的方式做 ≤3 轮 QA 自修复。

> 定位：**可验证的 AI 应用生成**（Chinese UI）。匿名 `deviceId` 即可使用，无需注册。

## 架构概览

- **App shell**: Next.js App Router + TypeScript，中文界面，light/dark 跟随 `prefers-color-scheme`。
- **Agent loop**: 服务端 SSE 流水线；Provider 模式 `gemini` / `mock` / `replay`（默认采用低成本 Gemini Flash/Lite，配额耗尽、鉴权失败或上游异常时自动切换 DeepSeek 实时兜底，主备均不可用时首轮回退到高质量「演示回放」，增量迭代显式报错保护现有版本）。流水线实时统计上游 `usageMetadata` / `usage` token 用量，并在 QA 环节通过 `POST /api/.../probe` + D1 `preview_probes` 接入浏览器沙箱真实 DOM/错误探测报告（超时回退到服务端静态探测）。
- **Preview (Plan A)**: 浏览器内 `esbuild-wasm` 打包 + `sandbox="allow-scripts allow-forms"`（严禁 `allow-same-origin`）iframe 预览。**不使用 WebContainer。**
- **China reachability**: 运行时不依赖外部 CDN。`esbuild.wasm`、白名单 ESM vendor、Tailwind 浏览器构建均自托管在同源 `/preview/*`。
- **Persistence**: Cloudflare D1 + Drizzle（本地/e2e 用 better-sqlite3，同一 repository 接口）。
- **Deploy**: OpenNext → Cloudflare Workers，自定义域名 `atoms.maoxunxing.com`，Worker `placement: { region: "aws:us-east-1" }`（避免部分区域无法访问 Gemini）。

```text
Browser (Chinese UI)
  ├─ Home / Workbench / Share
  ├─ Agent timeline + follow-up
  └─ iframe preview ← same-origin /preview/* (wasm · vendor · tailwind)
         ↑
Next.js (OpenNext Worker, aws:us-east-1)
  ├─ SSE agent pipeline (Gemini | mock | replay)
  └─ D1 / SQLite repository
```

## 本地开发

```bash
pnpm install
cp .env.example .dev.vars   # 填入本地变量；切勿提交真实密钥
LLM_PROVIDER=mock pnpm dev  # 推荐本地/测试用 mock
```

常用脚本：

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 本地开发服务器 |
| `pnpm typecheck` / `pnpm lint` | 静态检查 |
| `pnpm test` | Vitest 单元测试 |
| `LLM_PROVIDER=mock pnpm test:e2e` | Playwright（需先 `pnpm build`；webServer 用 `next start`） |
| `pnpm build` | 生产构建 |
| `pnpm run build:cf` | OpenNext Cloudflare 构建 |

验证整条交付门禁：

```bash
fh verify   # typecheck / lint / unit / e2e / build（e2e 固定 LLM_PROVIDER=mock）
```

## 交付文档

- 详细交付说明（思路与取舍 / 完成度 / 后续规划 / Cloudflare 部署步骤）：[`docs/DELIVERY.md`](docs/DELIVERY.md)
- 短文入口（同内容）：[`docs/writeup.md`](docs/writeup.md)
- 产品决策与实现计划：[`docs/plan/decisions.md`](docs/plan/decisions.md)、[`docs/plan/implementation_plan.md`](docs/plan/implementation_plan.md)

线上演示域名：**https://atoms.maoxunxing.com**（不要依赖 `*.workers.dev` 作为评测入口）。
