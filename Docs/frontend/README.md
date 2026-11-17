# Frontend Design Authority

本目录是小树荫 V1 前端 UX / UI 的长期 Design Authority 入口。

它负责定义：用户如何理解、看到和操作已经批准的业务能力；不负责重新定义业务事实、服务端规则或技术 Authority。

## 1. Authority Hierarchy

`Docs/frontend/**` 必须服从以下上位 Authority：

1. `Docs/总产品需求.md`
2. `Docs/V1产品需求.md`
3. `Docs/总体技术架构.md`
4. `Docs/V1技术设计.md`

如前端设计与上位 Authority 冲突，以上位 Authority 为准。前端文档不得通过措辞、交互或视觉设计静默修改上位业务或技术决策。

## 2. Scope

`Docs/frontend/**` 可以决定：

- 用户如何理解已批准的业务能力；
- 信息如何组织与呈现；
- 页面、导航与信息架构；
- 状态如何被用户感知和区分；
- 用户如何发起、继续、确认、取消、恢复操作；
- 反馈、动效、声音、触觉与庆祝如何表达；
- 设计系统、组件语义与屏幕级体验。

前端设计的目标是把已批准的业务能力翻译成可理解、可操作、可验证的用户体验。

## 3. Non-Authority Boundary

`Docs/frontend/**` 不得重新定义或绕过：

- 业务状态机；
- Case 生命周期；
- Authorization / Consent；
- Safety / Compliance；
- 数据事实与持久化语义；
- API Contract；
- 服务端决策权；
- Scene / Domain 内部规则；
- 上位文档已冻结的产品边界。

后端字段、状态名、DTO 或内部对象不得机械映射成前端 IA、页面或组件。前端必须基于用户心智与任务设计呈现方式，同时保持业务语义一致。

## 4. Docs → Specs → Code

三者职责严格区分：

```text
Docs/frontend/
    ↓
长期 UX / UI Design Authority
    ↓
specs/
    ↓
把冻结设计翻译成具体开发 Slice、plan、tasks 与 acceptance
    ↓
apps/miniprogram/ 与 apps/operations/
    ↓
生产代码
```

`Docs/frontend/**` 不是某个 PR 的实施清单；`specs/**` 也不能反向成为长期产品体验 Authority。

客户端实现必须继续遵循 `Docs/V1技术设计.md` 已冻结的契约链路，不得自行复制或维护第二套 API interface。

## 5. Document Map

本目录按实际设计进度逐步建立，不预建空目录。预期分类包括：

- `experience/`：体验模型、Journey、反馈与游戏化原则；
- `information-architecture/`：V1 信息架构与导航模型；
- `interaction/`：状态交互、恢复、动效、触觉与声音；
- `design-system/`：视觉与组件 Design System；
- `screens/`：冻结后的关键页面与屏幕级设计 Authority。

首个正式体验正文为：

`experience/V1前端体验原则.md`

## 6. Freeze / Change Rules

- 新设计必须先验证与上位 Authority 一致；
- 已冻结的前端 Design Authority 不得被实现代码静默改写；
- 如业务 Authority 变化，应先更新对应上位文档，再评估前端设计是否需要修订；
- 如仅实现方式变化，不得借机修改已冻结的用户体验语义；
- 任何 Slice 的 spec / plan / tasks 都必须引用适用的冻结前端 Design Authority，而不是自行重新解释业务或 UX。
