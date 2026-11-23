# Atoms Studio 交付说明

本文档对应产品「可验证的 AI 应用生成」的交付写稿。仅 paraphrased 需求与工程取舍，**不含**招聘简章原文或任何密钥。

## 思路与取舍

### Plan A：`esbuild-wasm` 预览，而不是 WebContainer

预览链路选择浏览器内 `esbuild-wasm` + 同源 vendor ESM + iframe `sandbox="allow-scripts"`（Plan A），刻意不做 WebContainer / 完整 Node 运行时：

- 评测与演示环境网络不确定，WebContainer 依赖的额外运行时/CDN 更容易失败。
- 生成目标是小型前端原型（有限文件数），本机打包足够，复杂度更低、失败面更小。
- iframe 保持 `allow-scripts` only（无 `allow-same-origin`），降低预览逃逸面。

### 中国大陆可达性

评测者很可能在 mainland-China 网络。运行时硬约束：

- **禁止**请求 `esm.sh`、`unpkg`、`jsdelivr`、`cdn.tailwindcss.com`、`fonts.googleapis.com`、`fonts.gstatic.com`。
- 自托管 `/preview/esbuild.wasm`、`/preview/vendor/*`、`/preview/tailwind.css`，并配长期 `Cache-Control`。
- UI 仅用系统字体栈，避免外部字体 CDN 带来的 CLS 与屏蔽。
- Playwright `cdn-audit` 覆盖 `/`、`/projects/[id]`、`/share/[slug]`，发现违规主机名即失败。

### LLM 与区域

- Gemini **只走服务端** REST SSE；前端永不接触密钥。
- Worker 固定 `placement.region = "aws:us-east-1"`，避开部分区域（例如 HKG）对 Gemini 出口的限制。
- Provider 三态：`gemini`（生产）、`mock`（确定性 e2e）、`replay`（错误/配额自动回退，UI 标注「演示回放」）。
- 另有按 `deviceId` / IP 的限流与全局日 token 软顶，避免演示被刷穿。

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
| 生成 → 预览 | SSE 流水线 + esbuild-wasm 同源预览 |
| QA 自修复 | 预览 probe + 验收标准判定，≤3 轮；达上限展示「已达修复上限」 |
| 迭代与版本 | 工作台 follow-up、版本时间线、回滚 |
| 分享与导出 | 只读 `/share/[slug]`、ZIP 下载（进行中禁用反馈） |
| 预览宽度 | `桌面` / `移动 375px`，沙箱仍为 `allow-scripts` |
| 性能 | `/preview/*` 长缓存、空闲预加载 `esbuild.wasm` |
| 可达性审计 | 脚本化 CDN 网络审计 |
| 验证门禁 | `fh verify`：typecheck / lint / unit / e2e / build |

### 已知限制

- 生成规模有意受限（少量文件的前端原型），不是任意全栈应用工厂。
- Live Gemini 质量受模型波动影响；确定性演示依赖 `mock` / `replay`。
- OpenNext 增量缓存目前使用 dummy override，未接 R2。
- `wrangler.jsonc` 中的 D1 `database_id` 在首次 `wrangler d1 create` 前仍是占位符，需部署者替换。
- 移动端是预览框宽度约束，不是独立响应式产品站。

## 后续规划

按优先级：

1. **完成 Cloudflare 生产接线**：`wrangler login`、真实 D1 id、secret、自定义域名冒烟（含 SSE）。
2. **R2 / 增量缓存**：降低重复构建与静态资源成本。
3. **更丰富的 seeded 示例**与失败路径演示（编译错误 → 自修复叙事）。
4. **可观测性**：Worker 侧 run/token 指标与告警，便于演示日控量。
5. **体验增强**（不阻塞交付）：更细的版本 diff、分享页性能对照、可选的预览 console 面板。

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

仓库已包含初始化迁移 `migrations/0000_init.sql`（与 `src/lib/db/schema.ts` 一致，并在 `wrangler.jsonc` 中配好 `migrations_dir`）。直接应用到远程 D1：

```bash
npx wrangler d1 migrations apply atoms-demo --remote
```

如需在后续修改 `src/lib/db/schema.ts` 后生成新迁移，可执行 `pnpm exec drizzle-kit generate`。本地开发与 E2E（better-sqlite3）由应用启动路径自动建表；勿把生产密钥写入 SQLite 文件。

### 4. 配置密钥与变量

```bash
# 交互写入；不要在 shell history 文档里粘贴真实值
npx wrangler secret put GEMINI_API_KEY

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
4. 人为制造 Gemini 失败/配额场景时，应出现「演示回放」而不是白屏。

---

相关入口：[README.md](../README.md) · [docs/writeup.md](./writeup.md) · [docs/plan/decisions.md](./plan/decisions.md)
