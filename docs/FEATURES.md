# 麻醉记录单（Anesthesia Record Sheet）功能详档

> 版本：v0.1 · 编辑时间：2026-05-18
> 仓库根目录：`e:\code\麻醉记录单\`
> 本文档对项目当前已实现的功能进行**逐模块、逐函数、逐字段**的详细记录，便于开发、评审、培训与回归测试。

---

## 目录

1. [项目总览](#1-项目总览)
2. [技术栈与构建](#2-技术栈与构建)
3. [应用入口与组件装载](#3-应用入口与组件装载)
4. [数据模型与字典（anesthesiaRecordData.js）](#4-数据模型与字典anesthesiarecorddatajs)
5. [核心工具函数（anesthesiaRecordHelpers.js）](#5-核心工具函数anesthesiarecordhelpersjs)
6. [单元测试覆盖](#6-单元测试覆盖)
7. [纸质记录单（AnesthesiaRecordSheet.vue）](#7-纸质记录单anesthesiarecordsheetvue)
8. [现场实时记录单（AnesthesiaLiveSheet.vue）](#8-现场实时记录单anesthesialivesheetvue)
9. [全局样式系统（anesthesia-record-sheet.css）](#9-全局样式系统anesthesia-record-sheetcss)
10. [质量控制规则清单](#10-质量控制规则清单)
11. [六级评审能力映射](#11-六级评审能力映射)
12. [已知约束与扩展位](#12-已知约束与扩展位)

---

## 1. 项目总览

**项目名称**：`anesthesia-record-sheet-prototype`（package.json L2）

**定位**：面向医院手术室麻醉过程的**全电子化记录单原型系统**，目标是覆盖"术前 → 术中 → 复苏 → 归档"全生命周期；以教学、评审能力验证、产品原型展示为主要场景。

**核心能力**：

| 能力 | 实现位置 |
| --- | --- |
| 患者工作台（多手术间、多状态过滤、卡片切换） | [AnesthesiaRecordSheet.vue](src/views/anesthesia/AnesthesiaRecordSheet.vue) |
| 纸质标准版麻醉记录单（9 个 Tab） | [AnesthesiaRecordSheet.vue](src/views/anesthesia/AnesthesiaRecordSheet.vue) |
| 现场实时记录单（仿纸张时间轴 + 多 band 并列） | [AnesthesiaLiveSheet.vue](src/views/anesthesia/AnesthesiaLiveSheet.vue) |
| 生命体征录入、异常识别与闭环 | [anesthesiaRecordHelpers.js#L144](src/views/anesthesia/anesthesiaRecordHelpers.js#L144) |
| 用药 / 输液 / 输血时间段的拖拽编辑 | [anesthesiaRecordHelpers.js#L422](src/views/anesthesia/anesthesiaRecordHelpers.js#L422) |
| 输血双人核对（麻醉医师 + 巡回护士） | [AnesthesiaLiveSheet.vue](src/views/anesthesia/AnesthesiaLiveSheet.vue) |
| 完整性检查（16+ 条规则） | [anesthesiaRecordHelpers.js#L201](src/views/anesthesia/anesthesiaRecordHelpers.js#L201) |
| 电子签名 / 只读锁定 / 解锁修改申请 | [AnesthesiaRecordSheet.vue](src/views/anesthesia/AnesthesiaRecordSheet.vue) |
| 六级评审能力映射看板 | [anesthesiaRecordData.js](src/views/anesthesia/anesthesiaRecordData.js) |
| 设备采集状态占位（监护仪 / 麻醉机 / 输注泵） | [AnesthesiaRecordSheet.vue](src/views/anesthesia/AnesthesiaRecordSheet.vue) |

**特别说明**：所有数据均为**前端内存态**（无后端服务），用于原型与演示；持久化以 `localStorage` 模拟，签名/审计仅作流程演示。

---

## 2. 技术栈与构建

### 2.1 依赖

定义于 [package.json](package.json#L11-L18)：

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| `vue` | `^3.5.24` | UI 框架（Composition API + `<script setup>`） |
| `vite` | `^7.2.2` | 开发服务器 / 构建工具 |
| `@vitejs/plugin-vue` | `^6.0.1` | 单文件组件编译 |

无运行时 UI 库（如 Element Plus、Ant Design），所有控件均用原生 HTML + 内嵌 SVG 自行实现。

### 2.2 NPM 脚本

[package.json](package.json#L6-L10)：

| 命令 | 等价 | 说明 |
| --- | --- | --- |
| `npm run dev` | `vite --host 0.0.0.0` | 开发模式，监听全部网卡（便于内网演示） |
| `npm run build` | `vite build` | 生产构建到 `dist/` |
| `npm run preview` | `vite preview --host 0.0.0.0` | 预览生产构建 |
| `npm run test` | `node --test "src/**/*.test.mjs"` | 使用 Node 原生 test runner 运行 `.test.mjs` 测试 |

### 2.3 Vite 配置

[vite.config.js](vite.config.js)：仅启用 `@vitejs/plugin-vue` 插件并绑定 dev server 到 `0.0.0.0:5173`，未做特殊路径别名与代理。

---

## 3. 应用入口与组件装载

### 3.1 装载链

```
index.html                              ← 仅含 <div id="app"> 与 <script type="module" src="/src/main.js">
   └─ src/main.js                       ← createApp(App).mount('#app')，并 import 全局样式
       └─ src/App.vue                   ← 模板仅 <AnesthesiaRecordSheet />
           └─ src/views/anesthesia/
               AnesthesiaRecordSheet.vue ← 主工作台（patient + tabs + qc panel）
                ├─ <AnesthesiaLiveSheet /> 子组件（Tab "live" 时挂载）
                ├─ 全局样式：src/styles/anesthesia-record-sheet.css
                └─ 数据来源：anesthesiaRecordData.js / anesthesiaRecordHelpers.js
```

### 3.2 全局样式注入

由 [main.js](src/main.js) 一次性 `import` 样式表，所有组件共享同一 CSS 命名空间；项目**不使用** Scoped CSS，规则按 BEM 风格组织。

---

## 4. 数据模型与字典（anesthesiaRecordData.js）

文件路径：[src/views/anesthesia/anesthesiaRecordData.js](src/views/anesthesia/anesthesiaRecordData.js)

### 4.1 顶层导出

| 导出名 | 类型 | 用途 |
| --- | --- | --- |
| `currentOperator` | `string` | 当前模拟操作人（"麻醉医师 刘医生"） |
| `dictionaries` | `Object` | 全局业务枚举字典 |
| `capabilityMap` | `Array` | 六级评审 16 项能力映射 |
| `initialPatients` | `Array<Patient>` | 8 个预置患者档案（含完整 record） |

### 4.2 字典 `dictionaries`

| 字段 | 取值 |
| --- | --- |
| `recordStatuses` | 草稿 / 记录中 / 待签名 / 已签名 / 待归档 / 已归档 / 抢救中 / 修改中 |
| `collectStatuses` | 未连接 / 待启动 / 采集中 / 采集暂停 / 采集异常 / 已结束 |
| `asaLevels` | I 级 / II 级 / III 级 / IV 级 / V 级 |
| `anesthesiaMethods` | 全身麻醉 / 椎管内麻醉 / 静脉麻醉 / 神经阻滞麻醉 / 复合麻醉 |
| `airwayMethods` | 面罩通气 / 喉罩 / 气管插管 / 双腔管 / 气管切开 / 其他 |
| `intubationMethods` | 直接喉镜 / 视频喉镜 / 纤支镜 / 快速诱导 / 清醒插管 |
| `extubationStatuses` | 顺利 / 呛咳 / 喉痉挛 / 低氧 / 延迟拔管 / 带管入 PACU/ICU |
| `destinations` | PACU / ICU / 病房 / 其他 |
| `eventTypes` | 入室 / 启动记录 / 设备采集 / 麻醉开始 / 诱导 / 插管 / 穿刺 / 手术开始 / 用药 / 输液 / 输血 / 异常生命体征 / 抢救 / 抢救结束 / 手术结束 / 拔管 / 出室 / 签名 / 修改 / 其他 |
| `medicationNames` | 丙泊酚、舒芬太尼、瑞芬太尼、罗库溴铵、依托咪酯、咪达唑仑、去甲肾上腺素、阿托品、地塞米松、麻黄碱、多巴胺、肾上腺素 |
| `frequencyOptions` | `[1, 3, 5, 10, 15]`（生命体征记录频率，单位分钟） |
| `fieldActions` | 填入当前时间 / 复制字段 / 清空字段 / 使用常用值 / 定位质控问题 |

### 4.3 Record 完整数据结构

由工厂函数 `baseRecord()`（与 `fullGeneralRecord` / `rescueRecord` / `signedRecord` 等场景化变体）产生。一个 `record` 对象包含以下 **20+** 顶级字段：

#### 元数据
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `status` | enum | 当前记录状态（草稿/记录中/待签名/…） |
| `startedAt` | `HH:MM` | 启动记录时刻 |
| `dataSource` | string | 数据来源（如"手工录入 + 设备采集占位"） |
| `vitalFrequency` | number | 当前生命体征记录频率（分钟） |
| `previousFrequency` | number | 抢救前频率（用于退出抢救时恢复） |
| `qualityResults` | Array | 最近一次质控检查的结果集 |
| `modificationLogs` | Array | 解锁后的修改留痕 |
| `operationLogs` | Array | 操作日志（打开/启动/抢救/签名等） |

#### `anesthesia`：麻醉主信息（[L60+](src/views/anesthesia/anesthesiaRecordData.js#L60)）
含 11 个时间节点 + 4 个人员字段 + 麻醉分级 + 4 段过程文本：
- 时间节点：`inRoomTime` / `recordStart` / `anesthesiaStart` / `inductionStart` / `intubationTime` / `punctureTime` / `blockFinishTime` / `surgeryStart` / `surgeryEnd` / `extubationTime` / `anesthesiaEnd` / `outRoomTime` / `pacuInTime` / `pacuOutTime`
- 人员：`anesthesiologist` / `surgeon` / `circulatingNurse` / `scrubNurse`
- 分级与方式：`method` / `anesthesiaLevel`
- 过程笔记：`inductionNote` / `maintenanceNote` / `recoveryNote` / `specialEventNote`

#### `airway`：气道管理
`airwayMethod`、`intubationTime/Method/Attempts`、`tubeModel/Depth`、`fixationPosition`、`cormack`（Cormack-Lehane 分级）、`difficultAirway`（boolean）、`difficultMeasure`、`extubationTime/Status`、`postExtubationSpo2`、`airwayNote`。

#### `vitals`：生命体征数组
每条记录：
```
{ id, time, sbp, dbp, hr, rr, spo2, etco2, temp, bis,
  source, remark, rescue, abnormalHandled: { <field>: <处置文本> } }
```

#### `medications`：用药数组
```
{ id, time, endTime, name, dose, unit, route, reason,
  executor, checker, highAlert, remark }
```
持续用药通过 `endTime` + `time` 形成时间段；高警示药品（`highAlert`）需要 `checker`。

#### `infusions`：输液数组
```
{ id, time, endTime, name, spec, volume, executor }
```
`endTime` 可为空表示尚未结束。

#### `transfusions`：输血数组
```
{ id, time, endTime, product, bagNo, bloodType, volume, unit,
  anesthesiaConfirm, circulatingConfirm, doubleCheck, reaction }
```
- 双人核对：`anesthesiaConfirm`（麻醉医师）和 `circulatingConfirm`（巡回护士）同时为真时 `doubleCheck` 派生为 true。
- `unit` 由 `bloodProductOptions` 字典推导（治疗量 / 袋 / U），不允许任意输入。

#### `outputs`：出入量数组
```
{ id, time, urine, bloodLoss, drainage, other, remark }
```
四项均为 ml；统计由 `calculateFluidBalance()` 计算。

#### `events`：麻醉事件时间线
```
{ id, time, type, content, measure, recorder, source, remark }
```

#### `recovery`：复苏与离室
- 离室：`leaveTime`、`destination`、`consciousness`、`respiration`、`circulation`、`painScore`、`aldrete`、`tubes`、`skin`、`handoverNurse`、`receiver`、`handoverNote`。
- PACU：`pacuInTime`、`pacuOutTime`、`pacuObservations[]`（含 `time/consciousness/respiration/circulation/painScore/measure`）、`pacuVitalSummary`、`conclusion`。

#### `signatures`：电子签名
```
{ anesthesiologist, surgeon, nurse, reviewer, signedAt, status }
```
`status === '已签名'` → 全表只读。

#### `rescue`：抢救模式
```
{ active, startTime, endTime,
  summary: { course, result, medication, airway, circulation, endTime } }
```

#### `device`：设备采集状态
```
{ monitor, anesthesiaMachine, infusionPump,
  dataSource, collectStatus, lastCollectTime,
  collectFrequency, receiveStatus, abnormalNote,
  logs: [ { time, content } ] }
```

### 4.4 预置患者档案

`initialPatients`（[L337+](src/views/anesthesia/anesthesiaRecordData.js#L337)）共 **8 位**，覆盖典型场景：

| ID | 姓名 | 年龄/性别 | 科室 / 术式 | 状态 | 演示要点 |
| --- | --- | --- | --- | --- | --- |
| p-001 | 张明远 | 58 / 男 | 普外·腹腔镜胆囊切除 | 记录中 | 全身麻醉、设备采集中、完整数据 |
| p-002 | 李秋华 | 66 / 女 | 骨科·人工股骨头置换 | 待签名 | ASA III、青霉素过敏 |
| p-003 | 王子涵 | 7 / 男 | 小儿外科·疝囊高位结扎 | 草稿 | 儿童剂量演示 |
| p-004 | 赵桂兰 | 72 / 女 | 妇科·宫腔镜检查 | 已签名 | 只读演示 + PACU 观察 |
| p-005 | 陈建国 | 63 / 男 | 胸外·胸腔镜肺叶切除 | 抢救中 | 双腔管、抢救模式、异常闭环 |
| p-006 | 孙晓梅 | 45 / 女 | 乳腺外·肿物切除 | 记录中 | 一般演示 |
| p-007 | 周启航 | 39 / 男 | 泌尿·输尿管碎石 | 待归档 | 椎管内麻醉 |
| p-008 | 刘欣然 | 31 / 女 | 产科·剖宫产 | 待签名 | 备血、急诊 |

每个患者对象除完整 `record` 外，还含：`room`（手术间）、`gender/age/height/weight`、`inpatientNo/ward/bedNo`、`department/diagnosis/plannedSurgery/actualSurgery/surgeryDate`、`asa/allergy/fasting/preSpecial`、`preVitals`（术前生命体征）、`riskTags`（如"备血""高龄"）。

### 4.5 工具字典 `infusionCatalog` / `medicationCatalog` / `bloodProductOptions`

这些字典分散在 `anesthesiaRecordHelpers.js` 与 `AnesthesiaLiveSheet.vue` 内部声明，详见 [§5](#5-核心工具函数anesthesiarecordhelpersjs) 与 [§8](#8-现场实时记录单anesthesialivesheetvue)。

---

## 5. 核心工具函数（anesthesiaRecordHelpers.js）

文件：[src/views/anesthesia/anesthesiaRecordHelpers.js](src/views/anesthesia/anesthesiaRecordHelpers.js)。所有函数均为**纯函数**，无副作用，便于测试。

### 5.1 常量与字典

| 常量 | 值 | 用途 |
| --- | --- | --- |
| `LIVE_TIME_STEP_MINUTES` | `1` | 实时记录单时间步长（分钟） |
| `LIVE_DEFAULT_SEGMENT_MINUTES` | `10` | 持续用药/输液在缺省 `endTime` 时的兜底时长 |
| `medicationUnitOptions` | `['mg','ug','ml','ug/kg·min','mg/h','%','ug/h','克']` | 用药单位下拉项 |
| `bloodProductOptions` | 见下表 | 血品 → 单位 / 默认量 字典 |
| `abnormalRules` | 8 项生命体征阈值 | 异常识别 |
| `highAlertMedicationNames` | 高警示药品名单 | 高警示判定 |
| `timeChecks` | 关键时间顺序规则 | `validateTimeline` 使用 |

**血品字典** [L42](src/views/anesthesia/anesthesiaRecordHelpers.js#L42)：
| product | unit | defaultVolume |
| --- | --- | --- |
| 血小板 | 治疗量 | 1 |
| 白细胞 | 袋 | 1 |
| 悬浮红细胞 | U | 2 |
| 红细胞 | U | 2 |
| 冷沉淀 | U | 10 |

**异常阈值**（精简）：SBP 90-160、DBP 50-100、HR 50-120、RR 8-25、SpO2 ≥ 95、EtCO2 30-45、TEMP 35.5-38.5、BIS 40-60。

### 5.2 函数清单

| 函数 | 签名 | 用途 |
| --- | --- | --- |
| `evaluateThreshold(field, value)` | 单值阈值判断 | 返回 `{abnormal, level, rule, message}` |
| `calculateBMI(height, weight)` | 输入 cm / kg | 返回保留 1 位小数的字符串 |
| `normalizeMedicationEditorPayload(form)` | 用药编辑器表单 | 自动补 `endTime`、判定 `highAlert` |
| `getBloodProductOption(product)` | 查血品字典 | 返回 `{product, unit, defaultVolume}` |
| `normalizeTransfusionEditorPayload(form)` | 输血编辑器表单 | 派生 `anesthesiaConfirm && circulatingConfirm → doubleCheck`，自动套用字典单位 |
| `validateTimeline(anesthesia)` | 麻醉时间集合 | 检查 6 组先后顺序，返回违规列表 |
| `detectAbnormalVitals(vitals)` | 体征数组 | 返回所有异常项，并标记 `handled`（已闭环） |
| `calculateFluidBalance(record)` | 完整 record | 返回 `infusionTotal/transfusionTotal/inputTotal/outputTotal/fluidBalance/bloodLossTotal` |
| `runQualityRules({patient, record})` | 患者 + 记录 | 16+ 条规则评估，返回 `[{status, item, message, target}]` |
| `sortByTime(rows)` | 数组 | 按 `time` 字符串字典序排序 |
| `clockToMinutes(time)` | `HH:MM` | → 分钟数或 `null` |
| `minutesToClock(min)` | 分钟数 | → `HH:MM`，模 1440 |
| `calculateLiveSheetEnd(start, times, minimumMinutes=210, roundMinutes=30)` | 起点 + 数据时间集合 | 自动延展时间轴终点 |
| `buildLiveTimeScale(start, end, minorInterval=5, majorInterval=30)` | 时间范围 | 生成主/副刻度数组与百分比 |
| `timeToPercent(time, start, end)` | 时间点 | 0-100 钳制百分比（用于元素定位） |
| `percentToTime(percent, start, end, snapMinutes=5)` | 拖拽位置 | 反算时间并按 `snapMinutes` 对齐 |
| `dragTimeSegment(segment, options)` | 拖拽段 | 支持 `mode='move'\|'start'\|'end'`，返回新 `{start, end}` |
| `formatMinutes(start, end)` | 两端时间 | `"N 分钟"` 文案 |

### 5.3 关键算法详解

#### 5.3.1 `calculateLiveSheetEnd`
将所有出现在记录中的时间（用药、输液、输血、体征、出量、事件等）映射成分钟数，取最大值；与 `start + minimumMinutes`（默认 3.5 小时）取大值；再按 `roundMinutes`（默认 30 分钟）向上对齐。

效果：时间轴最少 3.5 小时，并自动延展容纳全部数据；如 14:25 → 14:30。

#### 5.3.2 `dragTimeSegment`
针对**线段编辑**实现的核心逻辑：

- `mode='move'`：保持时长不变，平移整段；越出 `[start, end]` 时夹紧。
- `mode='start'`：只调整起点，确保 `end - start >= minDuration`（默认 1 分钟）。
- `mode='end'`：只调整终点，确保 `end - start >= minDuration`。
- 所有结果按 `snapMinutes` 对齐到网格。

#### 5.3.3 `runQualityRules`
顺序执行约 **16 条** 检查规则（详见 [§10](#10-质量控制规则清单)），每条产出 `{status: '通过'|'警告'|'未通过', item, message, target}`。

`target` 字段指明问题归属（如 `'patient'` / `'vitals.v-001-1.sbp'`），供前端"定位质控问题"快捷跳转使用。

---

## 6. 单元测试覆盖

文件：[anesthesiaRecordHelpers.test.mjs](src/views/anesthesia/anesthesiaRecordHelpers.test.mjs)

通过 `node --test` 运行，共 **13 个用例**，全部通过：

| # | 测试名 | 验证点 |
| --- | --- | --- |
| 1 | 根据身高体重自动计算 BMI | `calculateBMI(170, 65)` 等于 `'22.5'`；空值返回 `''` |
| 2 | 识别异常生命体征并给出处置建议 | `detectAbnormalVitals` 在全异常输入下返回 8 条 |
| 3 | 自动计算总入量、总出量和液体平衡 | `calculateFluidBalance` 6 项输出 |
| 4 | 校验关键时间顺序异常 | `validateTimeline` 在故意倒置时间下返回 5 条 |
| 5 | 签名前完整性检查会阻止关键缺项和未闭环异常 | `runQualityRules` 关键未通过项被检出 |
| 6 | builds major and minor ticks for a paper-like realtime sheet | `buildLiveTimeScale` 主/副刻度数量与标签 |
| 7 | maps record times to clamped horizontal percentages | `timeToPercent` 边界夹紧 |
| 8 | converts drag percentages back to snapped times | `percentToTime` snap |
| 9 | drags a realtime line segment and preserves edits as start/end times | `dragTimeSegment` move/end 模式 |
| 10 | uses one-minute precision for realtime medication and monitor shortcuts | `LIVE_TIME_STEP_MINUTES === 1` |
| 11 | normalizes continuous medication editor data into a drawable segment | `normalizeMedicationEditorPayload` 持续用药补端点 |
| 12 | maps blood products to their clinical units | 血品字典与 `normalizeTransfusionEditorPayload`（含双人确认字段） |
| 13 | extends the live sheet beyond the default 3.5 hours when records exceed the range | `calculateLiveSheetEnd` 自动延展并 30 分钟对齐 |

---

## 7. 纸质记录单（AnesthesiaRecordSheet.vue）

文件：[src/views/anesthesia/AnesthesiaRecordSheet.vue](src/views/anesthesia/AnesthesiaRecordSheet.vue)（>1400 行，工作台 + 9 个 Tab）

### 7.1 整体布局

```
.anesthesia-shell
├─ <header class="topbar">           固定顶栏（z-index: 40，高 64px）
│   ├─ .brand                        Logo + 标题
│   ├─ .top-context                  当前患者/状态/手术间标签
│   └─ .top-actions                  顶部按钮组（启动/采集/抢救/保存/检查/签名等）
├─ <div class="workspace">
│   ├─ <aside class="patient-panel"> 左侧患者面板（宽 260px）
│   │   ├─ 患者数 / 过滤 tab
│   │   └─ 按手术间分组的 .patient-card 列表
│   ├─ <main class="record-main">    中央编辑区
│   │   ├─ .record-tabs              9 个 Tab 切换
│   │   ├─ .mode-strip               当前模式说明
│   │   └─ .tab-panel                各 Tab 内容
│   └─ <aside class="qc-panel">      右侧质控粘性面板
└─ <footer class="bottom-status">     底部状态条
```

### 7.2 顶部操作按钮（topbar）

| 按钮 | 处理函数 | 行为 |
| --- | --- | --- |
| 启动记录 | `startRecord()` | 写入 `record.startedAt`，状态变更为"记录中" |
| 启动设备采集 | `startDeviceCollect()` | 把 `device.collectStatus` 置为"采集中"，记录采集日志 |
| 抢救模式 / 结束抢救 | `enterRescueMode()` / `openRescueExit()` | `rescue.active` 翻转；进入时强制 `vitalFrequency=1` 并保留 `previousFrequency` |
| 保存草稿 | `saveDraft()` | 写入本地存储（模拟） |
| 完整性检查 | `runQualityCheck()` | 调 `runQualityRules`，把结果写到 `qualityResults` |
| 生成预览 | `goPreview()` | 切到 `archive` Tab |
| 打印预览 | `printPreview()` | `window.print()` |
| 提交签名 | `submitSignature()` | 校验无"未通过"项 → 写 `signatures` 各字段 + `signedAt` + `status='已签名'` |
| 解锁修改申请 | `openUnlock()` | 弹申请窗口，提交后写入 `modificationLogs` |

只读规则：`isReadOnly = computed(() => currentRecord.signatures.status === '已签名')`；所有表单控件以 `:disabled="isReadOnly"` 锁定。

### 7.3 左侧患者面板

- **过滤** `activeFilter`：全部 / 草稿 / 记录中 / 待签名 / 已签名 / 抢救中 / 待归档 / 已归档。
- **分组**：按 `room`（手术间）分组渲染 `.room-group`。
- **卡片** `.patient-card`：显示姓名、性别/年龄、术式、状态徽标、抢救/已签名等小标签；点击 `selectPatient(id)` 切换 `selectedPatientId`。
- **抢救高亮**：`record.rescue.active === true` 时卡片背景标红。

### 7.4 中央 Tab 概览

| Tab key | 标题 | 主要功能 |
| --- | --- | --- |
| `live` | 现场记录单 | 渲染 `<AnesthesiaLiveSheet>`（详见 [§8](#8-现场实时记录单anesthesialivesheetvue)） |
| `patient` | 患者信息 | 一次性录入患者基本信息、术前生命体征、自动 BMI |
| `anesthesia` | 麻醉信息 | 麻醉方式 / 人员 / 11 个关键时间节点 / 4 段过程文本 / 设备状态 |
| `vitals` | 生命体征 | 频率切换、批量生成时间点、12 列录入表、SVG 趋势图、异常闭环 |
| `medication` | 用药输液输血 | 6 项液体平衡统计、用药表、输液表、输血表（双人核对）、出量表 |
| `airway` | 气道与事件 | 气道管理表单 + 麻醉事件时间线 + 事件明细表 |
| `recovery` | 复苏离室 | 离室表单 + PACU 观察表 + Aldrete < 9 警告 |
| `quality` | 完整性检查 | 16 项规则结果表 + 摘要卡 + 电子签名 + 修改留痕表 |
| `archive` | 预览归档 | `.paper-preview` 整页打印样式 + PDF/OFD/归档/JSON 按钮 + 评审能力网格 |

### 7.5 主要 Tab 细节

#### Tab "patient"
- **概览卡** `.patient-overview`：姓名、性别、年龄、风险标签（ASA / 过敏 / 高龄）、自动计算 `patientBMI`。
- **字段**：姓名 / 性别 / 年龄 / 住院号 / 身高 / 体重 / **BMI (readonly)** / 科室 / 病区 / 床号 / 手术日期 / 手术间 / ASA / 诊断 / 拟行手术 / 实施手术 / 术前禁食 / 术前特殊情况。
- **术前生命体征**：T / P / R / BP / SpO2，5 个一次性输入。

#### Tab "anesthesia"
- **麻醉基本信息**：麻醉方式（下拉）、麻醉医师 / 手术医师 / 巡回护士 / 器械护士、麻醉分级。
- **关键时间节点**：11 个时间输入框 + "现在"快捷按钮；违规组合（如手术结束 < 手术开始）高亮 + 警告文案。
- **已填时间线视图**：medical-timeline 展示已填项。
- **过程记录**：诱导 / 维持 / 苏醒 / 特殊事件（4 个 textarea）。
- **设备状态**：DeviceStatusCard，显示监护仪 / 麻醉机 / 输注泵连接状态与最近 N 条采集日志。

#### Tab "vitals"
- **快捷操作**：频率切换（1/3/5/10/15 分钟）、批量生成时间点（起始/结束/间隔）、清空空白、新增当前时间、复制上条、从设备采集、标记异常。
- **录入表**：12 列（时间 / SBP / DBP / HR / RR / SpO2 / EtCO2 / TEMP / BIS / 来源 / 备注 / 操作），单元格违阈值时加 `.abnormal` 类高亮。
- **趋势图**：内嵌 SVG，5 条线（SBP / DBP / HR / SpO2 / EtCO2）。
- **异常闭环面板**：列出全部异常项，逐条填入"处理措施"→ 写入 `abnormalHandled[field]` → 自动追加事件。

#### Tab "medication"
- **统计卡**：6 张 `.stat-card`（输液 / 输血 / 总入 / 总出 / 液体平衡 / 出血量）。
- **用药表**：可编辑、可复制、可删除；快捷加药 12 个按钮（一键加常用药）；高警示药品行加红色徽标，必须有 `checker`。
- **输液 / 输血 / 出量**：紧凑可编辑表；输血表含"双人核对"列。

#### Tab "airway"
- 左：气道管理（气道方式、插管时间/方式/次数/型号/深度/固定位置/Cormack、困难气道 + 处理措施、拔管时间/状态/SpO2、备注）。
- 右：麻醉事件时间线（按时间排序、关键事件标红）。
- 下：事件明细表 7 列（时间/类型/内容/处理/记录人/来源/备注）。

#### Tab "recovery"
- 离室时间 / 去向（下拉，ICU 时红色提示）、意识 / 呼吸 / 循环、疼痛评分（>6 警告）、Aldrete 评分（<9 警告）、管路 / 皮肤、交接人员、PACU 入出时间、长文本备注与结论。
- PACU 观察记录表：时间 / 意识 / 呼吸 / 循环 / 疼痛 / 处理 / 操作。

#### Tab "quality"
- **完整性检查**：摘要卡（通过 / 警告 / 未通过 / 完整度 %）+ 结果表 + "定位"按钮（跳转到对应 Tab/字段）。
- **电子签名**：4 个签名输入（麻醉医师 / 手术医师 / 巡回护士 / 复核人）、签名时间（只读）、签名状态、提交按钮；存在"未通过"项时阻止提交。
- **修改留痕表**：修改时间 / 修改人 / 原因 / 字段 / 修改前 / 修改后 / 状态；含"解锁修改申请"入口。

#### Tab "archive"
- `.paper-preview`：仿纸质 A4 完整页（页头 / 患者栅栏 / 关键时间 / SVG 曲线 / 用药输液输血出量 / 气道事件 / 复苏 / 签名）。
- 操作按钮：打印当前、导出 PDF（占位）、导出 OFD（占位）、归档病案（占位）、共享调阅、查看 JSON。
- **评审能力网格**：渲染 `capabilityMap`，每张卡片含能力名称、状态、位置（功能映射看板）。

### 7.6 右侧质控面板（.qc-panel）

按从上到下顺序展示：

1. **抢救模式提示**（仅 `rescue.active` 时显示）。
2. **记录状态**：状态 / 采集状态 / 频率 / 数据来源。
3. **设备采集**：监护仪 / 麻醉机 / 输注泵状态灯。
4. **关键时间节点 checklist**：13 项时间，已填→打勾。
5. **异常生命体征摘要**：最近 5 条 + 已闭环徽标。
6. **完整性检查摘要**：通过 / 警告 / 未通过 / 完整度 + "立即检查"。
7. **能力映射摘要**：前 8 条能力。
8. **最近操作留痕**：最后 6 条操作日志。

### 7.7 主要计算属性

| 计算属性 | 实现 |
| --- | --- |
| `currentPatient` / `currentRecord` | `patients.find(id === selectedPatientId)` |
| `isReadOnly` | `signatures.status === '已签名'` |
| `patientBMI` | `calculateBMI(height, weight)` |
| `isHighAsa` | ASA 等级含 III/IV/V |
| `hasAllergy` | `allergy` 存在且非"无" |
| `abnormalVitals` / `unhandledAbnormalCount` | `detectAbnormalVitals(vitals)` |
| `timelineIssues` | `validateTimeline(anesthesia)` |
| `fluidBalance` | `calculateFluidBalance(record)` |
| `qualitySummary` | 统计 `qualityResults` 各状态计数 |
| `recordCompleteness` | `Math.round(pass / total * 100)` |

---

## 8. 现场实时记录单（AnesthesiaLiveSheet.vue）

文件：[src/views/anesthesia/AnesthesiaLiveSheet.vue](src/views/anesthesia/AnesthesiaLiveSheet.vue)（>1500 行，项目最复杂组件）

### 8.1 设计理念

把整张纸面建模为**统一时间轴 + 多条 band 并列**：
- 横轴 = 时间，由 `sheetStart` 到 `sheetEnd`（动态延展）。
- 每个数据维度（用药、输液、输血、监测、体征曲线、出入量/状态）映射为一条 band，band 内部按时间百分比定位元素。
- 所有元素均支持：
  - 鼠标点击/右键 → 唤起上下文菜单（编辑/继续/删除等）；
  - 拖拽 → 改时间或改数值；
  - 弹框编辑器 → 详细字段录入。

### 8.2 顶部工具栏（live-sheet-toolbar）

| 按钮 | 作用 |
| --- | --- |
| 新增当前时间生命体征 | `$emit('add-vital')` → 由父组件追加一行 |
| 从设备占位带入 | `$emit('import-device')` → 模拟设备采集 |
| 新增用药 | `$emit('add-medication')` → 打开父组件的用药编辑器 |
| 质控检查 | `$emit('quality-check')` → 触发 `runQualityRules` |

### 8.3 表头（live-sheet-header）

显示当前患者：姓名、性别 / 年龄、住院号、手术间、手术名、状态徽标、生命体征频率。

### 8.4 时间轴骨架

- 网格 CSS 变量：
  - `--minor-columns = totalMinutes / 5`（5 分钟一格）
  - `--major-columns = totalMinutes / 30`（30 分钟一格）
- `buildLiveTimeScale(start, end, 5, 30)` 生成主/副刻度数据。
- `sheetEnd` 由 `calculateLiveSheetEnd()` 动态计算：综合所有记录时间，最少 3.5 小时，按 30 分钟向上对齐。
- 顶部 + 底部各一条 `.sheet-time-ruler`，让长时间轴的滚动浏览更清晰。

### 8.5 数据带（band）一览

按从上到下排列：

#### 8.5.1 用药带 `.band-medication`
- 左侧 `.band-side` "麻醉用药"；行标签显示**前 7 条**用药名称。
- 单次用药 → `.drug-marker`（圆点 + 剂量文本），位置 = `timeToPercent(time)`。
- 持续用药 → `.drug-line`（带 `.draggable-segment`），含 `.segment-handle.start` 与 `.segment-handle.end`，可拖动改时间。
- 右键：编辑数据 / 继续用药 / 删除。

#### 8.5.2 输液带 `.band-infusion`
- 数据源：`infusionRows` computed。
- 线段：第一条绿色 `.green`，其余蓝色；`endTime` 可为空（线段延伸到当前时间）。
- 右键：编辑 / 继续 / 删除 / 输液列表。

#### 8.5.3 输血带 `.band-transfusion`
- 数据源：`transfusionRows`（**显示所有输血记录**，已修复"只显示前 3 条"问题）。
- 行高动态：`transfusionBandStyle = { minHeight: max(66, rows.length * 22 + 12)px }`，第 4 条及以后正常显示。
- 段标签：`${product} ${volume}${unit}`，单位**优先取血品字典**，自动纠正历史 `'ml'` 脏数据。
- 双人核对：`anesthesiaConfirm` + `circulatingConfirm`。
- 右键：编辑 / 继续 / 删除。

#### 8.5.4 监测带 `.band-monitor`
- 显示 `selectedMonitorItems` 各项的离散值（如 ECG="窦性"、SpO2="98%"）。
- SpO2 < 95 时单元格 `.abnormal` 红色高亮。
- 行数随选择动态：`monitorBandStyle.minHeight = items.length * 22 + 6`。
- 右键：添加监测 / 批量添加 / 体征列表 / 监测项目设置。

#### 8.5.5 生命体征曲线 `.live-vital-chart`
- 图例：▽ 收缩压、△ 舒张压、● 脉搏、◇ SpO₂、★ 体温。
- 纵轴 40-200 标尺；SVG `viewBox="0 0 1000 300"`。
- 5 条折线 `<polyline>` + 各自符号点；每个点 `.chart-hot` 支持 `pointerdown` 拖拽改值（Y 坐标 ↔ 指标值通过 `VITAL_FIELD_SPECS[field].toY/fromY` 互转）。
- 拖拽时显示 `dragHint`（时间 + 值）。

#### 8.5.6 手术状态带 `.band-status`
- 行：尿量 / 出血量 / 引流量 / 其他 / 手术关键操作。
- 关键事件符号 `.status-marker`：`>` 入室、`X` 麻醉开始、`⊙` 手术开始、`0` 手术结束、`▶` 出室。
- 出量数值 `.output-marker` 在各时间点显示。

#### 8.5.7 文字注记区 `.live-notes`
分节展示文本摘要（不可交互）：
- 麻醉诱导用药（前 4 条）
- 辅助及特殊用药（含高警示）
- 混合用药 / 维持
- 手术关键操作（抢救、异常）
- 术后镇痛方案

#### 8.5.8 关键时间按钮 `.live-time-buttons`
6 个时间按钮（入室 / 麻醉开始 / 手术开始 / 手术结束 / 麻醉结束 / 出室），已填项 `.filled` 标记 ✓；下方 "麻醉时长 N 分钟 / 手术时长 N 分钟" 摘要。

### 8.6 右键菜单 `openLiveMenu`

通过 `liveMenu.type` 与 `target` 决定菜单内容。常见上下文：

| `type` | 适用区域 | 主要菜单项 |
| --- | --- | --- |
| `medicationGrid` | 用药带空白处 | 静脉麻醉药 / 局麻用药 / 最近用药（每项含"单次/持续"两个二级项）/ 用药列表 |
| `medication` (+target) | 用药段右键 | 编辑数据 / 继续用药 / 删除 |
| `infusionGrid` | 输液带空白处 | 新增输液（infusionCatalog 列表）/ 自定义输液 / 输液列表 |
| `infusion` (+target) | 输液段右键 | 编辑 / 继续 / 删除 |
| `transfusionGrid` | 输血带空白处 | 新增输血（bloodProductOptions）/ 输血列表 |
| `transfusion` (+target) | 输血点右键 | 编辑 / 继续 / 删除 |
| `monitor` / `chart` | 监测带 / 曲线 | 添加监测 / 批量添加 / 监测项目设置 / 体征列表 |
| `balance` | 状态带 | 添加出入量 / 出入量列表 |

**快捷加药按钮** [L327](src/views/anesthesia/AnesthesiaLiveSheet.vue#L327)：菜单中血品按钮文本为 `{{ item.product }}（{{ item.unit }}）`。

### 8.7 线段编辑器 `lineForm`

由 `showLineEditor` 控制的统一弹框，`lineForm.kind` 决定字段：

#### 公共字段
- `time`、`endTime`：通过 `.time-stepper`（- / time-input / + 按钮 + ↑↓ 键）调整，步长 `LIVE_TIME_STEP_MINUTES = 1`。

#### `kind === '用药'`
- 药品名称（自由文本）
- 单选：单次用药 / 持续用药
  - 单次：`endTime` 禁用 + 清空
  - 持续：`endTime` 必填，缺省自动 `time + 10` 分钟
- 剂量 / 单位（下拉 `medicationUnitOptions`） / 途径
- 自动判定 `highAlert`（名字在 `highAlertMedicationNames` 中）

#### `kind === '输液'`
- 液体下拉（`infusionCatalog` + `__custom__`）
  - 选 `__custom__` → 出现"自定义名称"输入框
  - 选预置项 → 自动套用 `spec` / `volume`
- 开始 + 结束时间（结束可空，附"清空"按钮）
- 容量
- 执行人

#### `kind === '输血'`
- 血品下拉（`bloodProductOptions`）
- 开始 + 结束时间（**必填**）
- 数量
- 血品单位：`<input :value="lineForm.volumeUnit" readonly title="单位随血品自动设置" />`
- 血型 / 血袋号
- **双人核对**（拆为两个 checkbox）：
  - 麻醉医师
  - 巡回护士
  - 校验：保存时若任一未勾 → 错误 `"输血需麻醉医师与巡回护士双人核对"`
- 反应情况

#### 保存校验 `saveLineEditor`
1. `time` 必须有效。
2. `endTime` 若有 → 必须有效且 ≥ `time`。
3. `kind === '输血'` 或 持续用药 → `endTime` 必填。
4. `kind === '输血'` → 必须双人核对。
5. 通过后调用 `normalizeMedicationEditorPayload` 或 `normalizeTransfusionEditorPayload`，写入 `record.medications/infusions/transfusions`，并触发"保存成功"徽标。

### 8.8 监测数据编辑器 `monitorDialog`

由 `showMonitorDialog` 控制：
- `batch=false`（单条）/ `batch=true`（批量）。
- 字段：执行日期、执行时间（+步进器）、结束时间（仅批量）、间隔分钟（仅批量）。
- **自动获取监护数据**按钮：从 `monitorDefaults` 填充默认数值。
- 监测项区：根据 `selectedMonitorItems` 动态渲染，每项类型由元数据决定：
  - 有 `options` → 下拉（如 ECG / 机械通气模式）
  - 否则 → 数值/文本输入 + 单位提示
- 保存：单条编辑写回原 vital；新增或批量按时间步进生成多条记录。

### 8.9 出入量编辑器 `outputDialog`

- 字段：时间（步进器）、尿量、出血量、引流量、其他、备注。
- 保存写入 `record.outputs`，并刷新 `fluidBalance` 与状态带标记。

### 8.10 监测项目穿梭框 `observeSetting`

左右两列：未选 / 已选项目，点击移动；保存到 `selectedMonitorItems`；影响监测带行数、曲线点显示、批量录入字段。

### 8.11 数据列表面板 `dataModal`

`activeDataList` 取值 `vitals | medications | infusions | transfusions | outputs`，对应 5 个固定列宽表格（`.med-data-table` 11 列布局），均支持直接编辑与删除：

| 列表 | 列 |
| --- | --- |
| `vitals` | 时间 + 各监测项 + 来源 + 操作 |
| `medications` | 类型徽标 / 时间 / 结束 / 药名 / 剂量 / 单位 / 途径 / 执行人 / 核对人 / 备注 / 操作 |
| `infusions` | 时间 / 结束 / 液体 / 规格 / 量 / 执行人 / 操作 |
| `transfusions` | 时间 / 结束 / 血品 / 血袋号 / 血型 / 数量 / 单位 / **麻醉核对** / **巡回核对** / 反应 / 操作 |
| `outputs` | 时间 / 尿 / 出血 / 引流 / 其他 / 备注 / 操作 |

输血表中 `anesthesiaConfirm` 和 `circulatingConfirm` 任一变更时同步 `row.doubleCheck = a && b`。

### 8.12 弹框层级（z-index）

| 容器 | z-index | 用途 |
| --- | --- | --- |
| `.live-modal-backdrop` | 125 | 普通弹框（数据列表、监测、出入量等） |
| `.live-modal-backdrop.top-layer` | 140 | 线段编辑器 lineForm，确保位于数据列表之上 |

### 8.13 状态与 reactivity 关键

- `liveMenu`：`{ visible, x, y, type, target }`。
- `lineForm` / `monitorForm` / `outputForm` / `monitorValues`：reactive。
- `dragState` / `pointDragState`：拖拽过程状态。
- `selectedMonitorItems`：ref。
- `showLineEditor / showMonitorDialog / showOutputDialog / showObserveSetting / showDataModal`：弹框开关。

### 8.14 与父组件的通信

通过 4 个 `emit` 与父组件协作：`add-vital`、`import-device`、`add-medication`、`quality-check`。其他所有写操作直接对 `props.record`（深响应）就地修改。

---

## 9. 全局样式系统（anesthesia-record-sheet.css）

文件：[src/styles/anesthesia-record-sheet.css](src/styles/anesthesia-record-sheet.css)（>2700 行）

关键容器与职责（按主题分组）：

### 9.1 布局骨架
| 选择器 | 作用 |
| --- | --- |
| `.anesthesia-shell` | 全局壳容器，预留 64px topbar |
| `.topbar` | 顶部固定栏 |
| `.workspace` | 三栏布局（patient-panel / record-main / qc-panel） |
| `.patient-panel` | 左侧患者列表 |
| `.record-main` | 中央内容区 |
| `.qc-panel` | 右侧质控面板 |
| `.record-tabs` | Tab 按钮组 |
| `.tab-panel` | Tab 内容容器 |
| `.section-card` | 通用卡片容器 |
| `.bottom-status` | 底部状态条 |

### 9.2 表格与表单
| 选择器 | 作用 |
| --- | --- |
| `.editable-table` | 通用可编辑表 |
| `.med-data-table` | 现场记录单的数据列表表（11 列固定布局，含 ellipsis 防溢出） |
| `.abnormal` | 异常字段红色高亮 |
| `.time-stepper` | -/输入/+ 时间步进器 |

### 9.3 现场记录单
| 选择器 | 作用 |
| --- | --- |
| `.live-sheet-panel` | 现场记录单 Tab 容器 |
| `.live-paper-card` | 仿纸张白底卡片 |
| `.live-sheet-board` | 时间轴网格主体 |
| `.sheet-time-ruler` | 时间刻度（顶/底） |
| `.live-band` + `.band-medication / band-infusion / band-transfusion / band-monitor / band-status` | 各业务数据带 |
| `.band-side` / `.band-labels` / `.band-grid` | band 三段式结构 |
| `.drug-marker` / `.blood-marker` / `.status-marker` / `.output-marker` | 点/符号标记 |
| `.fluid-line` / `.drug-line` / `.draggable-segment` / `.segment-handle` | 拖拽线段 |
| `.live-vital-chart` / `.live-chart-svg` / `.chart-hot` | SVG 曲线与可拖拽点 |
| `.live-notes` / `.live-time-buttons` | 文字注记与关键时间按钮 |

### 9.4 弹框
| 选择器 | 作用 |
| --- | --- |
| `.live-modal-backdrop` | 弹框遮罩（z-index 125） |
| `.live-modal-backdrop.top-layer` | 线段编辑器遮罩（z-index 140） |
| `.live-modal` / `.live-modal.small` / `.live-modal.data-modal` | 三种宽度规格 |
| `.line-confirm-row .confirm-group` | 输血双人核对横排两个 checkbox |

### 9.5 打印
- `@media print` 块：隐藏 topbar / panel，只留 `.print-area` 与 `.paper-preview`。

---

## 10. 质量控制规则清单

由 [runQualityRules](src/views/anesthesia/anesthesiaRecordHelpers.js#L201) 实现，约 **16 条**：

| # | 检查项 | 通过条件 |
| --- | --- | --- |
| 1 | 已选择患者 | `patient` 非空 |
| 2 | 患者基本信息完整 | 姓名 / 住院号 / 诊断 / 手术 / 身高体重等齐 |
| 3 | 已启动记录 | `record.startedAt` 有值 |
| 4 | 麻醉方式 | `anesthesia.method` 已选 |
| 5 | 麻醉开始 / 结束 | 两者都有值且顺序正确 |
| 6 | 手术开始 / 结束 | 两者都有值且顺序正确 |
| 7 | 关键时间顺序 | `validateTimeline` 无违规 |
| 8 | 气道插管信息 | 若 `airwayMethod==='气管插管'` → 时间/方式/型号/深度齐 |
| 9 | 带管离室交接 | 拔管情况"带管入 PACU/ICU"时必须填写交接备注 |
| 10 | 生命体征至少 1 条 | `vitals.length >= 1` |
| 11 | 抢救期生命体征 | 抢救模式期内至少 1 条 `rescue=true` 体征 |
| 12 | 抢救小结 | 抢救模式下 `rescue.summary.course/result` 必填 |
| 13 | 用药至少 1 条 | `medications.length >= 1` |
| 14 | 高警示药品双人核对 | `highAlert=true` 的用药必须有 `checker` |
| 15 | 输血双人核对 | `anesthesiaConfirm && circulatingConfirm` |
| 16 | 离室信息 | `recovery.leaveTime` + `destination` |
| 17 | 采集异常说明 | 设备状态异常时必须有 `abnormalNote` |
| 18 | 医师 / 护士签名 | `signatures.anesthesiologist / nurse` 必填 |
| 19 | 异常生命体征闭环 | `detectAbnormalVitals` 中所有项都已 `handled` |

输出形如 `{ status: '通过'|'警告'|'未通过', item, message, target }`，被右侧质控面板、签名校验、completeness 统计共用。

---

## 11. 六级评审能力映射

由 `capabilityMap`（[anesthesiaRecordData.js](src/views/anesthesia/anesthesiaRecordData.js)）声明，**15-16 项**能力名称，对应"已具备"或"前端占位"状态。在 `archive` Tab 展示为 `.capability-grid` 卡片网格，右侧 qc-panel 摘要展示前 8 项。

主要覆盖维度（实际以代码为准）：电子签名 / 修改留痕 / 时间节点 / 异常闭环 / 完整性 / 抢救流程 / 双人核对 / 设备采集 / 数据来源 / 评分量表 / 打印归档 / 共享调阅 等。

---

## 12. 已知约束与扩展位

### 12.1 当前以原型为主，未实现的部分
- 后端服务、数据持久化（仅 `localStorage` 模拟）。
- 真实设备接入（监护仪 / 麻醉机 / 输注泵均为占位）。
- PDF / OFD 导出（按钮存在，无实际生成）。
- 病案归档与共享调阅（按钮存在，无后端对接）。
- 用户体系与权限（操作人固定为 `currentOperator`）。
- 路由（单页单视图，无 vue-router）。

### 12.2 扩展点（代码已预留）
- `dictionaries.*` 可继续扩充枚举值。
- `bloodProductOptions` / `medicationCatalog` / `infusionCatalog` 可继续扩充字典。
- `runQualityRules` 可继续追加规则（数组式追加即可，前端自动反映到摘要）。
- `selectedMonitorItems` / `monitorOptions` 解耦，可平滑增加监测项目类型。
- `VITAL_FIELD_SPECS` 控制曲线坐标转换，可加入新指标。
- `events` 是事件溯源中心，可作为后续审计/回放的基础。

### 12.3 性能与可维护性提示
- 全部数据为深响应，单患者切换即整树替换；当前规模（~50 条/患者）下流畅。
- CSS 不带 Scoped，类名遵循 BEM；新增模块请遵循 `.live-*` / `.band-*` / `.qc-*` / `.editable-*` 命名前缀。
- `AnesthesiaLiveSheet.vue` 已>1500 行，未来若继续扩展建议按 band 拆分为子组件。

---

> **维护说明**：本文档随代码同步演进。修改任何字段、规则或交互后，请同步更新对应章节，并在 PR 描述中引用本文件相关条目。
