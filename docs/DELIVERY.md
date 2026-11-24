# Atoms Studio 交付说明

本文档对应产品「可验证的 AI 应用生成」的交付写稿。仅 paraphrased 需求与工程取舍，**不含**招聘简章原文或任何密钥。

## 思路与取舍

### Plan A：`esbuild-wasm` 预览，而不是 WebContainer

预览链路选择浏览器内 `esbuild-wasm` + 同源 vendor ESM + iframe `sandbox="allow-scripts allow-forms"`（Plan A），刻意不做 WebContainer / 完整 Node 运行时：

- 评测与演示环境网络不确定，WebContainer 依赖的额外运行时/CDN 更容易失败。
- 生成目标是小型前端原型（有限文件数），本机打包足够，复杂度更低、失败面更小。
- iframe 保持 `allow-scripts allow-forms`（严禁 `allow-same-origin`），降低预览逃逸面同时支持交互式表单提交。

### 中国大陆可达性

评测者很可能在 mainland-China 网络。运行时硬约束：

- **禁止**请求 `esm.sh`、`unpkg`、`jsdelivr`、`cdn.tailwindcss.com`、`fonts.googleapis.com`、`fonts.gstatic.com`。
- 自托管 `/preview/esbuild.wasm`、`/preview/vendor/*`、`/preview/tailwind-browser.js`，并配长期 `Cache-Control`（`immutable`）。
- UI 仅用系统字体栈，避免外部字体 CDN 带来的 CLS 与屏蔽。
- Playwright `cdn-audit` 覆盖 `/`、`/projects/[id]`、`/share/[slug]`，发现违规主机名即失败。

### LLM 与区域

- Gemini / DeepSeek **只走服务端** REST SSE；前端永不接触密钥。
- Worker 固定 `placement.region = "aws:us-east-1"`，避开部分区域（例如 HKG）对 Gemini 出口的限制。
- Provider 三态：`gemini`（生产主链 + `DEEPSEEK_API_KEY` 二级实时兜底）、`mock`（确定性 e2e）、`replay`（主备均不可用时首轮自动回退至高质量待办示例并在 UI 标注「演示回放」；增量追问拒绝破坏性回退，保留既有版本）。
- 基于真实 `usageMetadata` / DeepSeek `usage` 统计 `tokens_in / tokens_out` 与每日 `usage.tokens`，联合 `DEVICE_DAILY_RUN_LIMIT` 与 `DAILY_TOKEN_CAP` 在 SSE 入口执行限流降级。

### Harness-in-product

功能按 `foundation → generate-loop → qa-self-heal → iterate-versions → polish` 用 frontend-harness-cli 全环路推进：clarify → implement → verify → eval。产品内的「生成后再验证」与工程上的 harness 门禁同构——可观测流水线 + 可回归证据，而不是一次性脚本生成。

### 其他刻意选择

- 匿名 `deviceId` cookie，无注册。
- 自定义域名 `atoms.maoxunxing.com`；文档与评测入口**不**依赖 `*.workers.dev`。
- OpenNext + Workers（相对更新的 vinext，优先成熟稳定）。

## 完成度

### 已完成

| 能力 | 说明 |
|---|---|
| 中文壳与视觉 | Home / Workbench / Share；light/dark；`prefers-reduced-motion` 关闭装饰动画 |
| 多 Agent 时间线 | Planner / Architect / Engineer / QA 可见状态与事件 |
| 生成 → 预览 & 持久化 | SSE 流水线 + esbuild-wasm 同源预览 + 安全 `postMessage` 存储桥（D1 `project_state` 持久化，整页刷新保留待办/进度，不放开 `allow-same-origin`） |
| QA 自修复 & 后台沙箱 | 浏览器 `postMessage` 探针 + 可插拔后台执行沙箱（Cloudflare Sandbox / Node 隔离 `tsc --noEmit` / Worker 校验器）+ 验收标准判定，≤3 轮自修复；达上限展示「已达修复上限」 |
| 迭代与版本 | 工作台 follow-up、版本时间线、回滚 |
| 分享与导出 | 只读 `/share/[slug]`、ZIP 下载（进行中禁用反馈） |
| 预览宽度 | `桌面` / `移动 375px`，沙箱仍保持无 `allow-same-origin` |
| 性能 | 新会话首页先返回外壳，示例项目在首屏之后写入；`/preview/*` 与 `/_next/static/*` 长缓存、空闲预加载 `esbuild.wasm` |
| 可达性审计 | 脚本化 CDN 网络审计 |
| 验证门禁 | `fh verify`：typecheck / lint / unit / e2e / build |

### 已知限制

- 生成规模有意受限（少量文件的前端原型），不是任意全栈应用工厂；预览运行于 `sandbox="allow-scripts allow-forms"`（无 `allow-same-origin`），通过安全 `postMessage` 桥代理 `localStorage` 并持久化到 D1 `project_state`（上限 64KB / 100 键，仍禁止 `document.cookie`）。
- 后台执行沙箱采用分层可插拔架构：配置 `SANDBOX_BRIDGE_URL` 时走 Cloudflare Sandbox 容器（仓库提供 `Dockerfile.sandbox`），本地 Node 环境自动走隔离临时目录 + 脱敏环境变量执行真实 `tsc --noEmit`，Cloudflare Workers 未开通 Containers 时自动降级为服务端静态/策略校验器并透明标注。
- 实时模型质量受上游模型波动影响；主模型遇到额度/鉴权/网络故障时自动切换 DeepSeek 实时备选，仅在所有实时模型都不可用时首次生成回退到 `replay`，增量追问则直接报错并保留当前版本。
- 若浏览器端在轮询窗口（第 0 轮 12s / 后续轮 6s）内未提交 `POST /probe`，QA 自动回退到服务端静态探测。
- OpenNext 增量缓存目前使用 dummy override，未接 R2。
- 移动端是预览框宽度约束，不是独立响应式产品站。
- 新设备的示例项目由 `POST /api/session/projects` 在首屏之后写入，并用稳定 id + `INSERT OR IGNORE` 避免并发播种出第二套项目。项目页读取使用 D1 session bookmark，没有 bookmark 时走 `first-primary`。
- HTTPS 下 `deviceId` 为 `Secure; HttpOnly; SameSite=Lax`，安全响应头（CSP / HSTS / `X-Frame-Options` / `X-Content-Type-Options` / `Referrer-Policy` / `Permissions-Policy`）已在应用层统一生效，`/robots.txt` 与 `/sitemap.xml` 已上线可访问；`www` 子域名暂未注册。

## 开发投入与人机协作复盘

本项目完整采用 **Harness 驱动的 AI 无人值守研发 + 人工高杠杆验收与架构决策** 模式完成。以下时间与介入统计均基于仓库 Git 提交历史与实际联调记录（时间均为北京时间 CST）：

### 时间与节奏总览

| 维度 | 实际投入 | 说明 |
|---|---|---|
| 总日历跨度 | 约 **18 小时** | `2026-11-23 16:15` 初始提交 → `2026-11-24 10:33` 完成全部修复、测试报告闭环与线上回填 |
| 无人值守自动研发 | 约 **8.3 小时**（含夜间连续 **5.3 小时** 全自动推进） | `11-23 16:15–19:21`（约 3h）与 `11-23 23:28–11-24 04:44`（约 5.3h 夜间无人值守），由 Agent 按 `clarify → implement → verify → eval` 闭环自动完成 `F1–F5` 全部 5 个阶段与 54 次提交 |
| 人工集中介入与验收 | 约 **3 小时** | `11-24 07:28–10:33`，聚焦真机实测、生产部署运维、容灾架构拍板、独立测试报告评审与线上回归 |
| 关键人工介入次数 | **8 次** | 每次均围绕高杠杆决策、真实用户故事验收或生产环境问题，而非手写样板代码 |
| 交付规模与验证 | **68+ 次提交 / 3 个核心 PR** | `fh verify`（`typecheck` / `lint` / `unit` / `build` / `e2e`）全绿 + 真实 DeepSeek 端到端实测 + 线上 Cloudflare Workers 多轮回归 |

### 主要人工介入内容（8 次核心节点）

1. **初始方向与技术方案锁定（`11-23 16:15`）**
   确定「可验证的 AI 应用生成」产品定位、中国大陆可达性红线（零外部 CDN）、Plan A（`esbuild-wasm` 同源沙箱）与 `frontend-harness-cli` 五阶段拆分，随后放手让 Agent 夜间无人值守推进。
2. **Cloudflare 生产环境接入与绑定排错（`11-24 07:28`）**
   绑定线上 D1 `database_id`、自定义域名 `atoms.maoxunxing.com` 与 API Secret，定位并解决首次部署时的 D1 绑定报错（`code: 10181`）。
3. **首轮真机点击验收（`11-24 07:41–08:04`）**
   实测线上示例项目并截图反馈，发现「已完成项目时间线仍卡在规划师进行中」与「预览缺少 Tailwind 样式」，推动自托管 Tailwind 浏览器运行时与时间线水合修复。
4. **真实用户故事全链路压测 + 架构与规则沉淀（`11-24 08:04–08:40`）**
   人工执行完整用户故事（生成待办 →「优化下UI界面」→「点击添加按钮没有反应」→「版本历史恢复此版本」），暴露沙箱缺 `allow-forms`、`localStorage` 触发 `SecurityError`、后续迭代丢失原 UI 以及版本恢复状态不同步 4 个真实痛点；同时主导开展 **Git 历史包袱考古 + 新人认知成本审计 + Bug 复盘**，将踩坑沉淀为项目规则（`CLAUDE.md`）、专属 Skill（`ai-app-sandbox-guardrails`）与自动化回归测试。
5. **交付验收自检与核心缺口补齐（`11-24 08:40–09:01`）**
   对照笔试目标逐项盘点，决策补齐跨 Worker Isolate 的浏览器真实探针持久化（`0001_preview_probes.sql` + `POST /probe`）与基于真实 `usageMetadata` 的 Token 计费限流，合入 PR #1。
6. **线上额度耗尽排障与多模型实时容灾决策（`11-24 09:01–10:02`）**
   线上实测发现触发「演示回放」降级；定位为 Gemini 预付额度耗尽（HTTP 402）后，拍板引入低成本默认模型 + **DeepSeek 实时二级兜底**（配置 `DEEPSEEK_API_KEY`），并在真实模型端到端实测中顺带挖出并修复了 QA 空 `fixInstruction` 崩溃、后续迭代未先合并增量文件导致预览白屏、旧预览探针串味（stale-probe）3 个深层 Bug，合入 PR #3。
7. **引入外部独立测试报告并完成 Review 与重部署（`11-24 09:03–10:25`）**
   引入独立 HTTP + 浏览器测试报告（识别新会话首屏 TTFB 3.3–4.2s、D1 读一致性、安全响应头与 `Secure` Cookie、示例项目 `0s` 耗时真实性等 P1–P4 问题），并行修复合入 PR #2（`3055e18`）后完成人工 Review、全量验证与重新部署，将新会话首屏 TTFB 压降至 `0.57s`。
8. **存量老会话数据兼容性收尾（`11-24 10:30–10:33`）**
   使用老会话 Cookie 复测首页示例项目，发现早期 D1 存量无样式种子记录未自动刷新，定向原地回填 80 条存量历史版本，确保新老访客一致体验。

### 人机分工心得

- **交给 AI 无人值守的**：脚手架搭建、结构化多模块实现、单测/E2E 编写、重复回归门禁（`fh verify`）与批量清理重构。
- **必须由人把关的**：架构边界与取舍（Plan A vs WebContainer、中国大陆零外部 CDN）、真实用户视角的多轮交互压测、生产环境容灾与成本权衡（Gemini + DeepSeek 双活兜底）、引入外部客观测试闭环，以及把一次性修 Bug 沉淀为长期规则与自动化守卫。

## 后续规划

按优先级：

1. **R2 / 增量缓存**：降低重复构建与静态资源成本。
2. **更丰富的 seeded 示例**与失败路径演示（编译错误 → 自修复叙事）。
3. **可观测性**：Worker 侧 run/token 指标面板与流式输出进度细化。
4. **体验增强**（不阻塞交付）：更细的版本 diff、分享页性能对照、可选的预览 console 面板。

若预算吃紧，可砍顺序仍为：zip → share → 移动宽度切换 → 合并 Planner+Architect（时间线仍显示两角色）。**不砍** foundation / generate-loop / qa-self-heal。

## Cloudflare 部署步骤

目标域名：**atoms.maoxunxing.com**。Worker placement 必须保持 `aws:us-east-1`（见根目录 `wrangler.jsonc`）。不要把评测入口写到 `*.workers.dev`。

### 1. 登录与域名

```bash
npx wrangler login
# 确认 atoms.maoxunxing.com 已挂在同一 Cloudflare 账号/Zone
```

### 2. 创建 D1 并回填 id

```bash
npx wrangler d1 create atoms-demo
# 将输出的 database_id 写入 wrangler.jsonc → d1_databases[0].database_id
```

### 3. 迁移 schema

仓库已包含迁移文件 `migrations/0000_init.sql`、`migrations/0001_preview_probes.sql` 与 `migrations/0002_project_state.sql`（与 `src/lib/db/schema.ts` 一致，并在 `wrangler.jsonc` 中配好 `migrations_dir`）。直接应用到远程 D1：

```bash
npx wrangler d1 migrations apply atoms-demo --remote
```

如需在后续修改 `src/lib/db/schema.ts` 后生成新迁移，可执行 `pnpm exec drizzle-kit generate`。本地开发与 E2E（better-sqlite3）由应用启动路径自动建表；勿把生产密钥写入 SQLite 文件。

### 4. 配置密钥与变量

```bash
# 交互写入；不要在 shell history 文档里粘贴真实值
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put DEEPSEEK_API_KEY   # 可选：Gemini 不可用时的实时二级兜底

# 可选：在 Dashboard / wrangler 中设置
#   LLM_PROVIDER=gemini
#   DAILY_TOKEN_CAP / DEVICE_DAILY_RUN_LIMIT
```

本地可复制 `.env.example` → `.dev.vars`。`.dev.vars` 与真实密钥严禁提交。

### 5. 构建并部署

```bash
pnpm install
pnpm run build:cf
npx wrangler deploy
```

`wrangler.jsonc` 已声明：

- `routes`: `atoms.maoxunxing.com`（`custom_domain: true`）
- `placement.region`: `aws:us-east-1`
- D1 binding: `DB`

### 6. 冒烟检查

1. 打开 https://atoms.maoxunxing.com — 中文首页与「我的项目」示例可见。
2. 生成一个简单应用，确认 Agent 时间线与预览。
3. 开发者工具 Network：无外部 CDN 主机名。
4. 当 Gemini 与 DeepSeek 同时失效或未配置可用密钥时，首轮应出现「演示回放」而不是白屏。

---

相关入口：[README.md](../README.md) · [docs/writeup.md](./writeup.md) · [docs/plan/decisions.md](./plan/decisions.md)
