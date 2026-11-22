# Checklist — Slice 20 Embedding Provider Port / DashScope Adapter Foundation

> Feature: `020-embedding-provider-adapter-foundation`
>
> Authority: `specs/020-embedding-provider-adapter-foundation/spec.md`（Frozen **Revision 4**，commit `95c37f45fade2dde9c90d2f16ba0e8430beadb1e`，blob `76c10f4fc81907cb1dcb37f5d522ec7086efef5b`）
>
> **Governance Mode: MODE A — NATIVE HTTP**（native HTTP + `globalThis.fetch`；零 provider 依赖；
> `scripts/guard-static.mjs` 与 base 字节级一致；无 allowance、无 provider import fixture）
>
> Plan: `specs/020-embedding-provider-adapter-foundation/plan.md`
>
> 用途：Developer AI 的**开发完成标准**，也是 Audit 2 可机械逐项勾选的验收集合。
> 每一项都必须能回答 `PASS` 或 `FAIL`；不允许「N/A（未评估）」「基本满足」「后续补」。
>
> 勾选规则：
> - PASS 必须附**新鲜执行证据**（命令 + 真实输出 + 时间）。
> - 无法执行 → 记 `BLOCKED` / `NOT VERIFIED`，**不得**记 PASS。
> - 不允许为了让实现通过而修改本 Checklist、`spec.md`、既有测试或既有 fixture。

```text
Legend
  [ ] = 未验证 / 待执行
  [x] = PASS（附证据）
  [B] = BLOCKED（附阻塞原因）
  [N] = NOT VERIFIED（附未验证原因）
本文件只允许 [ ] / [x] / [B] / [N]；**禁止**任何其它标记。
```

---

## A. Authority & Frozen Identity

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-A01 | Frozen Spec blob 未变 | `git hash-object specs/020-*/spec.md` == `76c10f4fc81907cb1dcb37f5d522ec7086efef5b`（Revision 4） | 任何字节差异 |
| CHK-A02 | Authority Docs 未变 | `git diff --name-only <base>...HEAD` 不含 `Docs/` | 含任一 `Docs/` 文件 |
| CHK-A03 | Slice 16–19 Authority 未变 | diff 不含 `specs/016-*`..`specs/019-*` | 含任一 |
| CHK-A04 | Spec 语义未被改写 | diff 不含 `specs/020-*/spec.md` | 含 `spec.md` |
| CHK-A05 | 上游 identifier 可回溯 | `plan.md` §1.1/§1.2 列出 `V1-C34`、`V1-X14`、§4.2/§13.2/§13.3/§20、§11.2/§11.3 | 缺失任一 |
| CHK-A06 | 无竞争 Slice 20 实现 | main 上无 `apps/server/api/src/ai/`；`packages/` 无 `ai|rag|memory` | 存在任一 |
| CHK-A07 | 未发现 Authority 冲突 | 无法从 `Docs/**` 推出与本 Slice 相反的语义 | 存在实质冲突却继续实现 |
| CHK-A08 | V1 Phase 识别正确 | 记录为 Phase 3，顺序与 §4.2 一致 | 发明并行 roadmap |

## B. Scope

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-B01 | 只新增 seam 目录 | 生产代码仅在 `apps/server/api/src/ai/embedding/` | 任一生产文件在 seam 外 |
| CHK-B02 | 未创建 `packages/ai|rag|memory` | 目录不存在；`guard-static` R6 PASS | 存在 |
| CHK-B03 | 未新增用户可见能力 | 无 route / 页面 / 推送 / 移动端改动 | 存在任一 |
| CHK-B04 | 无 DB 依赖 | seam 无 `pg` / `drizzle` / `db/` import；无 SQL | 存在任一 |
| CHK-B05 | 无 professional knowledge 依赖 | seam 无 `professional_knowledge_*` / `reviewer` / `approval` | 存在任一 |
| CHK-B06 | 无 Gold Dataset 依赖 | seam 与测试无 `tests/fixtures` 的 Gold 引用；无 label 结构 | 存在任一 |

## C. Governance Prerequisite

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-C01 | 治理 PR 独立于实现 PR | 治理 PR diff 无 `apps/**`、`packages/**`、`db/**`、`tests/**`、change-binding | 任一同车 |
| CHK-C02 | 治理 PR 先于实现 PR 合并 | 实现 PR base 已含 registry 规则 | 实现 PR 与 registry 同车 |
| CHK-C03 | specs 已先进入 main | `specs/020-*/spec.md` 在实现 PR base 存在 | 缺失 |
| CHK-C04 | ownership 只新增 1 条规则 | `rules[]` 增量 == 1 | 增量 > 1 |
| CHK-C05 | ownership path 精确 | `match.path === 'apps/server/api/src/ai/embedding/'` | 其余值 |
| CHK-C06 | ownership kind 为 PREFIX 且带尾 `/` | `kind==='PREFIX'` 且以 `/` 结尾 | EXACT（偏离冻结决定）或未带尾 `/` |
| CHK-C07 | ownership 为 FEATURE 且仅 1 个 feature | `ownership.kind==='FEATURE'`，`features.length===1`，值为 feature 目录名 | 其它 |
| CHK-C08 | 无宽泛授权 | 不存在 path 为 `apps/server/api/src/ai/`、`apps/server/api/src/providers/`、`apps/server/api/src/embeddings/` 或含通配符的规则 | 存在任一 |
| CHK-C09 | 未放宽其它 Feature 的 ownership | diff 仅新增 1 条，无修改/删除既有规则 | 有修改/删除 |
| CHK-C10 | Rule 8 全局条目完好 | `FORBIDDEN_SAFETY_IMPORTS` 仍含 `dashscope`、`@alicloud`、`openai`、`anthropic`、`guardrails`、`ollama`、`langchain` 等 | 删除任一 |
| CHK-C11 | 治理模式声明为 MODE A | `plan.md` 明示 `GOVERNANCE MODE: MODE A — NATIVE HTTP`；且实现确实为 native HTTP + `globalThis.fetch`、无 provider SDK import | 声明 MODE B，或声明与实际依赖不符 |
| CHK-C12 | guard blob 字节级等于 base（V15） | `git rev-parse <base>:scripts/guard-static.mjs` == `git rev-parse HEAD:scripts/guard-static.mjs` | 任一字节差异 |
| CHK-C13 | 不存在 allowance 定义 | `scripts/guard-static.mjs` 中无 `R8_PATH_SCOPED_ALLOWANCES`、无 `isR8PathAllowed`（MODE A） | 出现任一 |
| CHK-C14 | 不存在 provider import fixture | `--self-test` 输出 `PASS (39 synthetic fixtures validated)`；源码无 `slice20 …` fixture | 数量变化或存在新增 fixture |
| CHK-C15 | G1b diff 恰好 1 个文件 | `git diff --name-only <main>...HEAD` == `.specify/implementation-ownership.json` | 多出任何文件（尤其 `scripts/**`） |
| CHK-C16 | 依赖边界：无 provider SDK | `package.json` / lockfile / seam import 扫描 `dashscope`、`@alicloud`、provider SDK 命中 = 0（V16） | 命中 > 0 |
| CHK-C17 | provider egress 只在 seam | architecture test：seam 外无 `fetch(` 出网构造；seam 内仅 `transport.ts` | 存在 seam 外 direct provider integration |
| CHK-C18 | consumer 只经 Port | seam 外不得 import `ai/embedding/transport`、`ai/embedding/dashscope-protocol`；只能 import `index.ts` 导出面 | 存在 provider 专有模块外部引用 |
| CHK-C19 | approved endpoint policy | 只接受 `https://{host}/api/v1/services/embeddings/text-embedding/text-embedding`，host 落在批准后缀；无 override 参数/环境变量绕过 | 存在非批准 endpoint 或 override 通道 |
| CHK-C20 | unknown production path fail closed | 未注册 production path 使 `validate-change-governance` 失败；registry 无更宽 matcher | 未知路径被静默接受 |
| CHK-C21 | AS-036：MODE B NOT TRIGGERED | import 扫描命中 0 → allow set 与 fixtures 均不存在；无"为进入 MODE B"而加的 SDK | 出现 MODE B 形态但无真实 import 依据 |
| CHK-C22 | AS-035：MODE A governance evidence 完整 | C12 + C15 + C16 + C17 + C18 + C19 + C20 全部 PASS（六项缺一即 FAIL） | 任一缺失 |
| CHK-C23 | Rule 19 未被修改 | diff 不含 `scripts/guard-static.mjs`（因此必然不含 `checkPgvectorReadinessScope` 改动） | 有改动 |
| CHK-C24 | 治理 PR 自身通过校验 | `guard-static`、`--self-test`（39）、`validate-governance`、`run-change-governance-tests`、`validate-change-governance --base origin/main` 全部 PASS | 任一 FAIL |
| CHK-C25 | NS-039（MODE A 禁止预置放宽） | guard blob 相等 + 无新 fixture + diff 无 `scripts/**` + 无 allow set（C12/C13/C14/C15） | 任一违反 |
| CHK-C26 | NS-040（禁止为满足 Spec 引入 SDK） | `package.json` / lockfile 无新增 provider 依赖；依赖图无 `dashscope` / `@alicloud` import（C16） | 存在任一 |
| CHK-C27 | C20-21：治理模式由实际依赖决定 | native HTTP + 无 forbidden provider import → MODE A；ownership 无条件存在；无 allowance/fixture；若真实出现 provider import，必须先改 Spec 进入 MODE B | 声明与依赖不符，或未改 Spec 就切换 MODE B |

## D. Port Contract

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-D01 | Port 为 route-neutral | 请求类型无 route / candidate / winner 字段 | 存在 |
| CHK-D02 | 请求无 endpoint / secret / region 凭据 | 类型字段集合精确匹配 Plan 6.3 | 多出任一 |
| CHK-D03 | 必填字段齐全 | `requestId`、`configuredModelId`、`configuredModelVersionOrRevision`、`outputType`、`denseDimension`、`items` | 缺失任一 |
| CHK-D04 | 必填缺失 fail closed | 逐字段缺失 → `INVALID_REQUEST`/`BLOCKED`，transport 调用计数 0 | 任一字段缺失仍出网 |
| CHK-D05 | 响应字段完整 | dense、sparse、`providerRequestId`、usage、configured provenance、`providerModelEcho`、status | 缺失任一 |
| CHK-D06 | echo 状态枚举 | 只允许 `PROVIDER_MODEL_ECHO_VERIFIED` / `PROVIDER_MODEL_ECHO_NOT_AVAILABLE` | 其它值 |
| CHK-D07 | 批量顺序与长度 | N 输入 → N 输出，`items[k].index === k` | 顺序/长度不符 |
| CHK-D08 | all-or-nothing | 第 k 条失败 → `kind==='FAILED'` 且无 `result` | 返回部分结果 |
| CHK-D09 | 可注入 fake provider | 无真实凭据时全部契约测试 PASS | 需要真实凭据 |
| CHK-D10 | 调用方不可见 provider 字段 | `index.ts` 导出类型不含 `sparse_embedding` / `embeddings` / `usage.total_tokens` 等 provider 字段名 | 存在 |
| CHK-D11 | 输入校验覆盖 | 空数组 / 空白项 / 超 `MAX_INPUT_CHARS` / 超 `MAX_BATCH_SIZE` 各自稳定码且出网 0 | 静默截断或补默认值 |
| CHK-D12 | 输入零泄漏 | telemetry / 错误 / 日志抓取不含输入原文 | 存在原文 |
| CHK-D13 | Envelope valid：`output.embeddings` 接受 | 原生 HTTP 成功响应仅含 `output.embeddings`（无 top-level `embeddings`）→ 成功，`observedResponseEnvelope==='HTTP_OUTPUT_WRAPPED'` | 拒绝合法 `output.embeddings`，或 envelope 标记缺失/错误 |
| CHK-D14 | Envelope invalid flat：仅 top-level `embeddings` 拒绝 | 仅 top-level `embeddings` → `TERMINAL` / `MALFORMED_PROVIDER_RESPONSE`；不当作 native HTTP success | 接受 SDK-flat shape 为成功 |
| CHK-D15 | Envelope ambiguous：dual 拒绝 | `output.embeddings` + top-level `embeddings` 同时存在 → `TERMINAL` / `AMBIGUOUS_PROVIDER_RESPONSE`；无 precedence / merge / fallback | 选择其一、合并或静默回退 |
| CHK-D16 | Envelope unknown nesting 拒绝 | `data.embeddings` / `result.embeddings` / `payload.embeddings` / `response.embeddings` 或任意深层 → `TERMINAL` / `MALFORMED_PROVIDER_RESPONSE`；无 recursive/deep search | 任一被当作合法 envelope |
| CHK-D17 | Normalization：下游只见 canonical | wrapped 响应 normalize 后 consumer 仅见 `NormalizedProviderResponse`；raw provider envelope 不出 seam，且 `index.ts` 不导出 raw envelope | consumer 可见 raw envelope 或 provider 字段 |
| CHK-D18 | Evidence：真实观测 envelope | 真实 provider verification artifact 记录 `observed_response_envelope`；成功的 MODE A 证据必须为 `HTTP_OUTPUT_WRAPPED`；其它真实观测不得自动扩大 Spec | 缺失该字段，或把其它 shape 记为成功 |

## E. Dense Contract

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-E01 | 类型校验 | 非数组 / 非 number 元素 → `RESPONSE_MALFORMED` | 接受 |
| CHK-E02 | 有限性 | NaN / ±Infinity / 字符串数字 / 嵌套数组 → `DENSE_INVALID_VALUE` | 任一接受 |
| CHK-E03 | 维度严格相等 | `length !== denseDimension` → `DIMENSION_MISMATCH` | 截断/补零/降维 |
| CHK-E04 | 空向量拒绝 | dimension>0 时 length 0 → `DIMENSION_MISMATCH` | 接受 |
| CHK-E05 | 卡片性 | `embeddings.length !== items.length` → `DENSE_CARDINALITY_MISMATCH` | 接受 |
| CHK-E06 | index 完整性 | index 集合恰为 `0..n-1` 且唯一 | 缺失/重复/越界被接受 |
| CHK-E07 | 无持久化 | 无 INSERT/UPDATE/CREATE；diff 无 `db/**` | 存在任一 |
| CHK-E08 | 无跨请求缓存 | 相同输入两次调用 → transport 调用 2 次 | 缓存命中 |
| CHK-E09 | 维度非产品常量 | 无「某模型真实维度」常量；dimension 只来自配置 | 存在常量 |

## F. Sparse Payload Contract

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-F01 | 归一化结构 | 输出元素仅 `{index, value}` | 含 `token` 或其它字段 |
| CHK-F02 | 缺失 → UNSUPPORTED | 要求 sparse 但字段缺失 → `SPARSE_NOT_RETURNED` | 伪造空 sparse |
| CHK-F03 | present-empty 区分 | 字段存在且为 `[]` → 成功，`sparseElementCount===0` | 与缺失混为一谈 |
| CHK-F04 | 结构校验 | 非对象 / 非 number → `SPARSE_MALFORMED` | 接受 |
| CHK-F05 | index 非负整数 | `-1`、`3.5` → `SPARSE_INDEX_INVALID` | 接受 |
| CHK-F06 | index 唯一性 | 重复（含不同 token）→ `SPARSE_INDEX_DUPLICATE` | 排序/去重/last-wins 掩盖 |
| CHK-F07 | 不与 dense dimension 比较 | 代码中不存在该比较；`index=111290`（dim=1024）成功 | 存在比较或失败 |
| CHK-F08 | vocabulary bound 仅来自配置 | 无 `EMBEDDING_SPARSE_VOCABULARY_MAX` 时大 index 成功；有配置且超限时拒绝 | 硬编码上界 |
| CHK-F09 | value 有限性 | 非有限 → `SPARSE_VALUE_INVALID` | 接受 |
| CHK-F10 | 元素上限 | `N+1` → `SPARSE_LIMIT_EXCEEDED`，不截断 | 截断保留前 N |
| CHK-F11 | canonical 升序 | 输出严格递增；乱序输入结果确定 | 依赖 provider 顺序 |
| CHK-F12 | observed 不是 bound | `observedMaxSparseIndex` 存在且无「bound/limit」语义字段 | 被当作上界 |
| CHK-F13 | dense-only 不产 sparse | `outputType==='dense'` → `sparse===null` | 产出 sparse |
| CHK-F14 | 只到解析/校验 | 无 sparsevec 编码、无 DB 写入、无融合 | 存在任一 |

## G. Error Model

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-G01 | 四分类存在 | `BLOCKED` / `UNSUPPORTED` / `RETRYABLE` / `TERMINAL` 全部可被触发 | 缺失任一 |
| CHK-G02 | 配置缺失 → BLOCKED | 逐字段缺失 → `CONFIG_MISSING`/`CONFIG_INVALID` | 使用默认值 |
| CHK-G03 | secret 缺失 → BLOCKED | `SECRET_MISSING`，出网 0 | 出网或降级成功 |
| CHK-G04 | 认证失败 → TERMINAL | 401/403 → `AUTH_TERMINAL`，调用 1 次 | 重试或标为可用 |
| CHK-G05 | 限流 → RETRYABLE | 429 → `RATE_LIMITED` 且受预算 | 无限重试 |
| CHK-G06 | 超时 → RETRYABLE→TERMINAL | per-attempt `TIMEOUT` 可重试；耗尽 → `RETRY_EXHAUSTED` | 返回上次结果 |
| CHK-G07 | 5xx/网络 → RETRYABLE | `PROVIDER_UNAVAILABLE` | TERMINAL 且不重试 |
| CHK-G08 | malformed → TERMINAL | `RESPONSE_MALFORMED` | 接受 |
| CHK-G09 | unsupported output_type → UNSUPPORTED | `OUTPUT_TYPE_UNSUPPORTED` | 降级为 dense |
| CHK-G10 | 维度/sparse/model echo 错误 → TERMINAL | 各自稳定码 | 重试 |
| CHK-G11 | aborted → TERMINAL | `ABORTED`，不重试 | 重试或返回结果 |
| CHK-G12 | 错误对象零敏感信息 | 无 secret / Authorization / 原始 body / 堆栈 | 存在任一 |
| CHK-G13 | 耗尽不冒充成功 | `kind==='FAILED'` 且无向量 | 返回空向量/降级结果 |
| CHK-G14 | 无无限重试 | `MAX_ATTEMPTS ≤ 3` 且总预算硬上限 | 无上限 |

## H. Retry / Timeout

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-H01 | 每次调用有 timeout | `REQUEST_TIMEOUT_MS` 生效；超时在预算内结束 | 无界等待 |
| CHK-H02 | 总预算独立于单次预算 | `TOTAL_BUDGET_MS` 独立约束；`remaining<=0` → `DEADLINE_EXCEEDED` | 只有单次预算 |
| CHK-H03 | 重试受次数+时间双约束 | 连续 429 → 调用 ≤ 3 且总耗时 ≤ 预算 | 超任一项 |
| CHK-H04 | TERMINAL 不重试 | 400/401/403/维度 → 调用 1 次 | 重试 |
| CHK-H05 | Retry-After 尊重且不越预算 | `Retry-After > remaining` → 立即 `RETRY_AFTER_EXCEEDS_BUDGET` | 延长等待 |
| CHK-H06 | 退避确定性 | `min(base*2^(n-1), cap)`，无随机抖动 | 随机/无 cap |
| CHK-H07 | 取消被尊重 | abort 在 attempt 前/中/backoff 中均终止为 `ABORTED` | 忽略取消 |
| CHK-H08 | 无 provider fallback | 无第二 provider / 无 route 切换 | 存在 fallback |
| CHK-H09 | 并发隔离 | 两个不同 model 并发 → attempts/cost/telemetry 不串扰 | 串扰 |

## I. Secret

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-I01 | 唯一读取点 | 只有 `config.ts` 访问 `process.env` | 其它文件访问 env |
| CHK-I02 | secret 变量单一 | `DASHSCOPE_API_KEY`；无默认值 | 存在默认/备用 key |
| CHK-I03 | 不入启动期强依赖 | `app.ts` 不 import seam；`runtime-env.ts` 未新增 embedding 变量 | 启动失败于 embedding 配置 |
| CHK-I04 | 不进日志/telemetry/error/cost | 抓取断言无 secret 子串 | 出现 |
| CHK-I05 | 不进测试快照 | 快照/artifact 无真实凭据 | 出现 |
| CHK-I06 | 请求头即时拼接 | secret 只存在于出网调用栈局部变量 | 存入可序列化结构 |
| CHK-I07 | `.env*` 未修改 | diff 不含 `.env` / `.env.example` / `.env.*` | 含任一 |
| CHK-I08 | 仓库 secret 扫描 | 无可用凭据；测试只用 `test-*` 占位符 | 存在真实凭据 |
| CHK-I09 | secret 出网路径唯一 | secret 只在 `transport.ts` 的出网调用栈内拼接；seam 外无 provider 出网（与 CHK-C17 联合） | 存在第二条出网路径 |

## J. Telemetry

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-J01 | 白名单字段 | key 集合精确等于 Plan 6.9 列表 | 多出/缺失 |
| CHK-J02 | 字段语义完整 | requestId、provider、model/version、outputType、latency、attempts、status、errorClass/Code | 缺失任一必需项 |
| CHK-J03 | 零输入明文 | 无 `items` 原文 | 存在 |
| CHK-J04 | 零 secret | 无 key/Authorization | 存在 |
| CHK-J05 | endpoint 只记指纹 | 只有 `endpointConfigFingerprint`；无完整 URL | 完整 URL |
| CHK-J06 | sink 故障隔离 | sink 抛错 → 结果状态不变 | 结果被改写或失败 |
| CHK-J07 | 未接入 exporter | 无 OTel/Phoenix 依赖；默认 NOOP | 引入依赖 |
| CHK-J08 | 无 generic 可观测平台 | 无 registry/exporter 抽象层 | 存在 |

## K. Cost

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-K01 | request-level 字段完整 | `requestId`、provider `requestId`、`usage.totalTokens`、config provenance、pricing provenance | 缺失任一 |
| CHK-K02 | usage 粒度标注 | `granularity==='REQUEST_AGGREGATE'` | 其它 |
| CHK-K03 | per-item 恒为 NOT_PROVIDED | `perItemUsage==='NOT_PROVIDED'`、`perItemExactCost==='UNKNOWN'` | 有数值 |
| CHK-K04 | 禁止平摊/字符推算/填 0 | 代码中不存在相关计算 | 存在 |
| CHK-K05 | 未配置价格 → UNKNOWN | `totalCost==='UNKNOWN'`、`pricingProvenance==='NOT_CONFIGURED'` | 填 0 或估算为 exact |
| CHK-K06 | 估算不得标 exact | `ESTIMATED_FROM_CONFIGURED_PRICE` 与 exact 不共存 | 共存 |
| CHK-K07 | 进程内上限 | `COST_LIMIT_REACHED` 可触发且出网 0 | 无上限 |
| CHK-K08 | 无 billing platform | 无 DB/文件/账本 | 存在持久化 |

## L. Evidence

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-L01 | 三态存在且互斥 | `CONTRACT_VERIFIED` / `PROVIDER_NOT_VERIFIED` / `PROVIDER_VERIFIED` 机械区分 | 混用 |
| CHK-L02 | 无写入口 | 无 setter；记录 readonly/frozen | 可写 |
| CHK-L03 | mock 上限 | 仅 fake → `CONTRACT_VERIFIED` + `PROVIDER_NOT_VERIFIED` | 出现 `PROVIDER_VERIFIED` |
| CHK-L04 | 缺 EVC 回退 | 删除任一 EVC → `PROVIDER_NOT_VERIFIED` + `missingEvc` 列出 | 仍 `PROVIDER_VERIFIED` |
| CHK-L05 | 跨级禁止 | `CONTRACT_VERIFIED` 不推导 `PROVIDER_VERIFIED` | 推导 |
| CHK-L06 | READY 三条件 | 仅 contract+provider+config 同时满足才可 READY | 任一缺失即 READY |
| CHK-L07 | 来源真实性 | `source==='REAL_ALIBABA_DASHSCOPE_CALL'`；伪造被拒 | 接受伪造 |
| CHK-L08 | 无 READY 类声明 | 全文检索无 `READY`/`可用`/`就绪`/`基本可用` 等对外声明 | 存在 |
| CHK-L09 | 证据 artifact 完整性 | 命令/时间/环境/model/request_id/observed_response_envelope/echo/inputDigest/resultSummary/EVC 覆盖 | 缺失任一 |
| CHK-L10 | artifact 零敏感 | 无 secret / 原始 body / 输入原文 / 家庭数据 / Gold label | 存在任一 |
| CHK-L11 | 证据不跨 Slice 复用 | artifact 只引用本 Slice 调用记录 | 引用其它 Slice |
| CHK-L12 | 当前离线状态 | Slice 当前为 `PROVIDER_NOT_VERIFIED` | 声称其它 |
| CHK-L13 | MODE A governance evidence 归档 | 治理证据包含：ownership 唯一 seam 条目、guard blob 相等输出（V15）、provider egress 边界、Port-only consumer、endpoint policy、unknown-path fail-closed、依赖扫描（V16） | 任一证据缺失或被口头代替 |

## M. Tests

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-M01 | 契约测试文件存在且覆盖 Port/Dense/Sparse/Error/Retry | `tests/ai/embedding-provider-contract.test.ts` 全绿 | 缺失或跳过 |
| CHK-M02 | Adapter 协议测试存在 | `tests/ai/embedding-dashscope-adapter.test.ts` 全绿 | 缺失 |
| CHK-M03 | 架构测试存在 | `tests/architecture/embedding-provider-boundary.test.ts` 全绿 | 缺失 |
| CHK-M04 | 百分比/无跳过 | 目标文件无用例被 skip/todo（I7 文件除外） | 存在 skip |
| CHK-M05 | 测试 DB 边界 | contract/adapter/architecture 测试不连 DB；仅 AS-021 integration 测试使用只读 `pg` 快照，不写表 | 生产 seam 连 DB，或非 AS-021 测试连 DB，或快照测试写表 |
| CHK-M06 | 测试不访问网络 | 无真实 HTTP；全部注入 transport | 存在网络访问 |
| CHK-M07 | 测试不依赖真实 secret | 只用 `test-*` 占位符 | 依赖真实凭据 |
| CHK-M08 | 未改既有测试/fixture | diff 不含既有测试与既有 fixture 的修改 | 存在修改 |
| CHK-M09 | 失败注入类测试存在 | 每类错误至少一条注入用例 | 缺失 |
| CHK-M10 | Test-first 纪律 | 每个 I 任务的提交序列含「先失败的测试」 | 无法证明 |
| CHK-M11 | AS-021 前后快照 | V14 通过；调用前后表清单/行数逐项相同 | 缺失或不同 |
| CHK-M12 | egress / Port / endpoint 静态测试存在 | architecture test 内含：egress 只在 seam、consumer 只经 Port、approved endpoint policy、seam 外无 direct provider integration 四类断言且全绿 | 缺失任一断言 |
| CHK-M13 | 依赖边界测试存在 | 测试或 CI 脚本断言 `dashscope` / `@alicloud` / provider SDK 在 seam、`package.json`、lockfile 中命中 0（V16） | 缺失断言 |

## N. Negative Scope

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-N01 | 无 `knowledge_embeddings` / `knowledge_chunks` | 全仓库无创建/写入 | 存在 |
| CHK-N02 | 无 migration / `CREATE EXTENSION` | diff 无 `db/**`；guard 无命中 | 存在 |
| CHK-N03 | 无 sparsevec 能力 | seam 无 token / 无实现 | 存在 |
| CHK-N04 | 无 pg_jieba / 专业词典 | 无依赖 / 无数据文件 / 无加载路径 | 存在 |
| CHK-N05 | 无 reranker / fusion / RRF / retrieval / hard filter / top-k | 无模块、无标识、无依赖 | 存在 |
| CHK-N06 | 无 Context Builder / AI Task Runtime / TaskModelRegistry | 无模块 | 存在 |
| CHK-N07 | 无 Gold Dataset runtime | 无样本/label/runner | 存在 |
| CHK-N08 | 无 reviewer / approval / professional truth | 无相关代码与表 | 存在 |
| CHK-N09 | 无生产 route 注册 / 无 route winner | 无 `embedding_route_version` / `rag_route_version`；无 winner 声明 | 存在 |
| CHK-N10 | 无 generic registry / platform | 无 provider/model/plugin/workflow/eval/vector 通用抽象 | 存在 |
| CHK-N11 | 无 `packages/**` 级豁免 | ownership 无 `packages/**`；无通配 | 存在 |
| CHK-N12 | 无 `ai/` / `providers/` / `embeddings/` 目录级所有权 | registry 检查 | 存在 |
| CHK-N13 | NS-039：MODE A 无预置 Rule 8 放宽 | guard 与 base 字节相同；无新增 provider import fixture；无 allowance；diff 无 `scripts/**` | 任一出现 |
| CHK-N14 | NS-040：无 provider SDK 依赖 | `package.json` / lockfile 无新增 provider 依赖；依赖图无 `dashscope` / `@alicloud` import（V16） | 存在任一 |

## O. Regression

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-O01 | 静态守卫 | `node scripts/guard-static.mjs` → `PASS (0 violations)` | FAIL |
| CHK-O02 | self-test（MODE A baseline） | `node scripts/guard-static.mjs --self-test` → `PASS (39 synthetic fixtures validated)`，数量与 base 相同 | FAIL、数量变化或新增 fixture |
| CHK-O03 | typecheck（base） | `bunx tsc -p tsconfig.base.json --noEmit` → exit 0 | 非 0 |
| CHK-O04 | typecheck（api） | `cd apps/server/api && bunx tsc --noEmit` → exit 0 | 非 0 |
| CHK-O05 | governance | `validate-governance` + `run-governance-tests` + `validate-change-governance --base origin/main` 全 PASS | 任一 FAIL |
| CHK-O06 | canonical 回归 | `node scripts/verify-all.mjs` → `verify-all: PASS` | FAIL |
| CHK-O07 | working tree clean | 回归结束后 tracked tree clean | dirty |
| CHK-O08 | 无依赖变更 | `package.json` / `bun.lock` diff 为空 | 有变更 |
| CHK-O09 | guard blob equality（V15 / MODE A） | `git rev-parse <base>:scripts/guard-static.mjs` == `git rev-parse HEAD:scripts/guard-static.mjs` | 任一字节差异 |

## P. Provider Verification（真实 DashScope）

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-P01 | 显式 opt-in | 只有 `EMBEDDING_VERIFICATION_ENABLED=true` 且存在 secret 时运行 | 默认运行 |
| CHK-P02 | 不进入常规 CI | CI 内该文件 skip；CI 无真实调用 | CI 调用 provider |
| CHK-P03 | 失败 fail-closed | 任一 EVC 缺失 → 不写 `PROVIDER_VERIFIED` | 部分覆盖即宣称 |
| CHK-P04 | EVC-01..EVC-10 全覆盖 | artifact `evcCoverage` 长度 10 且无重复 | 缺项 |
| CHK-P05 | EVC-07 变形标注 | `derivation==='REAL_PROVIDER_PAYLOAD_MUTATION'` | 无标注或使用纯 mock |
| CHK-P06 | 合成样本 | `inputDigest` 来自合成中文样本；无真实家庭数据 | 使用真实数据 |
| CHK-P07 | 无 Gold / 专业内容 | artifact 无 Gold 引用 / 专业内容原文 | 存在 |
| CHK-P08 | artifact 已 sanitized | 无 secret / 原始 body / 完整 URL | 存在 |
| CHK-P09 | 缺凭据时的诚实状态 | 无凭据 → `PROVIDER_NOT_VERIFIED` 且**不产生** artifact | 伪造 artifact |
| CHK-P10 | 成本受控 | 真实调用次数 ≤ 4 且受 token 上限 | 无限制调用 |

## Q. Development Handoff

| ID | 检查项 | PASS 判据 | FAIL 判据 |
| --- | --- | --- | --- |
| CHK-Q01 | 治理前置已完成 | G1a 与 G1b 已合并，G2 独立审计已完成 | 任一未完成 |
| CHK-Q02 | 实现分支已 rebind | I0 记录 rebind 后的 main SHA，behind = 0 | 未 rebind 或 behind > 0 |
| CHK-Q03 | 实现 PR 自建 change-binding | `.specify/change-bindings/020-*.json`，`classification=FEATURE_IMPLEMENTATION`，`implementationPaths` 精确等于生产 diff | 缺失/不符 |
| CHK-Q04 | 未复用其它 binding | 无 019/其它 Slice 的 binding 复用 | 复用 |
| CHK-Q05 | tasks.md 契约完整 | 每任务有 `[REQ:...]` 与 `[VERIFY:...]`，VERIFY 指向真实存在路径 | 缺失/虚假 |
| CHK-Q06 | 无越权完成声明 | 未声称 READY / 可用 / provider verified（除非 I7 真实通过） | 存在 |
| CHK-Q07 | STOP 于 AUDIT 2 前 | 实现完成后状态为 `READY FOR AUDIT 2`，未自我批准 merge | 自称已 merge/已通过 |
| CHK-Q08 | 新鲜证据 | 所有 PASS 附命令 + 真实输出 + 时间 | 仅有叙述 |

---

## 汇总表（Developer AI / Audit 2 填）

| 分组 | 项数 | PASS | FAIL | BLOCKED | NOT VERIFIED |
| --- | --- | --- | --- | --- | --- |
| A Authority & Frozen Identity | 8 | | | | |
| B Scope | 6 | | | | |
| C Governance Prerequisite | 27 | | | | |
| D Port Contract | 18 | | | | |
| E Dense Contract | 9 | | | | |
| F Sparse Payload Contract | 14 | | | | |
| G Error Model | 14 | | | | |
| H Retry / Timeout | 9 | | | | |
| I Secret | 9 | | | | |
| J Telemetry | 8 | | | | |
| K Cost | 8 | | | | |
| L Evidence | 13 | | | | |
| M Tests | 13 | | | | |
| N Negative Scope | 14 | | | | |
| O Regression | 9 | | | | |
| P Provider Verification | 10 | | | | |
| Q Development Handoff | 8 | | | | |
| **合计** | **197** | | | | |

```text
COVERAGE DECLARATION（Revision 4）
  FR  69 / 69（含 FR-068 strict HTTP_OUTPUT_WRAPPED、FR-069 ambiguous/malformed fail closed）
  AS  39 / 39（含 AS-035 MODE A evidence、AS-036 MODE B NOT TRIGGERED、AS-037..AS-039 envelope）
  NS  42 / 42（含 NS-039 MODE A 无预置放宽、NS-040 禁止引入 SDK、NS-041 禁止 recursive parser、NS-042 禁止 ambiguous precedence）
  C20 23 / 23（含 C20-22 strict envelope normalization、C20-23 envelope fail closed）
  EVC 10 / 10（EVC-03 含 observed_response_envelope=HTTP_OUTPUT_WRAPPED）
GOVERNANCE MODE: MODE A — NATIVE HTTP
```

```text
FINAL GATE RULE
  Slice 20 只有在 A–O + Q 全部 PASS（P 允许为 NOT VERIFIED 且如实标注）时，
  才可声明 READY FOR AUDIT 2。
  任何 FAIL 存在 → 不得声明完成；任何 BLOCKED → 必须报告 BLOCKED，不得改写为 PASS。
```