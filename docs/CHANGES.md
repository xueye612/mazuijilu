# 麻醉记录单 — 修改文档

> 本文档分三部分：① 现有功能清单；② 与电子病历 6 级要求的差距；③ 本轮变更明细。

---

## 一、已完成功能清单（截至本次改动前）

### 1. 患者基本信息与术前评估
- 姓名、性别、年龄、住院号、身高、体重、科室、病区、床号、手术日期、手术间
- BMI 实时计算（`calculateBMI`）
- 术前生命体征：体温、脉搏、呼吸、血压、SpO₂
- ASA 分级（I~V 级字典）、过敏史风险标签
- 诊断、拟行手术、实施手术、禁食情况、术前特殊情况

### 2. 麻醉方法、气道管理、插管/拔管节点
- 麻醉方式（5 种字典）、麻醉团队字段、麻醉分级
- 气道方式（6 种）、插管方式（5 种）、插管次数/型号/深度/固定位置、Cormack-Lehane 分级
- 困难气道标记 + 处理措施、拔管时间/情况/拔管后 SpO₂
- 诱导/维持/苏醒/特殊事件说明文本
- 关键时间节点（入室、麻醉开始/结束、诱导、插管、穿刺、阻滞、手术开始/结束、拔管、出室、入/出 PACU）
- 时间节点填写自动生成事件并同步到事件时间线

### 3. 术中生命体征
- 表格化录入：SBP/DBP/HR/RR/SpO₂/EtCO₂/TEMP/BIS
- 异常自动识别（`detectAbnormalVitals` 8 项规则）、异常单元格高亮
- 频率控制 1/3/5/10/15 分钟，可批量生成时间点
- SVG 趋势曲线、异常闭环面板（处置措施 + 事件生成）
- 数据来源标记（手工录入 / 设备采集占位 / 手工修正）
- 抢救模式自动切换为 1 分钟/次

### 4. 术中用药、输液、输血、出入量
- 用药表：时间、药品、剂量、单位、途径、原因、执行人/核对人、高警示标记、备注
- 12 种常用药品快速添加、6 种高警示药品自动标记
- 输液、输血（含血袋号/血型/双人核对/反应）、出量（尿/血/引流/其他）
- 液体平衡 6 项指标自动计算
- 实时记录单：用药/输液线段可视化、拖动调整起止时间、右键菜单

### 5. 抢救模式与高警示事件
- 一键进入/退出抢救模式，自动调整频率并写入事件
- 抢救小结表单（结束时间、记录人、经过、用药、气道、循环、结果）
- 抢救期间生命体征 `rescue=true` 标记
- 高警示药品双人核对在质控中校验

### 6. 设备采集（前端占位）
- 监护仪/麻醉机/输注泵三项状态、采集频率、接收状态、异常说明
- 启动/暂停/恢复/手工补录按钮、采集日志
- "从设备占位带入"按上次值生成模拟生命体征

### 7. 复苏/离室/PACU 交接
- 离室时间/去向（PACU/ICU/病房/其他）、意识/呼吸/循环、疼痛评分、Aldrete 评分
- 管路/皮肤/交接护士/接收人/PACU 进出时间/生命体征摘要/交接备注/复苏结论
- PACU 观察记录表、ICU 与 Aldrete < 9 风险标签
- 带管离室校验

### 8. 质控、签名、解锁修改
- 27+ 项完整性检查（`runQualityRules`）
- 电子签名（医师/手术/护士/复核）、签名后整表只读
- 存在"未通过"项时阻止提交签名
- 解锁修改申请（原因、申请人、范围、备注），写入修改留痕
- 修改留痕表（时间/操作人/原因/字段/前/后/状态）

### 9. 归档/预览
- 结构化 JSON 查看与复制
- 纸质预览（患者头、生命体征趋势、用药、出入量、气道、事件、复苏、签名）
- `window.print()` 打印当前 Tab（live/archive 已设 `.print-area`）
- 评审能力映射（capabilityMap）

### 10. 操作日志、修改留痕、时间线
- 16 种事件类型、事件时间线可视化、关键事件高亮
- operationLogs 记录所有系统/手工操作
- modificationLogs 记录解锁与修改
- 右侧质控面板（状态/采集/关键节点/异常/质控/能力/最近操作）

---

## 二、与 6 级电子病历的差距

| 6 级要求 | 当前状态 | 计划阶段 |
|---|---|---|
| 设备值 ≥1/min 自动采集，原始值不可改 | 仅前端占位 | 后续 |
| 手术安全核查 Time-out 三方核查 | ❌ 缺失 | 后续 Phase 1 |
| 关键时间节点签名后锁定 | 仅 isReadOnly 整表锁 | 后续 |
| 输血闭环（申请-配血-取血-核对-反应-回执） | 缺申请/配血/取血/回执 | 后续 Phase 2 |
| 麻醉知情同意闭环 | ❌ 缺失 | 后续 Phase 1 |
| 用药 CDSS（过敏/相互作用/剂量校验） | 仅高警示标记 | 后续 Phase 2 |
| HL7/FHIR/CDA 互操作 | 仅 JSON | 后续 Phase 3 |
| 可信签名（CA/时间戳/摘要） | 文本框模拟 | 后续 |
| 审计防篡改（哈希链） | 仅日志数组 | 后续 |
| PDF/OFD 归档 | 占位按钮 | 部分本轮（浏览器打印） |
| 术前访视/术后随访 | 仅术前摘要 | 后续 Phase 3 |
| 共享调阅 + 水印 | 占位按钮 | 后续 |

---

## 三、本轮变更明细

> 范围：先补齐基本麻醉记录单功能；本轮重点 = **录入预警值提示** + **修改数据留痕** + **完善预览/打印**。

### 1. 录入数据预警值提示
- `anesthesiaRecordHelpers.js` 新增 `evaluateThreshold(field, value)`，返回 `{abnormal, level, message, rule}`，复用 `abnormalRules`。
- 新增 `extraRanges`：Aldrete (<9 警示)、疼痛评分 (>=7 警示)、呼吸（已含）、术前 SBP/DBP/HR 等扩展项。
- `AnesthesiaRecordSheet.vue`：
  - 新增 `alertOnChange(field, value, label)`，在生命体征数值、Aldrete、疼痛评分变更后即时弹出 toast 预警（仅当超阈值才弹）。
  - 在生命体征表格的 SBP/DBP/HR/RR/SpO2/EtCO2/TEMP/BIS 每个 `<input>` 加 `@change` 钩子。
  - 在复苏区 Aldrete、疼痛评分 `<input>` 加 `@change` 钩子。
  - 异常输入框旁继续保留红色高亮（已有），并叠加输入即时 toast。

### 2. 修改数据自动留痕
- 新增 `captureFieldValue(scope, refKey, field, value)`：focus 时缓存"修改前值"。
- 新增 `commitFieldChange(scope, refKey, field, label, newValue, options?)`：change/blur 时比较前后值，若变化则：
  - 写入 `currentRecord.modificationLogs`（自动生成 id、操作人、时间、字段、前/后、状态、原因）。
  - 同步写入 `operationLogs` 一条"字段修改"摘要。
- 适用字段（默认追踪）：
  - 患者：姓名、住院号、诊断、拟行/实施手术、ASA、过敏史
  - 麻醉：method、anesthesiologist、surgeon、关键时间（inRoomTime/anesthesiaStart/anesthesiaEnd/surgeryStart/surgeryEnd/intubationTime/extubationTime/outRoomTime）
  - 气道：airwayMethod、intubationTime、extubationTime、extubationStatus
  - 生命体征行：SBP/DBP/HR/RR/SpO2/EtCO2/TEMP/BIS
  - 用药行：name、dose、unit、route、executor、checker、highAlert
  - 复苏：destination、aldrete、painScore、handoverNurse、receiver
- 状态机：
  - 未签名 → 留痕状态 `录入修改`（仅作审计，不阻塞）
  - 已签名 / 修改中 → 留痕状态 `已记录`
- `EditableMedicationTable` 透传 `field-change` 事件，父组件调用 `commitFieldChange`。

### 3. 预览与打印完善
- `archive` Tab 顶部新增"打印当前记录单"主按钮，复用 `printPreview()`。
- 增强 `paper-preview` 内容：
  - 患者头加身高/体重/BMI/科室/床号/麻醉医师/手术医师
  - 新增"术前情况"段：ASA、过敏史、禁食、术前生命体征摘要
  - 新增"关键时间"汇总行：入室/麻醉/手术/拔管/出室
  - 用药改为表格化打印，输液/输血/出量分块
  - 签名区显示签名时间与签名状态
- `@media print` 样式：
  - `paper-preview` 强制白底无阴影
  - 表格保持栅格线、避免页内断行（`page-break-inside: avoid`）
  - 隐藏所有按钮、风险标签、能力映射卡
  - A4 横向，边距 10mm（已有，继续沿用）

### 4. 不在本轮范围（向 6 级看齐留待后续）
- Time-out 三方核查模块、知情同意闭环
- 设备真实接入与原始值不可改
- 输血/医嘱完整闭环、用药 CDSS
- CA 数字签名、HL7/FHIR 导出、术后随访

