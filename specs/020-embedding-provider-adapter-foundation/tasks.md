# Tasks — Slice 20 Embedding Provider Port / DashScope Adapter Foundation

> Feature: `020-embedding-provider-adapter-foundation`
>
> Frozen Spec: `spec.md` Revision 2，blob `67711ee5a67b34c927f8f26058fab8cf430c4a71`
>
> Plan: `plan.md` · Checklist: `checklist.md`
>
> 本文件把开发拆成**小而可验证**的执行任务。Developer AI **不需要**重新做产品设计；
> 若某任务要求超出本文件与 Frozen Spec 的范围，必须 STOP 并上报，不得自行扩展。

## Execution Rules

1. 任务必须按 **G0 → G1 → G2 → I0 → I1 → … → I8** 的依赖顺序执行；不得跳跃。
2. **Phase G（T001–T003）与 Phase I（T004–T012）属于不同的 PR**；治理 PR 不得包含任何生产实现。
3. 每个任务开始前重读其 `Prerequisites`；任一前置不满足 → 记 `BLOCKED`，不进入实现。
4. 每个实现任务采用 test-first：先提交会失败的测试，再实现至绿。
5. 不得修改既有测试、既有 fixture、既有快照来让实现通过（AGENTS.md §2）。
6. 遇到 Plan 中的 STOP 边界（见 `plan.md` §10）→ 立即停止并上报，不得就地变通。
7. 完成实现后任务状态只能是 `READY FOR AUDIT 2`；**不得**自称 merge 通过或 READY/可用。

## Frozen Spec Authority Map

| Task | Phase | Authority |
| --- | --- | --- |
| T001 | G0 Remote reconciliation | Frozen Spec §3 Remote Truth；`plan.md` §4 |
| T002 | G1 Governance prerequisite PR | Frozen Spec §19.2；`plan.md` §5.1–5.8 |
| T003 | G2 Independent governance audit + merge | Frozen Spec §19.2 流程约束；`plan.md` §5.6 |
| T004 | I0 Rebind implementation branch | Frozen Spec §3；`plan.md` §4.1 |
| T005 | I1 Port / types | FR-001..FR-010、FR-052；`plan.md` §6.2–6.3 |
| T006 | I2 Adapter（config / transport / protocol） | FR-002、FR-022..FR-027、FR-042；`plan.md` §6.12–6.13 |
| T007 | I3 Validation / error / retry | FR-011..FR-021、FR-028..FR-036、FR-063..FR-067；`plan.md` §6.4–6.7 |
| T008 | I4 Telemetry / cost / secrets | FR-037..FR-040、FR-042、FR-043；`plan.md` §6.8–6.10 |
| T009 | I5 Contract tests | FR-001..FR-040、FR-053..FR-055；`plan.md` §7.3–7.4 |
| T010 | I6 Architecture / static guards | FR-041、FR-044..FR-052、FR-056..FR-062；NS-001..NS-038；`plan.md` §7.5 |
| T011 | I7 Optional real-provider verification | FR-056..FR-062、EVC-01..EVC-10；`plan.md` §8 |
| T012 | I8 Canonical regression + STOP | Frozen Spec §19.3/§19.4；`plan.md` §7.1 |

## Acceptance Evidence Contract

每个任务只由**具体仓库测试、真实命令输出、治理校验结果或受保护环境的真实 provider 证据**证明完成。
叙述式「已完成」不构成证据。VERIFY 契约中的路径必须在完成时可被打开并包含对应的真实执行记录。

## Task Index（完成登记行）

> 本清单是治理校验与完成证据登记的唯一机器可读契约来源。
> `[REQ:...]` 追踪需求身份；`[VERIFY:...]` 追踪可机器验证的仓库路径。

- [ ] T001 G0 remote reconciliation / frozen identity / competing-work recheck — [REQ:FR-047,FR-051; NS-017,NS-018,NS-027,NS-029,NS-030] [VERIFY: .specify/scripts/validate-change-governance.mjs scripts/guard-static.mjs]
- [ ] T002 G1 governance prerequisite PR (ownership + Rule 8 narrow allowance + adversarial fixtures) — [REQ:FR-051; NS-027,NS-029,NS-030,NS-031,NS-032] [VERIFY: scripts/guard-static.mjs]
- [ ] T003 G2 independent governance audit + merge — [REQ:FR-051; NS-027,NS-029,NS-030] [VERIFY: .specify/scripts/tests/run-change-governance-tests.mjs]
- [ ] T004 I0 rebind implementation branch to current main — [REQ:FR-048,FR-051; NS-003,NS-017] [VERIFY: .specify/scripts/validate-change-governance.mjs]
- [ ] T005 I1 Port contract and types — [REQ:FR-001,FR-002,FR-003,FR-004,FR-005,FR-006,FR-007,FR-008,FR-009,FR-010,FR-052] [VERIFY: tests/ai/embedding-provider-contract.test.ts]
- [ ] T006 I2 DashScope protocol adapter (config / transport / mapping) — [REQ:FR-022,FR-023,FR-024,FR-025,FR-026,FR-027,FR-042,FR-044,FR-045] [VERIFY: tests/ai/embedding-dashscope-adapter.test.ts]
- [ ] T007 I3 validation / error normalization / timeout / retry / cancellation — [REQ:FR-011,FR-012,FR-013,FR-014,FR-015,FR-016,FR-017,FR-018,FR-019,FR-020,FR-021,FR-028,FR-029,FR-030,FR-031,FR-032,FR-033,FR-034,FR-035,FR-036,FR-063,FR-064,FR-065,FR-066,FR-067] [VERIFY: tests/ai/embedding-dashscope-adapter.test.ts tests/ai/embedding-provider-contract.test.ts]
- [ ] T008 I4 telemetry / cost record / secret boundaries / evidence derivation — [REQ:FR-010,FR-037,FR-038,FR-039,FR-040,FR-041,FR-042,FR-043,FR-053,FR-054,FR-055] [VERIFY: tests/ai/embedding-provider-contract.test.ts]
- [ ] T009 I5 contract test suite completion — [REQ:FR-001,FR-006,FR-009,FR-010,FR-039,FR-040,FR-053,FR-054,FR-055] [VERIFY: tests/ai/embedding-provider-contract.test.ts tests/ai/embedding-dashscope-adapter.test.ts tests/integration/embedding-provider-no-persistence.test.ts]
- [ ] T010 I6 architecture / negative-scope static guards — [REQ:FR-041,FR-044,FR-045,FR-046,FR-049,FR-050,FR-051,FR-052,FR-056,FR-057,FR-058,FR-059,FR-060,FR-061,FR-062] [VERIFY: tests/architecture/embedding-provider-boundary.test.ts scripts/guard-static.mjs]
- [ ] T011 I7 optional real-provider verification (explicit opt-in) — [REQ:FR-056,FR-057,FR-058,FR-059,FR-060,FR-061,FR-062] [VERIFY: tests/ai/embedding-provider-verification.test.ts tests/evidence/embedding-provider-verification.json]
- [ ] T012 I8 canonical regression + STOP at READY FOR AUDIT 2 — [REQ:FR-051,FR-053,FR-055,FR-059; NS-003,NS-018] [VERIFY: scripts/verify-all.mjs]

---

## T001 — G0：Remote Reconciliation

**Task ID**：`T001`

**Frozen Spec Authority**：`spec.md` §3 Remote Truth；`plan.md` §4。

**Purpose**：在动手之前，重新证明「基线正确、无漂移、无竞争实现、guard/ownership 现状已知」。
这一步失败则后续全部作废。

**Allowed paths**：无生产改动。只允许在 `specs/020-embedding-provider-adapter-foundation/plan.md` §4 更新 Remote Truth 记录（若远端已前进）。

**Forbidden paths**：`apps/**`、`packages/**`、`db/**`、`Docs/**`、`specs/016-*`..`specs/019-*`、`.specify/**`、`scripts/**`。

**Prerequisites**：Frozen Spec 已可读取（blob `67711ee5`）。

**Implementation action**：

1. `git fetch origin` 后记录 `origin/main` SHA；确认当前分支 base 与 Frozen Spec §3.1 记录的关系；
2. 若 `origin/main` 前进：普通 merge（**禁止** rebase frozen history、禁止 force-push）；
3. 核验 `git hash-object specs/020-*/spec.md` == `67711ee5a67b34c927f8f26058fab8cf430c4a71`；
4. 核验 `Docs/**` 与 `specs/016-*`..`specs/019-*` 未被本分支修改；
5. 核验 main 上无 `apps/server/api/src/ai/`、无 `packages/ai|rag|memory`；
6. 重新核验 open PR 列表，确认无第二个 Slice 20 实现；若 PR #111 状态变化，记录其是否已合并；
7. 重新核验 `scripts/guard-static.mjs` 中 Rule 8 的 `FORBIDDEN_SAFETY_IMPORTS` 与 Rule 19 的作用域；
8. 在 `plan.md` §4.1 更新为「本次执行时点」的真实值。

**Acceptance / Evidence Ownership**：Remote Truth 记录（plan.md §4）与命令输出；无产品实现归属。

### Verification

```bash
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD
git hash-object specs/020-embedding-provider-adapter-foundation/spec.md
git diff --name-only origin/main...HEAD
gh pr list --state open
node .specify/scripts/validate-change-governance.mjs --base origin/main
node scripts/guard-static.mjs
```

**Done criteria**：

- `origin/main` 与 `plan.md` §4.1 记录一致；
- behind = 0（或已普通 merge 并重记）；
- spec blob == `67711ee5…`；
- diff 中无 `Docs/`、无 `specs/016-*`..`specs/019-*`；
- 无竞争 Slice 20 实现；
- `validate-change-governance` 与 `guard-static` 在当前 HEAD 上 PASS（或在治理 PR 合并前，记录其唯一预期失败点为未注册 seam —— 若出现其它失败 → STOP）。

---

## T002 — G1：Governance Prerequisite PR

**Task ID**：`T002`

**Frozen Spec Authority**：`spec.md` §19.2（治理前置必须独立、必须在实现前）；`plan.md` §5.1–5.8。

**Purpose**：在不触碰任何生产实现的前提下，使「唯一 seam」可被 ownership 授权、可被 Rule 8 精确允许，
并用对抗性 fixture 证明「只放行该 seam 的 2 个 token，其它一律 fail closed」。

**Allowed paths**（本任务**恰好**允许，缺一不可、多一即错）：

```text
.specify/implementation-ownership.json      （追加 1 条规则，见 plan §5.2）
scripts/guard-static.mjs                    （新增 allowance + 归一化 + 11 个 fixtures，见 plan §5.3/5.4）
```

**Forbidden paths**：

```text
apps/**        packages/**        db/**        tests/**        Docs/**
specs/016-*    specs/017-*        specs/018-*  specs/019-*
specs/020-*/spec.md（不得改动；只能由 G1a 逐字节引入）
.specify/change-bindings/**  .specify/authority-*  .specify/task-evidence/**
package.json   bun.lock      .env*      docker-compose*.yml
```

**任务前的 SPLIT 要求（G1a）**：

> 若 `specs/020-embedding-provider-adapter-foundation/spec.md` 尚未存在于治理 PR 的 **base 分支（main）**，
> 必须先完成 **G1a = Spec Admission PR**：把 `spec.md`（blob 不变）+ `plan.md` + `checklist.md` + `tasks.md`
> 合并到 main。否则 `.specify/implementation-ownership.json` 引用的 feature 会因
> `validateFeatureExists()`（要求 `specs/<feature>/spec.md` 存在）而校验失败。
> G1a 属 `specs/`（FIXED_EXEMPT），不触发 change-binding。

**Prerequisites**：T001 PASS；若 PR #111 仍 open，先记录其对 decide 顺序的影响（plan §4.2）。

**Implementation action**：

1. **delta A（ownership）**：在 `.specify/implementation-ownership.json` 的 `rules[]` **末尾追加恰好一条**：

   ```json
   {
     "id": "embedding-provider-adapter-020",
     "match": { "kind": "PREFIX", "path": "apps/server/api/src/ai/embedding/" },
     "ownership": { "kind": "FEATURE", "features": ["020-embedding-provider-adapter-foundation"] }
   }
   ```

   不得修改/删除任何既有规则；不得新增其它规则；不得使用通配。

2. **delta B（Rule 8）**：在 `scripts/guard-static.mjs` 中

   - 新增 `R8_PATH_SCOPED_ALLOWANCES`（`Map`：`dashscope` → `['apps/server/api/src/ai/embedding/']`，`@alicloud` → 同）；
   - 新增 `isR8PathAllowed(relPath, allowedPrefixes)`：拒绝绝对路径、反斜杠、含 `..` 段、`posix.normalize` 后变化的路径；
   - 在 `checkSafetyScopeNegatives` 的 forbidden import 循环中，命中 scoped token 且路径被允许时 `continue`，其余照旧 `report`；
   - **不改变**函数签名（保持 `(relPath, content, report)`），使既有 self-test 分发无需改造；
   - **不删除、不修改** `FORBIDDEN_SAFETY_IMPORTS` 中任何条目；
   - **不修改** Rule 19（`checkPgvectorReadinessScope`）与其它规则。

3. **delta C（self-test fixtures）**：在 `--self-test` 的 `synthetic` 数组新增 F1–F11（见 `plan.md` §5.4 表），
   全部 `rule: 'R8-safety-scope'`；F1/F2 为 `expectViolation: false`；其余为默认 `true`。
   保留既有 fixture 不变。

4. 运行下方全部验证命令，并把真实输出记录为证据。

**Acceptance / Evidence Ownership**：治理 delta 的可审计 diff；不涉及产品实现。

### Verification

```bash
node scripts/guard-static.mjs                 # 期望: PASS (0 violations)
node scripts/guard-static.mjs --self-test     # 期望: PASS (含 F1..F11)
node .specify/scripts/validate-governance.mjs # 期望: Spec governance validation PASS
node .specify/scripts/tests/run-change-governance-tests.mjs   # 期望: 全部 PASS
node .specify/scripts/validate-change-governance.mjs --base origin/main
git diff --name-only origin/main...HEAD       # 期望精确 = 上述 2 个文件
```

**Done criteria**：

- diff **恰好**是 `.specify/implementation-ownership.json` 与 `scripts/guard-static.mjs`（若 G1a 另起 PR，则 G1a 的 diff 恰好是 4 个 specs 文件）；
- 上述 5 条命令全部 PASS；
- F1/F2 正例不报错，F3–F11 均报 `R8-safety-scope`；
- 无任何 `apps/**`、`packages/**`、`db/**`、`tests/**` 改动；
- 未修改 Rule 19、Rule 17、`FORBIDDEN_PATHS`、`PRODUCT_PREFIXES`。

---

## T003 — G2：Independent Governance Audit + Merge

**Task ID**：`T003`

**Frozen Spec Authority**：`spec.md` §19.2 流程约束（治理 PR 必须独立审计与合并）；`plan.md` §5.6。

**Purpose**：由**独立于本 Plan AI 2 与未来 Developer AI** 的 AI，对治理 delta 做对抗式审计，
确认它没有以「开启 Slice 20」为名放宽任何既有保护；随后由独立决定合并。

**Allowed paths**：无代码改动。只允许在治理 PR 上回应审计意见并修正 T002 的 delta（若审计发现缺陷）。

**Forbidden paths**：同 T002，且**禁止**在审计阶段引入任何 Adapter 实现。

**Prerequisites**：T002 PASS；治理 PR head 已固定（exact head）。

**Implementation action**：

1. 审计者独立复核：ownership 只新增 1 条、path 精确、无通配、FEATURE 单 feature；
2. 审计者独立复核：Rule 8 allowance 只有 2 个 token × 1 个前缀，且归一化防绕过；
3. 审计者独立尝试「绕过」：构造未列入 fixtures 的相邻/相似/跨树/绝对/`..` 路径，确认仍被拒绝；
4. 审计者确认 Rule 19、Rule 17、其它 Safety 规则、`FORBIDDEN_PATHS` 未被削弱；
5. 审计结论与合并决定分别记录；**合并是独立决定**，不得由 T002 的「已完成」推断。

**Acceptance / Evidence Ownership**：独立审计报告（含尝试绕过结果）；治理 PR 的合并记录。

### Verification

```bash
node .specify/scripts/tests/run-change-governance-tests.mjs
node scripts/guard-static.mjs --self-test
node .specify/scripts/validate-change-governance.mjs --base origin/main
```

**Done criteria**：

- 独立审计结论明确为 PASS（列出对抗尝试与结果）；
- 治理 PR 已由独立决定合并到 main；
- main 上 `validate-governance` + `guard-static` + `--self-test` 全 PASS；
- `.specify/implementation-ownership.json` 在 main 上已含 seam 规则；
- 未产生任何实现代码。

---

## T004 — I0：Rebind Implementation Branch to Current Main

**Task ID**：`T004`

**Frozen Spec Authority**：`spec.md` §3；`plan.md` §4.1。

**Purpose**：在治理已合并的 main 上，建立实现分支并固定 base，保证「实现 PR 的 base 已含 ownership 与 allowance」，
避免 governance 校验因 base 缺规则而失败。

**Allowed paths**：无生产改动（仅分支与 rebind 操作）。

**Forbidden paths**：`Docs/**`、`specs/016-*`..`specs/019-*`、`specs/020-*/spec.md`、`.specify/implementation-ownership.json`、`scripts/guard-static.mjs`。

**Prerequisites**：T003 PASS（治理 PR 已合并 main）。

**Implementation action**：

1. 记录 rebind 时的 main SHA（写入实现 PR 描述与证据）；
2. 从该 main 建立实现分支；
3. 确认 `specs/020-*/spec.md`（blob `67711ee5`）、`plan.md`、`checklist.md`、`tasks.md` 已在该 main 上；
4. 确认 `.specify/implementation-ownership.json` 已含 `apps/server/api/src/ai/embedding/` 规则；
5. 确认 `scripts/guard-static.mjs` 已含 Rule 8 allowance 与 F1–F11；
6. 运行基线命令，记录「实现前全绿」状态。

**Acceptance / Evidence Ownership**：rebind 记录（main SHA + 基线命令输出）。

### Verification

```bash
git rev-parse HEAD
git rev-list --left-right --count origin/main...HEAD   # behind = 0
node scripts/guard-static.mjs
node scripts/guard-static.mjs --self-test
node .specify/scripts/validate-governance.mjs
node .specify/scripts/validate-change-governance.mjs --base origin/main
```

**Done criteria**：

- behind = 0；
- 6 条命令全 PASS；
- 未做任何产品实现改动。

---

## T005 — I1：Port Contract and Types

**Task ID**：`T005`

**Frozen Spec Authority**：FR-001..FR-010、FR-052；`plan.md` §6.2–6.3。

**Purpose**：先冻结 Port 面（类型、校验、outcome union、工厂），使 consumers 与后续实现都面向稳定契约。

**Allowed paths**：

```text
apps/server/api/src/ai/embedding/port.ts
apps/server/api/src/ai/embedding/errors.ts        （仅错误码枚举与 failure 类型）
apps/server/api/src/ai/embedding/index.ts
tests/ai/embedding-provider-contract.test.ts      （新增；test-first 骨架）
```

**Forbidden paths**：seam 外任何 `apps/**`；`config.ts` 读 env（本任务不读 env）；任何出网代码；`app.ts`。

**Prerequisites**：T004 PASS。

**Implementation action**：

1. 定义 `EmbeddingRequest`、`EmbeddingOutputType`、`ProviderModelEchoStatus`、`EmbeddingProviderPort`；
2. 定义 `EmbeddingOutcome`（`OK` | `FAILED`）与 `EmbeddingResult` / `EmbeddingItemResult` / `SparseEntry` 的**结构**；
3. 定义 `EmbeddingErrorClass` 与 `EmbeddingErrorCode` 全集（`plan.md` §6.6，不增不减）；
4. 定义请求校验（`requestId`/model/version/outputType/dimension/items/`correlationTag` 的字符集与范围），失败 → `INVALID_REQUEST`（BLOCKED），且**不**调用 transport；
5. `index.ts` 只导出 Port 面 + 类型 + 错误码（`createEmbeddingProvider` 工厂在 T006 引入并实现，避免占位实现污染契约面）；
6. 先写会失败的契约测试：字段缺失 → BLOCKED 且 transport 调用 0；all-or-nothing 结构不可表达部分成功。

**Acceptance / Evidence Ownership**：Port 面类型与导出面的稳定性；`index.ts` 不含 provider 专有字段名。

### Verification

```bash
cd apps/server/api && bunx tsc --noEmit
bunx vitest run tests/ai/embedding-provider-contract.test.ts
```

**Done criteria**：

- 契约测试覆盖 FR-002/003/005/006/008/009 并通过；
- 请求类型字段集合精确、无 endpoint/secret/route 字段；
- `index.ts` 不导出 provider 专有模块；
- typecheck exit 0。

---

## T006 — I2：DashScope Protocol Adapter（config / transport / protocol）

**Task ID**：`T006`

**Frozen Spec Authority**：FR-002、FR-022..FR-027、FR-042、FR-044、FR-045；`plan.md` §6.12–6.13。

**Purpose**：实现唯一出网面与 provider 协议映射，并且把「配置缺失 / secret 缺失 / 端点非法」变成 BLOCKED（不出网）。

**Allowed paths**：

```text
apps/server/api/src/ai/embedding/config.ts
apps/server/api/src/ai/embedding/transport.ts
apps/server/api/src/ai/embedding/dashscope-protocol.ts
apps/server/api/src/ai/embedding/index.ts            （接入工厂实现）
tests/ai/embedding-dashscope-adapter.test.ts
```

**Forbidden paths**：

```text
新增 npm 依赖 / 修改 package.json / bun.lock
dashscope SDK / @alicloud 包 / axios / undici 显式依赖
app.ts / runtime-env.ts / plugins/config.ts
.env / .env.example / .env.*
任何 route 注册
```

**Prerequisites**：T005 PASS。

**Implementation action**：

1. `config.ts`：`loadEmbeddingRuntimeConfig(env)` —— **lazy（调用时）**、唯一 env 读取点、显式 required、无默认 secret；
   实现 `plan.md` §6.12 全部变量、范围与 fail-closed 行为；
   - base URL 只接受 `https://<host>`（无 path），host 后缀 ∈ `{.maas.aliyuncs.com}`；历史遗留 host 需另行治理；
   - 否则 `ENDPOINT_NOT_ALLOWED`（BLOCKED）；
   - 缺失 model/version/dimension → `CONFIG_MISSING`；类型/范围非法 → `CONFIG_INVALID`；
   - 缺失 `DASHSCOPE_API_KEY` → `SECRET_MISSING`（BLOCKED，出网 0）。
2. `transport.ts`：`HttpTransport` 接口 + `FetchHttpTransport`（`globalThis.fetch`、per-attempt timeout、接受 `AbortSignal`）；
   不得使用任何新依赖；不得记录 header。
3. `dashscope-protocol.ts`：
   - 请求体映射：`{ model, input: { texts }, parameters: { dimension, output_type, text_type, instruct? } }`；
     `output_type` 取自 `EMBEDDING_OUTPUT_TYPE_*_PARAM`（缺失 → `OUTPUT_TYPE_UNSUPPORTED`，**不猜**）；
   - 成功解析：`request_id`、`embeddings[].index`、`embeddings[].embedding`、`embeddings[].sparse_embedding`、`usage`；
   - 错误解析：`{code,message,request_id}` → 内部错误码映射；**不**保留原始 body；
   - provider `model` 存在时校验一致，不一致 → `MODEL_ECHO_MISMATCH`；缺失 → `PROVIDER_MODEL_ECHO_NOT_AVAILABLE` 且**成功**。
4. `index.ts` 工厂：`createEmbeddingProvider(config, deps?)`，`deps` 可注入 `HttpTransport` 与 telemetry sink（FR-007）；
   `index.ts` 仍不 re-export `dashscope-protocol` / `transport`。
5. 先写失败测试：缺 config → BLOCKED 且 transport 调用 0；缺 key → SECRET_MISSING 且出网 0；echo 缺失成功 / 冲突失败。

**Acceptance / Evidence Ownership**：唯一出网面（transport）与唯一 env 读取点（config）的静态可证明性。

### Verification

```bash
cd apps/server/api && bunx tsc --noEmit
bunx vitest run tests/ai/embedding-dashscope-adapter.test.ts
node scripts/guard-static.mjs
```

**Done criteria**：

- AS-011/AS-012/AS-020/AS-033 通过；
- `config.ts` 是 seam 内唯一 `process.env` 访问点；
- `transport.ts` 是 seam 内唯一 `fetch` 调用点；
- 无新依赖、无 header 记录、无 `.env*` 改动；
- guard PASS。

---

## T007 — I3：Validation / Error Normalization / Timeout / Retry / Cancellation

**Task ID**：`T007`

**Frozen Spec Authority**：FR-011..FR-021、FR-028..FR-036、FR-063..FR-067；`plan.md` §6.4–6.7。

**Purpose**：把「provider 返回什么」变成「确定的 OK 或确定的失败」，并保证重试/超时/取消**有界、确定、可测**。

**Allowed paths**：

```text
apps/server/api/src/ai/embedding/contracts.ts
apps/server/api/src/ai/embedding/errors.ts          （补充分类函数）
apps/server/api/src/ai/embedding/dashscope-protocol.ts（接入校验）
apps/server/api/src/ai/embedding/port.ts            （实现 embed 主流程编排）
tests/ai/embedding-dashscope-adapter.test.ts
tests/ai/embedding-provider-contract.test.ts
```

**Forbidden paths**：同 T006 的 forbidden 集合；额外禁止 `sparsevec` / `knowledge_embeddings` / `pg_jieba` / `pg_textsearch` / `hnsw` / `ivfflat` 任意字面量，禁止 `EmbeddingAdapter` / `RerankerAdapter` 标识符。

**Prerequisites**：T006 PASS。

**Implementation action**：

1. `contracts.ts` 实现 dense 校验（类型/有限/维度/卡片性/index 完整性）、sparse 校验（结构/index 非负整数/唯一/value 有限/上限/canonical sort/observed 记录）、dense-only 不产 sparse；
   - **绝不**比较 `sparseIndex` 与 `denseDimension`；
   - `SPARSE_VOCABULARY_MAX` 仅在配置存在时作为上界；
2. `errors.ts` 实现 provider 错误分类与稳定码映射（`plan.md` §6.6 表，逐行对应）；
3. `port.ts` 实现编排：deadline、attempt 循环、确定性退避、`Retry-After` 处理、caller abort、耗尽语义；
4. 失败一律 `kind='FAILED'`，**不**返回向量或上次结果；
5. 先写失败测试：每类错误至少一条注入用例；维度-1；NaN/Infinity；重复 index；`index=111290`（dim=1024）成功；N+1 元素；无序 → 升序；429 × 3；401 × 1；超时；abort。

**Acceptance / Evidence Ownership**：Dense/Sparse/Error/Retry 的完整机械验收（AS-002..AS-017、AS-029..AS-032、AS-034 中与校验相关的部分）。

### Verification

```bash
cd apps/server/api && bunx tsc --noEmit
bunx vitest run tests/ai/embedding-dashscope-adapter.test.ts tests/ai/embedding-provider-contract.test.ts
node scripts/guard-static.mjs
```

**Done criteria**：

- AS-002..AS-017、AS-029..AS-032 全 PASS；
- 无 dense-dimension 约束 sparse index 的代码；
- 无无限重试；TERMINAL 调用计数 = 1；
- 失败对象不含 secret / 原始 body / 堆栈；
- guard PASS。

---

## T008 — I4：Telemetry / Cost Record / Secret Boundaries / Evidence Derivation

**Task ID**：`T008`

**Frozen Spec Authority**：FR-010、FR-037..FR-043、FR-053..FR-055；`plan.md` §6.8–6.11。

**Purpose**：把每次调用的可观测、成本与证据做成**白名单、不可伪造、零泄漏**，并证明 secret 只存在于调用栈局部。

**Allowed paths**：

```text
apps/server/api/src/ai/embedding/telemetry.ts
apps/server/api/src/ai/embedding/cost.ts
apps/server/api/src/ai/embedding/evidence.ts
apps/server/api/src/ai/embedding/port.ts              （接入记录与证据）
apps/server/api/src/ai/embedding/config.ts            （仅 secret 边界相关修正）
apps/server/api/src/ai/embedding/index.ts             （导出 evidence 推导函数与类型）
tests/ai/embedding-provider-contract.test.ts
```

**Forbidden paths**：`app.ts`；任何持久化（DB/文件/账本）；OTel/Phoenix 依赖；`.env*`；`package.json`。

**Prerequisites**：T007 PASS。

**Implementation action**：

1. `telemetry.ts`：`EmbeddingTelemetryRecord` 白名单字段 + 构造器（显式字段赋值，禁止展开 request/provider JSON）+ `sanitizeTelemetry` + `EmbeddingTelemetrySink` + `NOOP_TELEMETRY_SINK`；
   `endpointConfigFingerprint` = sha256(baseUrl) 前 12 hex；
2. `cost.ts`：`EmbeddingUsage`（`REQUEST_AGGREGATE`）、`CostRecord`、`EmbeddingCostGuard`（进程内累计，`COST_LIMIT_REACHED`）；
   per-item 恒为 `NOT_PROVIDED`/`UNKNOWN`；未配置价格 → `totalCost='UNKNOWN'`；
3. `port.ts` 接入：成功与失败都产出 telemetry（失败含 errorClass/Code）；sink 抛错被吞且结果状态不变；
4. secret 边界：确认 secret 只在出网瞬间拼接、不进入任何 record；
5. `evidence.ts`：实现 `CapabilityEvidenceState` / `ExternalAvailabilityStatus` / `CapabilityEvidenceRecord` / `ProviderVerificationRecord` 与
   纯函数 `deriveCapabilityEvidence({contractChecksAllPassed, configComplete, providerVerification})`；
   记录 `readonly`（或 `Object.freeze`），**不提供任何 setter**；缺 EVC → `PROVIDER_NOT_VERIFIED` + `missingEvc`；
   `READY` 仅当 contract + provider + config 三条件同时满足；由 `index.ts` 导出该函数与类型；
6. 先写失败测试：telemetry key 集合精确断言；输入敏感串不出现；cost per-item 断言；sink 抛错不改结果；`COST_LIMIT_REACHED` 后出网 0；
   仅 fake → `CONTRACT_VERIFIED` + `PROVIDER_NOT_VERIFIED`；逐项删除 EVC → 回退。

**Acceptance / Evidence Ownership**：Telemetry/Cost/Secret/Evidence 的机械验收（AS-018/AS-019/AS-024/AS-025/AS-027/AS-034）。

### Verification

```bash
cd apps/server/api && bunx tsc --noEmit
bunx vitest run tests/ai/embedding-provider-contract.test.ts
git diff --name-only | grep -E '^\.env' ; test $? -ne 0
```

**Done criteria**：

- AS-018/AS-019/AS-024/AS-025/AS-027/AS-034 通过；
- telemetry key 集合与 Plan 6.9 精确一致；
- `evidence.ts` 无 setter、记录 readonly；`deriveCapabilityEvidence` 三态推导可被 T009 重复验证；
- 无持久化；无新依赖；
- `.env*` 无 diff。

---

## T009 — I5：Contract Test Suite Completion

**Task ID**：`T009`

**Frozen Spec Authority**：FR-001..FR-040、FR-053..FR-055；AS-021；`plan.md` §7.3–7.5。

**Purpose**：补齐契约层验收 + AS-021 持久化否定快照，使 `CONTRACT_VERIFIED` 与 AS-021 均可被完整机械证明（不依赖真实 provider）。

**Allowed paths**：

```text
tests/ai/embedding-provider-contract.test.ts
tests/ai/embedding-dashscope-adapter.test.ts
tests/integration/embedding-provider-no-persistence.test.ts
tests/fixtures/embedding/**            （新增；仅 Sanitized synthetic fixture）
```

**Forbidden paths**：既有测试与既有 fixture 的修改；真实 secret；网络访问；生产模块或 contract/adapter/architecture 测试连接 DB（仅 AS-021 专用 integration 测试允许只读 DB 快照）；Gold / 家庭数据。

**Prerequisites**：T008 PASS。

**Implementation action**：

1. 覆盖 AS-001..AS-025、AS-028..AS-034 的全部离线条目；
2. 加入证据推导测试：仅 fake → `CONTRACT_VERIFIED` + `PROVIDER_NOT_VERIFIED`；逐项删除覆盖 → 回退；
3. 加入「无 READY 类声明」断言（对状态输出做禁用词表匹配）；
4. 加入并发隔离测试（两个不同 modelId 并发，telemetry/cost 不串扰）；
5. 加入「相同输入两次调用 → 两次出网」缓存否定测试；
6. 全部 fixture 必须 sanitized（合成文本，无真实家庭数据、无专业内容原文、无 Gold label）；
7. AS-021：新增 `tests/integration/embedding-provider-no-persistence.test.ts`，用只读 `pg` 快照记录调用前后 DB 表清单/行数，断言逐项相同；不得写任何表；DB 不可达时报告 `NOT VERIFIED`，不得用静态证明替代。

**Acceptance / Evidence Ownership**：离线契约证据集合；`CONTRACT_VERIFIED` 的唯一来源。

### Verification

```bash
bunx vitest run tests/ai/embedding-provider-contract.test.ts tests/ai/embedding-dashscope-adapter.test.ts
bunx vitest run tests/integration/embedding-provider-no-persistence.test.ts
cd apps/server/api && bunx tsc --noEmit
```

**Done criteria**：

- 目标文件全绿、无 skip/todo；
- 覆盖矩阵（plan §7.3/§7.4）中所有离线条目均有用例；
- contract/adapter 测试无网络/无 DB/无真实 secret；AS-021 integration 测试仅只读 DB 快照；
- 未修改既有测试与 fixture。

---

## T010 — I6：Architecture / Negative-Scope Static Guards

**Task ID**：`T010`

**Frozen Spec Authority**：FR-041、FR-044..FR-052、FR-056..FR-062；NS-001..NS-038；`plan.md` §7.5。

**Purpose**：用静态结构测试机械证明「没有越过任何负边界」，使 NS 不依赖人审。

**Allowed paths**：

```text
tests/architecture/embedding-provider-boundary.test.ts
```

**Forbidden paths**：`scripts/guard-static.mjs`（实现 PR 不得修改）；`.specify/**`；任何生产文件（除非修复 T005–T008 已引入的越界）。

**Prerequisites**：T009 PASS。

**Implementation action**：`tests/architecture/embedding-provider-boundary.test.ts` 静态断言（读文件文本）：

1. seam 存在且只含约定的 10 个 `.ts` 文件（多出即 FAIL，防止偷偷扩张）；
2. 无 token：`sparsevec`、`knowledge_embeddings`、`pg_jieba`、`pg_textsearch`、`hnsw`、`ivfflat`（含注释与字符串）；
3. 无标识符：`EmbeddingAdapter`、`RerankerAdapter`；
4. 无文件名匹配 `(?:embedding|reranker)[-_]?adapter\.(ts|tsx|js|mjs|cjs)`；
5. 无 import：`pg`、`drizzle-orm`、`db/`、`@xiaoshuyin/(ai|rag|memory)`、`tests/`、`fixtures`；
6. 无 route 注册（`app.get|post|put|patch|delete`）、无 `authorize`、无 `session` role 变更、无 `professional_knowledge`；
7. `config.ts` 是 seam 内唯一 `process.env` 访问点；`transport.ts` 是唯一 `fetch` 调用点；
8. `index.ts` 不 re-export `dashscope-protocol` / `transport`；导出名不含 provider 专有字段；
9. `apps/server/api/src/app.ts` 不 import `ai/embedding`；
10. registry 中恰好 1 条 seam PREFIX 且 path 精确、无宽泛路径（读取 `.specify/implementation-ownership.json`）；
11. guard 全仓 `FORBIDDEN_PATHS` 目录不存在；`packages/ai|rag|memory` 不存在。

**Acceptance / Evidence Ownership**：NS-001..NS-038 的机械门禁集合；FR-041/044..052/056..062 的结构证据。

### Verification

```bash
bunx vitest run tests/architecture/embedding-provider-boundary.test.ts
node scripts/guard-static.mjs
node scripts/guard-static.mjs --self-test
git diff --name-only origin/main...HEAD
```

**Done criteria**：

- 架构测试全绿；
- guard 与 self-test PASS；
- diff 只含 seam 10 文件 + 5 个测试文件 + change-binding（+可选 evidence json）；
- 无 `db/**`、无 `Docs/**`、无 `specs/016-019`、无 `app.ts`、无 `package.json`、无 `.env*`。

---

## T011 — I7：Optional Real-Provider Verification（Explicit Opt-In）

**Task ID**：`T011`

**Frozen Spec Authority**：FR-056..FR-062、EVC-01..EVC-10；`plan.md` §8。

**Purpose**：在**受控、手动、显式 opt-in** 条件下获取真实 Alibaba DashScope 证据，使 `PROVIDER_VERIFIED` 成为可能；
若不可执行，**必须**保持 `PROVIDER_NOT_VERIFIED`。

**Allowed paths**：

```text
tests/ai/embedding-provider-verification.test.ts
tests/evidence/embedding-provider-verification.json      （仅在成功 opt-in 执行后）
```

**Forbidden paths**：CI workflow 文件；任何 `apps/**` 生产文件；真实家庭数据；Production Professional Content；Gold label；生产库；把 secret 写入任何 artifact。

**Prerequisites**：T010 PASS；运行环境提供 `DASHSCOPE_API_KEY` 与出网许可；已按官方文档确认 provider `output_type` 字面量并写入运行时 env。

**Implementation action**：

1. 测试文件默认 `describe.skip`；仅当 `EMBEDDING_VERIFICATION_ENABLED==='true'` 且 `DASHSCOPE_API_KEY` 存在时 `describe`；
2. 覆盖 EVC-01..EVC-10，每项一个 `it`，每项写 `evcDetails` 记录（sanitized）；
3. EVC-07 使用**真实 payload 受控变形**：`derivation='REAL_PROVIDER_PAYLOAD_MUTATION'`；
4. 至少 2 次真实调用（正常 dense+sparse、超时注入）；最多 4 次（含错误注入）；
5. 生成 sanitized artifact（`plan.md` §8.3 schema）；任一 EVC 缺失 → `evidenceState='PROVIDER_NOT_VERIFIED'` + `missingEvc`；
6. 在无凭据环境：**不建立**该测试之外的任何替代、不写 artifact、在报告里明确 `PROVIDER_NOT_VERIFIED`。

**Acceptance / Evidence Ownership**：真实 provider 证据（唯一 `PROVIDER_VERIFIED` 来源）；否则为「未验证」的诚实记录。

### Verification

```bash
# 无凭据（默认）：确认 skip 且无 artifact
bunx vitest run tests/ai/embedding-provider-verification.test.ts
ls tests/evidence/embedding-provider-verification.json 2>/dev/null ; test $? -ne 0

# 显式 opt-in（仅受控环境）
EMBEDDING_VERIFICATION_ENABLED=true bunx vitest run tests/ai/embedding-provider-verification.test.ts
```

**Done criteria**：

- 无凭据时：测试 skip、无 artifact、状态保持 `PROVIDER_NOT_VERIFIED`；
- 有凭据且执行时：10 项 EVC 全 PASS，artifact 通过 schema 与 sanitize 断言；
- artifact 无 secret / 原始 body / 输入原文 / 家庭数据 / Gold label；
- 未修改 CI workflow。

---

## T012 — I8：Canonical Regression + STOP at READY FOR AUDIT 2

**Task ID**：`T012`

**Frozen Spec Authority**：`spec.md` §19.3/§19.4；`plan.md` §7.1、§10。

**Purpose**：在最终 head 上跑完整回归，确认「新鲜证据」齐全，并且**停在** AUDIT 2 之前。

**Allowed paths**：无生产改动；只允许在证据目录写入回归日志（`tests/evidence/`）。

**Forbidden paths**：修改测试以让回归通过；修改 `spec.md`；任何 merge 操作；任何 READY/可用声明（当证据不足）。

**Prerequisites**：T009、T010 PASS；T011 已执行或已记录 `PROVIDER_NOT_VERIFIED`。

**Implementation action**：

1. 运行下方全部命令，保存真实输出；
2. 逐项对照 `checklist.md` A–Q 勾选；
3. 复核 `git hash-object specs/020-*/spec.md` 未变；
4. 确认实现 PR 已自建 `change-binding`（`plan.md` Appendix A）；
5. 输出最终状态声明：

   ```text
   CONTRACT_VERIFIED: YES
   PROVIDER_VERIFIED: YES | NO（未执行/未全覆蓋）
   EXTERNAL AVAILABILITY: PROVIDER_NOT_VERIFIED | READY（仅当三条件全满足）
   SLICE 20 STATUS: READY FOR AUDIT 2
   DEVELOPMENT AUTHORIZATION: 不得自行 merge
   ```

**Acceptance / Evidence Ownership**：最终 head 的完整回归证据与 Checklist 勾选表。

### Verification

```bash
node scripts/guard-static.mjs
node scripts/guard-static.mjs --self-test
bunx tsc -p tsconfig.base.json --noEmit
cd apps/server/api && bunx tsc --noEmit
bunx vitest run tests/ai/embedding-provider-contract.test.ts tests/ai/embedding-dashscope-adapter.test.ts tests/integration/embedding-provider-no-persistence.test.ts tests/architecture/embedding-provider-boundary.test.ts
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-change-governance-tests.mjs
node .specify/scripts/validate-change-governance.mjs --base origin/main
node scripts/verify-all.mjs
git hash-object specs/020-embedding-provider-adapter-foundation/spec.md
git diff --name-only origin/main...HEAD
git status --short
```

**Done criteria**：

- 全部命令 PASS（或如实记录 `BLOCKED` / `NOT VERIFIED`）；
- spec blob == `67711ee5…`；
- diff 与 Allowed paths 精确一致；
- Checklist A–O + Q 全 PASS，P 为 PASS 或 NOT VERIFIED（如实）；
- 状态为 `READY FOR AUDIT 2`，未自称 merge / READY；
- **STOP**：不得进入 AUDIT 2 的自审，也不得把审计外包给实现 AI 自己。

---

## Dependency Graph

```text
T001 G0
  └─> [G1a Spec Admission PR] ──┐
                                ├─> T002 G1 ──> T003 G2 ──> T004 I0
                                │                              │
                                │                              ├─> T005 I1
                                │                              │     └─> T006 I2
                                │                              │           └─> T007 I3
                                │                              │                 └─> T008 I4
                                │                              │                       └─> T009 I5
                                │                              │                             └─> T010 I6
                                │                              │                                   ├─> T011 I7（可选）
                                │                              │                                   └─> T012 I8
                                └──────────────────────────────┘
```

**并行性**：T011 与 T012 的前置只依赖 T010；T011 未执行不阻塞 T012（但 T012 必须如实记录 `PROVIDER_NOT_VERIFIED`）。
其余任务严格串行。

---

## STOP Conditions

以下任一情形，Developer AI **必须停止**并上报，不得变通：

1. 需要修改 `Docs/**`、`spec.md`、`specs/016-*`..`specs/019-*`；
2. 需要新增依赖或修改 `package.json` / `bun.lock`；
3. 需要修改 `db/**`、写 migration、执行 `CREATE EXTENSION`；
4. 需要修改 `scripts/guard-static.mjs` 或 `.specify/implementation-ownership.json`（属治理 PR，不属于实现 PR）；
5. 需要放宽 Rule 8 的全局条目，或新增 token / 前缀；
6. 需要新增 HTTP route，或把 seam 接入 `app.ts` 启动路径；
7. 需要修改 `.env*`；
8. provider contract 与 Frozen Spec §2.3 出现实质冲突（应回 Plan AI 1 出新 Revision）；
9. 任何验证命令失败且原因指向 Plan/Checklist 缺陷（应修 Plan，不得改测试）；
10. 需要声称 `READY` / 可用 / provider verified 而缺少对应证据。