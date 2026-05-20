<template>
  <section class="tab-panel live-sheet-panel" @click="closeLiveMenu">
    <div class="section-card live-sheet-toolbar">
      <div>
        <h2>实时麻醉记录单 <span class="input-badge">实时显示 + 持续录入</span></h2>
        <p>右键新增/编辑；拖动线段自动保存。</p>
      </div>
      <div class="row-actions">
        <button class="btn small primary" :disabled="readOnly" @click="$emit('add-vital')">新增当前时间生命体征</button>
        <button class="btn small" :disabled="readOnly" @click="$emit('import-device')">从设备占位带入</button>
        <button class="btn small" @click="$emit('quality-check')">质控检查</button>
      </div>
    </div>

    <div class="section-card live-paper-card print-area">
      <div class="print-sheet-title" aria-hidden="true">
        <div></div>
        <h1>XXX医院麻醉记录单</h1>
        <div class="print-doc-meta">
          <span>编号<i></i></span>
          <span>页号<i>1</i></span>
          <strong>E</strong>
        </div>
      </div>

      <div class="print-patient-ruled" aria-hidden="true">
        <div class="print-rule-row top-meta">
          <span>科别{{ patient.ward || patient.department }}</span>
          <span>床号 {{ patient.bedNo || '-' }}</span>
          <span>住院号 {{ patient.inpatientNo }}</span>
          <span>手术日期 {{ patient.surgeryDate }}</span>
          <span>付费方式{{ patient.payType || '居民医保' }}</span>
        </div>
        <div class="print-rule-box">
          <div class="print-rule-row">
            <span>姓名 {{ patient.name }}</span>
            <span>性别 {{ patient.gender }}</span>
            <span>年龄 {{ patient.age }} 岁</span>
            <span>体重 {{ patient.weight }}kg{{ patient.awakeStatus || '清醒' }}</span>
            <span>术前用药 {{ printPreMedication }}</span>
            <span>术前禁食 {{ printFasting }}</span>
            <span>血型 {{ patient.bloodType || '0+' }}</span>
            <span>ASA {{ printAsaLevel }}</span>
          </div>
          <div class="print-rule-row two-columns">
            <span>手术前诊断 {{ patient.diagnosis }}</span>
            <span>手术时体位 {{ printPosition }}</span>
          </div>
          <div class="print-rule-row two-columns">
            <span>拟施手术 {{ patient.actualSurgery || patient.plannedSurgery }}</span>
            <span>身份证号 {{ printIdentityNo }}</span>
          </div>
        </div>
      </div>

      <div class="live-sheet-header">
        <div>
          <strong>{{ patient.name }}</strong>
          <span>{{ patient.gender }} · {{ patient.age }}岁 · {{ patient.inpatientNo }}</span>
          <span>{{ patient.room }} · {{ patient.actualSurgery }}</span>
        </div>
        <div>
          <span>记录状态：{{ record.status }}</span>
          <span>采集：{{ record.device.collectStatus }}</span>
          <span>频率：{{ record.vitalFrequency }}分钟/次</span>
        </div>
      </div>

      <div class="live-sheet-scroll">
        <div class="live-sheet-board" :style="sheetGridStyle" @contextmenu.prevent="openLiveMenu($event, 'grid')">
          <div class="sheet-time-ruler">
            <div class="sheet-left-head">项目</div>
            <div class="sheet-time-area">
              <span
                v-for="tick in rulerMajorTicks"
                :key="tick.time"
                class="major-tick-label"
                :style="{ left: tick.percent + '%' }"
              >
                {{ tick.label }}
              </span>
              <span
                v-for="tick in timeScale.minorTicks.slice(0, -1)"
                :key="tick.time"
                class="minor-tick"
                :class="{ major: tick.isMajor }"
                :style="{ left: tick.percent + '%' }"
              ></span>
            </div>
          </div>

          <div class="live-band band-medication" :style="{ '--print-rows': 9 }">
            <div class="band-side vertical">麻醉用药</div>
            <div class="band-labels">
              <div v-for="(row, index) in medicationLabelRows" :key="row.key" class="label-row screen-band-label" :style="labelRowStyle(index, 9)">
                {{ row.name }}
              </div>
              <div v-for="(row, index) in printMedicationLabelRows" :key="row.key" class="label-row print-band-label" :style="labelRowStyle(index, 9)">{{ row.label }}</div>
            </div>
            <div class="band-grid" @contextmenu.prevent.stop="openLiveMenu($event, 'drugGrid')">
              <div class="horizontal-lines"></div>
              <div class="print-grid-lines" aria-hidden="true">
                <span v-for="tick in timeScale.minorTicks.slice(0, -1)" :key="`med-v-${tick.time}`" :class="{ major: tick.isMajor }" :style="{ left: tick.percent + '%' }"></span>
              </div>
              <div class="print-row-lines" aria-hidden="true">
                <span v-for="line in printRowLines(9)" :key="`med-h-${line.key}`" :class="{ major: line.major }" :style="{ top: line.percent + '%' }"></span>
              </div>
              <span
                v-for="row in singleMedicationRows"
                :key="row.key"
                class="drug-marker"
                :style="markerStyle(row.time, row.index, row.rowCount, row.printIndex)"
                @contextmenu.prevent.stop="openLiveMenu($event, 'medication', row.source)"
              >
                {{ row.label }}
              </span>
              <div
                v-for="row in continuousMedicationRows"
                :key="row.key"
                class="fluid-line drug-line draggable-segment"
                :style="segmentStyle(row)"
                @pointerdown.stop.prevent="startSegmentDrag($event, row, 'move')"
                @contextmenu.prevent.stop="openLiveMenu($event, 'medication', row.source)"
              >
                <i class="segment-handle start" @pointerdown.stop.prevent="startSegmentDrag($event, row, 'start')"></i>
                <span>{{ row.label }}</span>
                <i class="segment-handle end" @pointerdown.stop.prevent="startSegmentDrag($event, row, 'end')"></i>
              </div>
            </div>
          </div>

          <div class="live-band band-infusion" :style="infusionBandStyle">
            <div class="band-side vertical">输液</div>
            <div class="band-labels">
              <div v-for="row in infusionRows" :key="row.id" class="label-row screen-band-label">{{ row.name }}</div>
              <div v-for="(row, index) in printInfusionLabelRows" :key="row.key" class="label-row print-band-label" :style="labelRowStyle(index, printInfusionRowCount)">{{ row.label }}</div>
            </div>
            <div class="band-grid" @contextmenu.prevent.stop="openLiveMenu($event, 'infusionGrid')">
              <div class="horizontal-lines"></div>
              <div class="print-grid-lines" aria-hidden="true">
                <span v-for="tick in timeScale.minorTicks.slice(0, -1)" :key="`inf-v-${tick.time}`" :class="{ major: tick.isMajor }" :style="{ left: tick.percent + '%' }"></span>
              </div>
              <div class="print-row-lines" aria-hidden="true">
                <span v-for="line in printRowLines(printInfusionRowCount)" :key="`inf-h-${line.key}`" :class="{ major: line.major }" :style="{ top: line.percent + '%' }"></span>
              </div>
              <div
                v-for="row in infusionRows"
                :key="row.id"
                class="fluid-line draggable-segment"
                :class="{ green: row.lineColor === 'green' }"
                :style="segmentStyle(row)"
                @pointerdown.stop.prevent="startSegmentDrag($event, row, 'move')"
                @contextmenu.prevent.stop="openLiveMenu($event, 'infusion', row.source)"
              >
                <i class="segment-handle start" @pointerdown.stop.prevent="startSegmentDrag($event, row, 'start')"></i>
                <span>{{ row.label }}</span>
                <i class="segment-handle end" @pointerdown.stop.prevent="startSegmentDrag($event, row, 'end')"></i>
              </div>
            </div>
          </div>

          <div class="live-band band-transfusion" :style="transfusionBandStyle">
            <div class="band-side vertical">输血</div>
            <div class="band-labels">
              <div v-for="row in transfusionRows" :key="row.id" class="label-row screen-band-label">{{ row.name }}</div>
              <div v-for="(row, index) in printTransfusionLabelRows" :key="row.key" class="label-row print-band-label" :style="labelRowStyle(index, printTransfusionRowCount)">{{ row.label }}</div>
            </div>
            <div class="band-grid" @contextmenu.prevent.stop="openLiveMenu($event, 'transfusionGrid')">
              <div class="horizontal-lines"></div>
              <div class="print-grid-lines" aria-hidden="true">
                <span v-for="tick in timeScale.minorTicks.slice(0, -1)" :key="`tr-v-${tick.time}`" :class="{ major: tick.isMajor }" :style="{ left: tick.percent + '%' }"></span>
              </div>
              <div class="print-row-lines" aria-hidden="true">
                <span v-for="line in printRowLines(printTransfusionRowCount)" :key="`tr-h-${line.key}`" :class="{ major: line.major }" :style="{ top: line.percent + '%' }"></span>
              </div>
              <span
                v-for="row in transfusionRows"
                :key="row.id"
                class="blood-marker"
                :style="markerStyle(row.time, row.index, row.rowCount, row.printIndex)"
                @contextmenu.prevent.stop="openLiveMenu($event, 'transfusion', row.source)"
              >
                {{ row.label }}
              </span>
            </div>
          </div>

          <div class="live-band band-monitor" :style="monitorBandStyle">
            <div class="band-side vertical">监测</div>
            <div class="band-labels">
              <div v-for="item in selectedMonitorItems" :key="item" class="label-row screen-band-label">{{ item }}</div>
              <div v-for="(row, index) in printMonitorLabelRows" :key="row.key" class="label-row print-band-label" :style="labelRowStyle(index, printMonitorRowCount)">{{ row.label }}</div>
            </div>
            <div class="band-grid monitor-grid" @contextmenu.prevent.stop="openLiveMenu($event, 'monitor')">
              <div class="print-grid-lines" aria-hidden="true">
                <span v-for="tick in timeScale.minorTicks.slice(0, -1)" :key="`mon-v-${tick.time}`" :class="{ major: tick.isMajor }" :style="{ left: tick.percent + '%' }"></span>
              </div>
              <div class="print-row-lines" aria-hidden="true">
                <span v-for="line in printRowLines(printMonitorRowCount)" :key="`mon-h-${line.key}`" :class="{ major: line.major }" :style="{ top: line.percent + '%' }"></span>
              </div>
              <span
                v-for="item in monitorCells"
                :key="item.key"
                class="monitor-text"
                :class="{ 'spo2-text': item.metric === 'SpO2', abnormal: item.abnormal }"
                :style="{ left: monitorValueLeft(item.time), top: item.top, '--row-index': item.rowIndex, '--row-count': item.rowCount }"
                :title="`${item.time} ${item.metric}：${item.value}${monitorMeta(item.metric).unit || ''}`"
                @contextmenu.prevent.stop="openMonitorEdit($event, item.row)"
                @click.stop="openMonitorEdit($event, item.row)"
              >
                {{ item.value }}
              </span>
            </div>
          </div>

          <div class="print-surgery-status-row" :style="{ '--print-rows': 1 }" aria-hidden="true">
            <div class="band-labels">
              <div class="label-row">手术状态</div>
            </div>
            <div class="band-grid status-grid">
              <div class="print-grid-lines" aria-hidden="true">
                <span v-for="tick in timeScale.minorTicks.slice(0, -1)" :key="`surgery-status-v-${tick.time}`" :class="{ major: tick.isMajor }" :style="{ left: tick.percent + '%' }"></span>
              </div>
              <span v-for="event in statusEvents" :key="`print-${event.key}`" class="status-marker" :style="{ left: timeLeft(event.time), top: event.top }">
                {{ event.symbol }}
              </span>
            </div>
          </div>

          <div class="live-vital-chart" @contextmenu.prevent.stop="openLiveMenu($event, 'chart')">
            <div class="chart-legend">
              <span class="legend-title">生命体征</span>
              <button type="button" class="legend-item" :class="{ off: !seriesVisible.sbp }" @click.stop="toggleSeries('sbp')"><b class="symbol red">▽</b> 收缩压</button>
              <button type="button" class="legend-item" :class="{ off: !seriesVisible.dbp }" @click.stop="toggleSeries('dbp')"><b class="symbol red">△</b> 舒张压</button>
              <button type="button" class="legend-item" :class="{ off: !seriesVisible.hr }" @click.stop="toggleSeries('hr')"><b class="symbol green">●</b> 脉搏</button>
              <button type="button" class="legend-item" :class="{ off: !seriesVisible.spo2 }" @click.stop="toggleSeries('spo2')"><b class="symbol blue">◇</b> SpO₂</button>
              <button type="button" class="legend-item" :class="{ off: !seriesVisible.temp }" @click.stop="toggleSeries('temp')"><b class="symbol gray">★</b> 体温</button>
              <small class="legend-tip">拖动点可改值</small>
            </div>
            <div class="vital-scale">
              <span v-for="tick in vitalTicks" :key="tick.value" :style="{ top: tick.top + '%' }">{{ tick.value }}</span>
            </div>
            <div class="chart-grid-wrap">
              <div class="print-grid-lines" aria-hidden="true">
                <span v-for="tick in timeScale.minorTicks.slice(0, -1)" :key="`chart-v-${tick.time}`" :class="{ major: tick.isMajor }" :style="{ left: tick.percent + '%' }"></span>
              </div>
              <div class="print-chart-horizontal-lines" aria-hidden="true">
                <span v-for="line in printVitalGridLines" :key="`chart-h-${line.value}`" class="major" :style="{ top: line.top + '%' }"></span>
              </div>
              <svg ref="chartSvgRef" class="live-chart-svg" viewBox="0 0 1000 300" preserveAspectRatio="none">
                <polyline v-if="seriesVisible.sbp" :points="chartLine('sbp')" class="live-line pressure" />
                <polyline v-if="seriesVisible.dbp" :points="chartLine('dbp')" class="live-line pressure thin" />
                <polyline v-if="seriesVisible.hr" :points="chartLine('hr')" class="live-line pulse" />
                <polyline v-if="seriesVisible.spo2" :points="chartLine('spo2')" class="live-line spo2" />
                <g v-if="seriesVisible.sbp">
                  <path
                    v-for="point in chartPoints('sbp')"
                    :key="point.key"
                    :d="trianglePath(point.x, point.y, false)"
                    class="pressure-point chart-hot"
                    @pointerdown.stop="startDragPoint($event, point)"
                    @contextmenu.prevent.stop="openMonitorEdit($event, point.row)"
                  >
                    <title>{{ point.row.time }} 收缩压：{{ point.value }} mmHg（拖动可改值）</title>
                  </path>
                </g>
                <g v-if="seriesVisible.dbp">
                  <path
                    v-for="point in chartPoints('dbp')"
                    :key="point.key"
                    :d="trianglePath(point.x, point.y, true)"
                    class="pressure-point chart-hot"
                    @pointerdown.stop="startDragPoint($event, point)"
                    @contextmenu.prevent.stop="openMonitorEdit($event, point.row)"
                  >
                    <title>{{ point.row.time }} 舒张压：{{ point.value }} mmHg（拖动可改值）</title>
                  </path>
                </g>
                <g v-if="seriesVisible.hr">
                  <circle
                    v-for="point in chartPoints('hr')"
                    :key="point.key"
                    :cx="point.x"
                    :cy="point.y"
                    r="5"
                    class="pulse-point chart-hot"
                    @pointerdown.stop="startDragPoint($event, point)"
                    @contextmenu.prevent.stop="openMonitorEdit($event, point.row)"
                  >
                    <title>{{ point.row.time }} 脉搏：{{ point.value }} 次/分（拖动可改值）</title>
                  </circle>
                </g>
                <g v-if="seriesVisible.spo2">
                  <path
                    v-for="point in chartPoints('spo2')"
                    :key="point.key"
                    :d="diamondPath(point.x, point.y)"
                    class="spo2-point chart-hot"
                    @pointerdown.stop="startDragPoint($event, point)"
                    @contextmenu.prevent.stop="openMonitorEdit($event, point.row)"
                  >
                    <title>{{ point.row.time }} SpO₂：{{ point.value }}%（拖动可改值）</title>
                  </path>
                </g>
                <g v-if="seriesVisible.temp">
                  <path
                    v-for="point in chartPoints('temp')"
                    :key="point.key"
                    :d="starPath(point.x, point.y)"
                    class="temp-point chart-hot"
                    @pointerdown.stop="startDragPoint($event, point)"
                    @contextmenu.prevent.stop="openMonitorEdit($event, point.row)"
                  >
                    <title>{{ point.row.time }} 体温：{{ point.value }}°C（拖动可改值）</title>
                  </path>
                </g>
                <line v-if="dragHint.visible" :x1="0" :x2="1000" :y1="dragHint.y" :y2="dragHint.y" class="drag-guide" />
              </svg>
              <div v-if="dragHint.visible" class="drag-tooltip" :style="{ left: dragHint.left + 'px', top: dragHint.top + 'px' }">
                {{ dragHint.label }}
              </div>
            </div>
          </div>

          <div class="live-band band-status band-output" :style="{ '--print-rows': 5 }">
            <div class="band-side">手术状态</div>
            <div class="status-labels">
              <div class="label-row">尿量（ml）</div>
              <div class="label-row">出血量（ml）</div>
              <div class="label-row">引流量（ml）</div>
              <div class="label-row">其他（ml）</div>
              <div class="label-row">手术关键操作</div>
            </div>
            <div class="band-grid status-grid" @contextmenu.prevent.stop="openLiveMenu($event, 'balance')">
              <div class="print-grid-lines" aria-hidden="true">
                <span v-for="tick in timeScale.minorTicks.slice(0, -1)" :key="`status-v-${tick.time}`" :class="{ major: tick.isMajor }" :style="{ left: tick.percent + '%' }"></span>
              </div>
              <div class="print-row-lines" aria-hidden="true">
                <span v-for="line in printRowLines(5)" :key="`status-h-${line.key}`" :class="{ major: line.major }" :style="{ top: line.percent + '%' }"></span>
              </div>
              <span v-for="event in statusEvents" :key="event.key" class="status-marker" :style="{ left: timeLeft(event.time), top: event.top }">
                {{ event.symbol }}
              </span>
              <span v-for="row in outputMarkers" :key="row.key" class="output-marker" :style="outputMarkerStyle(row)">
                {{ row.value }}
              </span>
            </div>
          </div>

          <div class="sheet-time-ruler bottom-ruler">
            <div class="sheet-left-head"></div>
            <div class="sheet-time-area">
              <span
                v-for="tick in timeScale.majorTicks"
                :key="tick.time"
                class="major-tick-label"
                :style="{ left: tick.percent + '%' }"
              >
                {{ tick.label }}
              </span>
            </div>
          </div>

          <div class="live-notes">
            <div>
              <h4>麻醉诱导用药</h4>
              <p v-for="med in record.medications.slice(0, 4)" :key="med.id">{{ med.time }} {{ med.name }} {{ med.dose }}{{ med.unit }} {{ med.route }}</p>
            </div>
            <div>
              <h4>辅助及特殊用药</h4>
              <p v-for="med in highAlertMeds" :key="med.id">{{ med.name }} {{ med.dose }}{{ med.unit }}，{{ med.reason || '高警示用药' }}</p>
            </div>
            <div>
              <h4>混合用药</h4>
              <p>{{ record.anesthesia.maintenanceNote || '暂无混合用药说明' }}</p>
            </div>
            <div>
              <h4>手术关键操作</h4>
              <p v-for="event in keyEvents" :key="event.id">{{ event.time }} {{ event.type }}：{{ event.content }}</p>
            </div>
            <div>
              <h4>术后镇痛</h4>
              <p>{{ recoveryText }}</p>
            </div>
          </div>

          <div class="live-time-buttons">
            <button v-for="item in surgeryTimeButtons" :key="item.label" :class="{ filled: item.value }">
              <span>✓ {{ item.label }}</span>
              <strong>{{ item.value || '未填写' }}</strong>
            </button>
            <div class="duration-summary">
              <span>麻醉时长：{{ anesthesiaDuration }}</span>
              <span>手术时长：{{ surgeryDuration }}</span>
            </div>
          </div>

          <div v-if="saveBadge.visible" class="live-save-badge" :style="{ left: saveBadge.x + 'px', top: saveBadge.y + 'px' }">
            <span>{{ saveBadge.time }}</span>
            <strong>保存成功!</strong>
          </div>
        </div>
      </div>

      <div class="print-bottom-panel" aria-hidden="true">
        <div class="print-large-notes">
          <div class="vertical-title">麻醉诱导用药</div>
          <div class="vertical-title">辅助及特殊用药</div>
          <div class="note-cell">{{ printMedicationSummary }}</div>
          <div class="vertical-title">手术关键操作</div>
          <div class="note-cell">{{ printKeyOperationSummary }}</div>
          <div class="vertical-title">术后镇痛</div>
          <div class="note-cell">{{ printAnalgesiaText }}</div>
        </div>
        <div class="print-summary-grid">
          <div>术后诊断</div><div>{{ patient.diagnosis }}</div>
          <div>入量(ml)</div><div>出量(ml)</div><div>总进出量(ml)</div>

          <div>实施手术</div><div>{{ patient.actualSurgery || patient.plannedSurgery }}</div>
          <div>胶体液 {{ fluidBalance.infusionTotal }}</div><div>出血量 {{ printFirstOutput.bloodLoss }}</div><div>总入量 {{ fluidBalance.inputTotal }}</div>

          <div>麻醉方法</div><div>{{ record.anesthesia.method }} {{ record.airway.airwayMethod }}</div>
          <div>晶体液 {{ fluidBalance.transfusionTotal }}</div><div>尿量 {{ printFirstOutput.urine }}</div><div>总出量 {{ fluidBalance.outputTotal }}</div>

          <div>手术医师</div><div>{{ record.anesthesia.surgeon || record.signatures.surgeon || '-' }}</div>
          <div>冷沉淀 0</div><div>血小板 0</div><div>其它 {{ printFirstOutput.other }}</div>

          <div>洗手护士</div><div>{{ record.anesthesia.scrubNurse || '-' }}</div>
          <div>自体血 0</div><div class="span-2">说明 {{ printSpecialMedSummary }}</div>

          <div>交班情况</div><div class="span-4">{{ printHandoverText }}</div>
        </div>
      </div>
    </div>

    <div
      v-if="liveMenu.visible"
      class="live-context-menu"
      :style="{ left: liveMenu.x + 'px', top: liveMenu.y + 'px' }"
      @click.stop
    >
      <template v-for="section in menuSections" :key="section.key">
        <div v-if="section.key === 'fluid-infusion'" class="menu-item has-sub">
          <span>新增输液</span>
          <div class="submenu">
            <button v-for="item in infusionCatalog" :key="item.name" :disabled="readOnly" @click="addMenuInfusion(item)">{{ item.name }} {{ item.spec }}</button>
            <button :disabled="readOnly" @click="openInfusionEditor(null)">自定义输液…</button>
          </div>
        </div>
        <div v-else-if="section.key === 'fluid-transfusion'" class="menu-item has-sub">
          <span>新增输血</span>
          <div class="submenu">
            <button v-for="item in bloodProductOptions" :key="item.product" :disabled="readOnly" @click="addMenuTransfusion(item)">{{ item.product }}（{{ item.unit }}）</button>
            <button :disabled="readOnly" @click="openTransfusionEditor(null)">自定义输血…</button>
          </div>
        </div>
        <div v-else-if="section.key === 'drug-iv'" class="menu-item has-sub">
          <span>静脉麻醉药</span>
          <div class="submenu">
            <div v-for="drug in ivAnestheticDrugs" :key="drug" class="menu-item has-sub">
              <span>{{ drug }}</span>
              <div class="submenu">
                <button :disabled="readOnly" @click="addQuickDrug(drug, true)">持续用药</button>
                <button :disabled="readOnly" @click="addQuickDrug(drug, false)">单次用药</button>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="section.key === 'drug-local'" class="menu-item has-sub">
          <span>局麻用药</span>
          <div class="submenu">
            <div v-for="drug in localAnestheticDrugs" :key="drug" class="menu-item has-sub">
              <span>{{ drug }}</span>
              <div class="submenu">
                <button :disabled="readOnly" @click="addQuickDrug(drug, true)">持续用药</button>
                <button :disabled="readOnly" @click="addQuickDrug(drug, false)">单次用药</button>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="section.key === 'drug-recent'" class="menu-item has-sub">
          <span>最近用药</span>
          <div class="submenu">
            <button v-if="!recentDrugNames.length" disabled>暂无</button>
            <button v-for="drug in recentDrugNames" :key="drug" :disabled="readOnly" @click="addQuickDrug(drug, false)">{{ drug }}</button>
          </div>
        </div>
        <button v-else-if="section.key === 'edit-line'" :disabled="readOnly" @click="openLineEditor">编辑数据</button>
        <button v-else-if="section.key === 'continue-line'" :disabled="readOnly" @click="continueLine">继续用药/输液</button>
        <button v-else-if="section.key === 'delete-line'" class="danger-menu" :disabled="readOnly" @click="deleteLine">删除当前项</button>
        <button v-else-if="section.key === 'vital-add'" :disabled="readOnly" @click="openMonitorDialog(false)">添加数据</button>
        <button v-else-if="section.key === 'vital-batch'" :disabled="readOnly" @click="openMonitorDialog(true)">批量添加数据</button>
        <button v-else-if="section.key === 'vital-list'" @click="openDataList('vitals')">体征数据列表</button>
        <button v-else-if="section.key === 'vital-observe'" :disabled="readOnly" @click="showObserveSetting = true">监测项目</button>
        <button v-else-if="section.key === 'output-add'" :disabled="readOnly" @click="openOutputEditor(null)">添加出入量</button>
        <button v-else-if="section.key === 'output-list'" @click="openDataList('outputs')">出入量列表</button>
        <button v-else-if="section.key === 'medication-list'" @click="openDataList('medications')">用药列表</button>
        <button v-else-if="section.key === 'infusion-list'" @click="openDataList('infusions')">输液列表</button>
        <button v-else-if="section.key === 'transfusion-list'" @click="openDataList('transfusions')">输血列表</button>
      </template>
    </div>

    <div v-if="showLineEditor" class="live-modal-backdrop top-layer">
      <div class="live-modal small">
        <header>
          <strong>{{ lineForm.kind }}数据</strong>
          <button @click="showLineEditor = false">×</button>
        </header>
        <div class="live-modal-body">
          <label v-if="lineForm.kind === '输液'">
            输液品名
            <select v-model="lineForm.name" @change="syncLineInfusionCatalog">
              <option v-for="item in infusionCatalog" :key="item.name" :value="item.name">{{ item.name }}（{{ item.spec }}）</option>
              <option value="__custom__">自定义…</option>
            </select>
          </label>
          <label v-if="lineForm.kind === '输液' && lineForm.name === '__custom__'">自定义名称<input v-model="lineForm.customName" /></label>
          <label v-if="lineForm.kind === '用药'">药品名称<input v-model="lineForm.name" /></label>
          <label v-if="lineForm.kind === '用药'" class="line-mode-row">
            <span class="label-text">类型</span>
            <span class="mode-toggle inline">
              <label class="mode-option"><input v-model="lineForm.continuous" type="radio" :value="false" />单次用药</label>
              <label class="mode-option"><input v-model="lineForm.continuous" type="radio" :value="true" />持续用药</label>
            </span>
          </label>
          <label v-if="lineForm.kind === '输血'">
            血品
            <select v-model="lineForm.name" @change="syncLineBloodProduct">
              <option v-for="item in bloodProductOptions" :key="item.product" :value="item.product">{{ item.product }}</option>
            </select>
          </label>
          <label>
            开始时间
            <span class="time-stepper">
              <button @click="shiftObjectTime(lineForm, 'time', -LIVE_TIME_STEP_MINUTES)">-</button>
              <input v-model="lineForm.time" type="time" step="60" @keydown.up.prevent="shiftObjectTime(lineForm, 'time', LIVE_TIME_STEP_MINUTES)" @keydown.down.prevent="shiftObjectTime(lineForm, 'time', -LIVE_TIME_STEP_MINUTES)" />
              <button @click="shiftObjectTime(lineForm, 'time', LIVE_TIME_STEP_MINUTES)">+</button>
            </span>
          </label>
          <label>
            <span class="label-text">结束时间<small v-if="lineForm.kind === '输液'" class="hint">（可为空）</small><small v-else-if="lineForm.kind === '用药' && !lineForm.continuous" class="hint">（单次用药已禁用）</small></span>
            <span class="time-stepper">
              <button :disabled="lineForm.kind === '用药' && !lineForm.continuous" @click="shiftObjectTime(lineForm, 'endTime', -LIVE_TIME_STEP_MINUTES)">-</button>
              <input v-model="lineForm.endTime" type="time" step="60" :disabled="lineForm.kind === '用药' && !lineForm.continuous" @keydown.up.prevent="shiftObjectTime(lineForm, 'endTime', LIVE_TIME_STEP_MINUTES)" @keydown.down.prevent="shiftObjectTime(lineForm, 'endTime', -LIVE_TIME_STEP_MINUTES)" />
              <button :disabled="lineForm.kind === '用药' && !lineForm.continuous" @click="shiftObjectTime(lineForm, 'endTime', LIVE_TIME_STEP_MINUTES)">+</button>
              <button v-if="lineForm.kind === '输液'" class="small clear-btn" @click="lineForm.endTime = ''" type="button">清空</button>
            </span>
          </label>
          <p v-if="lineFormError" class="form-error">{{ lineFormError }}</p>
          <label>剂量/容量<input v-model="lineForm.amount" type="number" /></label>
          <label v-if="lineForm.kind === '用药'">
            单位
            <select v-model="lineForm.unit">
              <option v-for="unit in medicationUnitOptions" :key="unit">{{ unit }}</option>
            </select>
          </label>
          <label v-if="lineForm.kind === '输血'">
            血品单位
            <input :value="lineForm.volumeUnit" readonly title="单位随血品自动设置" />
          </label>
          <label v-if="lineForm.kind === '输血'">血型<input v-model="lineForm.bloodType" /></label>
          <label v-if="lineForm.kind === '用药'">途径<input v-model="lineForm.route" /></label>
          <label v-if="lineForm.kind === '输血'">血袋号<input v-model="lineForm.bagNo" /></label>
          <label v-if="lineForm.kind === '输血'" class="line-confirm-row">
            <span class="label-text">双人核对</span>
            <span class="confirm-group">
              <label class="mode-option"><input v-model="lineForm.anesthesiaConfirm" type="checkbox" />麻醉医师</label>
              <label class="mode-option"><input v-model="lineForm.circulatingConfirm" type="checkbox" />巡回护士</label>
            </span>
          </label>
          <label v-if="lineForm.kind === '输血'">反应情况<input v-model="lineForm.reaction" /></label>
        </div>
        <footer>
          <button class="btn small" @click="showLineEditor = false">关闭</button>
          <button class="btn small primary" @click="saveLineEditor">保存</button>
        </footer>
      </div>
    </div>

    <div v-if="showMonitorDialog" class="live-modal-backdrop">
      <div class="live-modal monitor-modal" tabindex="0" @keydown.esc.prevent="showMonitorDialog = false" @keydown.enter.prevent="saveMonitorRows">
        <header>
          <strong>{{ monitorForm.editingId ? '编辑监护项目结果' : '新建监护项目结果' }}</strong>
          <button @click="showMonitorDialog = false">×</button>
        </header>
        <div class="live-modal-body monitor-form">
          <h4>{{ monitorForm.batch ? '批量监护项目结果' : '监护项目结果' }}</h4>
          <div class="monitor-form-time">
            <label>
              日期
              <input v-model="monitorForm.date" type="date" />
            </label>
            <label>
              时间
              <span class="time-stepper">
                <button @click="shiftObjectTime(monitorForm, 'time', -LIVE_TIME_STEP_MINUTES)">-</button>
                <input v-model="monitorForm.time" type="time" step="60" @keydown.up.prevent="shiftObjectTime(monitorForm, 'time', LIVE_TIME_STEP_MINUTES)" @keydown.down.prevent="shiftObjectTime(monitorForm, 'time', -LIVE_TIME_STEP_MINUTES)" />
                <button @click="shiftObjectTime(monitorForm, 'time', LIVE_TIME_STEP_MINUTES)">+</button>
              </span>
            </label>
            <label v-if="monitorForm.batch">
              结束
              <span class="time-stepper">
                <button @click="shiftObjectTime(monitorForm, 'endTime', -LIVE_TIME_STEP_MINUTES)">-</button>
                <input v-model="monitorForm.endTime" type="time" step="60" @keydown.up.prevent="shiftObjectTime(monitorForm, 'endTime', LIVE_TIME_STEP_MINUTES)" @keydown.down.prevent="shiftObjectTime(monitorForm, 'endTime', -LIVE_TIME_STEP_MINUTES)" />
                <button @click="shiftObjectTime(monitorForm, 'endTime', LIVE_TIME_STEP_MINUTES)">+</button>
              </span>
            </label>
            <label v-if="monitorForm.batch">
              间隔
              <span class="monitor-interval">
                <input v-model.number="monitorForm.interval" type="number" min="1" />
                <span>分钟</span>
              </span>
            </label>
          </div>
          <h4>{{ monitorForm.batch ? '批量项目明细' : '项目明细' }}</h4>
          <div class="monitor-fetch-bar">
            <button class="btn small" type="button" :disabled="readOnly" @click="fetchMonitorMock">自动获取</button>
            <details class="monitor-hint">
              <summary>提示</summary>
              <div class="hint">未获取时默认为空；双击已有记录可带出默认值进入编辑</div>
            </details>
          </div>
          <div class="monitor-item-grid">
            <div v-for="item in selectedMonitorItems" :key="item" class="monitor-item">
              <span class="monitor-item-name">{{ item }}</span>
              <select v-if="monitorMeta(item).options" v-model="monitorValues[item]" :disabled="readOnly">
                <option v-for="option in monitorMeta(item).options" :key="option" :value="option">{{ option === '' ? '（清空）' : option }}</option>
              </select>
              <input
                v-else
                :value="monitorValues[item]"
                :type="monitorMeta(item).type || 'text'"
                v-bind="monitorInputAttrs(item)"
                :disabled="readOnly"
                @input="updateMonitorValue(item, $event.target.value)"
              />
              <span class="monitor-item-unit">{{ monitorMeta(item).unit }}</span>
            </div>
          </div>
          <p v-if="monitorFormError" class="form-error">{{ monitorFormError }}</p>
        </div>
        <footer>
          <button class="btn small primary" @click="saveMonitorRows">保存</button>
          <button class="btn small" @click="showMonitorDialog = false">关闭</button>
        </footer>
      </div>
    </div>

    <div v-if="showOutputDialog" class="live-modal-backdrop">
      <div class="live-modal small">
        <header>
          <strong>出入量设置</strong>
          <button @click="showOutputDialog = false">×</button>
        </header>
        <div class="live-modal-body">
          <label>
            时间
            <span class="time-stepper">
              <button @click="shiftObjectTime(outputForm, 'time', -LIVE_TIME_STEP_MINUTES)">-</button>
              <input v-model="outputForm.time" type="time" step="60" @keydown.up.prevent="shiftObjectTime(outputForm, 'time', LIVE_TIME_STEP_MINUTES)" @keydown.down.prevent="shiftObjectTime(outputForm, 'time', -LIVE_TIME_STEP_MINUTES)" />
              <button @click="shiftObjectTime(outputForm, 'time', LIVE_TIME_STEP_MINUTES)">+</button>
            </span>
          </label>
          <label>尿量 ml<input v-model.number="outputForm.urine" type="number" /></label>
          <label>出血量 ml<input v-model.number="outputForm.bloodLoss" type="number" /></label>
          <label>引流量 ml<input v-model.number="outputForm.drainage" type="number" /></label>
          <label>其他 ml<input v-model.number="outputForm.other" type="number" /></label>
          <label>备注<input v-model="outputForm.remark" /></label>
        </div>
        <footer>
          <button class="btn small" @click="showOutputDialog = false">关闭</button>
          <button class="btn small primary" @click="saveOutput">保存</button>
        </footer>
      </div>
    </div>

    <div v-if="showObserveSetting" class="live-modal-backdrop">
      <div class="live-modal observe-modal">
        <header>
          <strong>观察项设置</strong>
          <button @click="showObserveSetting = false">×</button>
        </header>
        <div class="observe-body">
          <div>
            <h4>未选项</h4>
            <button v-for="item in unselectedMonitorItems" :key="item" @click="toggleMonitorItem(item)">{{ item }}</button>
          </div>
          <div class="observe-arrows">
            <button>→</button>
            <button>←</button>
          </div>
          <div>
            <h4>已选项</h4>
            <button v-for="item in selectedMonitorItems" :key="item" @click="toggleMonitorItem(item)">{{ item }}</button>
          </div>
        </div>
        <footer>
          <button class="btn small primary" @click="showObserveSetting = false">保存</button>
        </footer>
      </div>
    </div>

    <div v-if="showDataModal" class="live-modal-backdrop">
      <div class="live-modal data-modal">
        <header>
          <strong>{{ dataListTitle }}</strong>
          <button @click="showDataModal = false">×</button>
        </header>
        <div class="data-tabs">
          <button v-for="tab in dataTabs" :key="tab.key" :class="{ active: activeDataList === tab.key }" @click="activeDataList = tab.key">
            {{ tab.label }}
          </button>
        </div>
        <div class="live-modal-body data-list-body">
          <table v-if="activeDataList === 'vitals'" class="live-data-table">
            <thead><tr><th>时间</th><th v-for="item in selectedMonitorItems" :key="item">{{ item }}</th><th>来源</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.vitals" :key="row.id" @dblclick="openMonitorEdit($event, row)">
                <td><input v-model="row.time" type="time" :disabled="readOnly" /></td>
                <td v-for="item in selectedMonitorItems" :key="item"><input :value="monitorValue(row, item)" :disabled="readOnly" @input="setMonitorValue(row, item, $event.target.value)" /></td>
                <td><input v-model="row.source" :disabled="readOnly" /></td>
                <td><button :disabled="readOnly" @click="deleteRow(record.vitals, row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>

          <table v-if="activeDataList === 'medications'" class="live-data-table med-data-table">
            <thead><tr><th>类型</th><th>时间</th><th>结束</th><th>药名</th><th>剂量</th><th>单位</th><th>途径</th><th>执行人</th><th>核对</th><th>备注</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.medications" :key="row.id" @dblclick="openLineEditFromList(row)">
                <td>
                  <span class="mode-tag" :class="{ continuous: isContinuousDrug(row) }">{{ isContinuousDrug(row) ? '持续' : '单次' }}</span>
                </td>
                <td><input v-model="row.time" type="time" :disabled="readOnly" /></td>
                <td><input v-model="row.endTime" type="time" :disabled="readOnly || !isContinuousDrug(row)" :title="!isContinuousDrug(row) ? '单次用药无结束时间' : ''" /></td>
                <td><input v-model="row.name" :disabled="readOnly" /></td>
                <td><input v-model="row.dose" :disabled="readOnly" /></td>
                <td><input v-model="row.unit" :disabled="readOnly" /></td>
                <td><input v-model="row.route" :disabled="readOnly" /></td>
                <td><input v-model="row.executor" :disabled="readOnly" /></td>
                <td><input v-model="row.checker" :disabled="readOnly" /></td>
                <td><input v-model="row.remark" :disabled="readOnly" /></td>
                <td>
                  <button :disabled="readOnly" @click="openLineEditFromList(row)">编辑</button>
                  <button :disabled="readOnly" @click="deleteRow(record.medications, row.id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>

          <table v-if="activeDataList === 'infusions'" class="live-data-table">
            <thead><tr><th>时间</th><th>结束</th><th>液体</th><th>规格</th><th>量 ml</th><th>执行人</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.infusions" :key="row.id">
                <td><input v-model="row.time" type="time" :disabled="readOnly" /></td>
                <td><input v-model="row.endTime" type="time" :disabled="readOnly" /></td>
                <td><input v-model="row.name" :disabled="readOnly" /></td>
                <td><input v-model="row.spec" :disabled="readOnly" /></td>
                <td><input v-model.number="row.volume" type="number" :disabled="readOnly" /></td>
                <td><input v-model="row.executor" :disabled="readOnly" /></td>
                <td><button :disabled="readOnly" @click="deleteRow(record.infusions, row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>

          <table v-if="activeDataList === 'transfusions'" class="live-data-table">
            <thead><tr><th>时间</th><th>结束</th><th>血品</th><th>血袋号</th><th>血型</th><th>数量</th><th>单位</th><th>麻醉核对</th><th>巡回核对</th><th>反应</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.transfusions" :key="row.id">
                <td><input v-model="row.time" type="time" :disabled="readOnly" /></td>
                <td><input v-model="row.endTime" type="time" :disabled="readOnly" /></td>
                <td>
                  <select v-model="row.product" :disabled="readOnly" @change="syncBloodProductRow(row)">
                    <option v-for="item in bloodProductOptions" :key="item.product" :value="item.product">{{ item.product }}</option>
                  </select>
                </td>
                <td><input v-model="row.bagNo" :disabled="readOnly" /></td>
                <td><input v-model="row.bloodType" :disabled="readOnly" /></td>
                <td><input v-model.number="row.volume" type="number" :disabled="readOnly" /></td>
                <td>
                  <select v-model="row.unit" :disabled="readOnly">
                    <option v-for="unit in transfusionUnits" :key="unit">{{ unit }}</option>
                  </select>
                </td>
                <td><input v-model="row.anesthesiaConfirm" type="checkbox" :disabled="readOnly" @change="row.doubleCheck = row.anesthesiaConfirm && row.circulatingConfirm" /></td>
                <td><input v-model="row.circulatingConfirm" type="checkbox" :disabled="readOnly" @change="row.doubleCheck = row.anesthesiaConfirm && row.circulatingConfirm" /></td>
                <td><input v-model="row.reaction" :disabled="readOnly" /></td>
                <td><button :disabled="readOnly" @click="deleteRow(record.transfusions, row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>

          <table v-if="activeDataList === 'outputs'" class="live-data-table">
            <thead><tr><th>时间</th><th>尿量</th><th>出血</th><th>引流</th><th>其他</th><th>备注</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.outputs" :key="row.id">
                <td><input v-model="row.time" type="time" :disabled="readOnly" /></td>
                <td><input v-model.number="row.urine" type="number" :disabled="readOnly" /></td>
                <td><input v-model.number="row.bloodLoss" type="number" :disabled="readOnly" /></td>
                <td><input v-model.number="row.drainage" type="number" :disabled="readOnly" /></td>
                <td><input v-model.number="row.other" type="number" :disabled="readOnly" /></td>
                <td><input v-model="row.remark" :disabled="readOnly" /></td>
                <td><button :disabled="readOnly" @click="deleteRow(record.outputs, row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref } from 'vue';
import {
  buildLiveTimeScale,
  bloodProductOptions,
  calculateFluidBalance,
  calculateLiveSheetEnd,
  clockToMinutes,
  dragTimeSegment,
  formatMinutes,
  LIVE_DEFAULT_SEGMENT_MINUTES,
  LIVE_TIME_STEP_MINUTES,
  medicationUnitOptions,
  minutesToClock,
  normalizeMedicationEditorPayload,
  normalizeTransfusionEditorPayload,
  timeToPercent,
} from './anesthesiaRecordHelpers.js';

const props = defineProps({
  patient: { type: Object, required: true },
  record: { type: Object, required: true },
  readOnly: { type: Boolean, default: false },
});

defineEmits(['add-vital', 'import-device', 'quality-check']);

const liveMenu = reactive({ visible: false, x: 0, y: 0, type: 'grid', target: null });
const saveBadge = reactive({ visible: false, x: 0, y: 0, time: '' });
const dragState = reactive({ active: false, mode: '', row: null, startX: 0, originalStart: '', originalEnd: '' });
const showLineEditor = ref(false);
const showMonitorDialog = ref(false);
const showOutputDialog = ref(false);
const showObserveSetting = ref(false);
const showDataModal = ref(false);
const activeDataList = ref('vitals');
const selectedMonitorItems = ref(['SpO2', 'ECG', '收缩压', '舒张压', '脉搏', '体温', '机械通气']);
const seriesVisible = reactive({ sbp: true, dbp: true, hr: true, spo2: true, temp: true });
const monitorValues = reactive({});
const lineForm = reactive({ kind: '用药', id: '', name: '', customName: '', time: '', endTime: '', amount: '', unit: '', route: '', bagNo: '', bloodType: '', volumeUnit: '', doubleCheck: false, anesthesiaConfirm: false, circulatingConfirm: false, reaction: '无', continuous: false });
const lineFormError = ref('');
const monitorFormError = ref('');
const outputForm = reactive({ id: '', time: '', urine: 0, bloodLoss: 0, drainage: 0, other: 0, remark: '' });
const monitorForm = reactive({ batch: false, date: '2026-05-18', time: '11:06', endTime: '11:36', interval: 10, editingId: '' });

const dataTabs = [
  { key: 'vitals', label: '体征' },
  { key: 'medications', label: '用药' },
  { key: 'infusions', label: '输液' },
  { key: 'transfusions', label: '输血' },
  { key: 'outputs', label: '出入量' },
];
const monitorOptions = ['SpO2', 'ECG', '收缩压', '舒张压', '脉搏', '体温', '机械通气', 'ETCO2', 'NIBP', 'ART', 'RESP', 'BIS', '气道压力', 'MAC', '呼吸动力', '有创舒张压', 'TV'];
const localAnestheticDrugs = ['0.375%布比卡因', '0.6%甲磺酸罗哌卡因', '0.1875%布比卡因', '0.3%罗哌卡因', '0.25%罗哌卡因'];
const ivAnestheticDrugs = ['右美托咪定', '丙泊酚', '瑞芬太尼', '舒芬太尼', '罗库溴铵'];
const infusionCatalog = [
  { name: '乳酸钠林格液', spec: '500ml', volume: 500 },
  { name: '羟乙基淀粉', spec: '500ml', volume: 500 },
  { name: '复方电解质注射液', spec: '500ml', volume: 500 },
  { name: '0.9%氯化钠注射液', spec: '500ml', volume: 500 },
  { name: '5%葡萄糖注射液', spec: '250ml', volume: 250 },
  { name: '白蛋白', spec: '10g', volume: 50 },
];
const medicationCatalog = [
  { name: '右美托咪定', unit: 'ug', dose: 100, route: '静脉注射' },
  { name: '丙泊酚', unit: 'mg', dose: 120, route: '静脉注射' },
  { name: '舒芬太尼', unit: 'ug', dose: 20, route: '静脉注射' },
  { name: '瑞芬太尼', unit: 'ug/kg·min', dose: 0.1, route: '泵入' },
  { name: '罗库溴铵', unit: 'mg', dose: 50, route: '静脉注射' },
  { name: '氧气', unit: 'l/min', dose: 2, route: '吸入' },
  { name: '1%罗哌卡因', unit: 'ml', dose: 1, route: '蛛网膜下腔' },
  { name: '2%利多卡因', unit: 'ml', dose: 4, route: '硬膜外' },
  { name: '0.75%布比卡因', unit: 'mg', dose: 7.5, route: '蛛网膜下腔' },
  { name: '去甲肾上腺素', unit: 'ug/kg·min', dose: 0.05, route: '泵入' },
  { name: '麻黄碱', unit: 'mg', dose: 6, route: '静脉注射' },
  { name: '阿托品', unit: 'mg', dose: 0.5, route: '静脉注射' },
];
const transfusionUnits = [...new Set(bloodProductOptions.map((item) => item.unit))];
const vitalListFields = [
  { key: 'sbp', label: '收缩压' },
  { key: 'dbp', label: '舒张压' },
  { key: 'hr', label: '脉搏' },
  { key: 'rr', label: '呼吸' },
  { key: 'spo2', label: 'SpO2' },
  { key: 'etco2', label: 'EtCO2' },
  { key: 'temp', label: '体温' },
  { key: 'bis', label: 'BIS' },
  { key: 'ecg', label: 'ECG' },
  { key: 'ventilation', label: '机械通气' },
];
const monitorDefaults = {
  SpO2: { key: 'spo2', default: 99, unit: '%', type: 'number' },
  ECG: { key: 'ecg', default: '窦性', unit: '', options: ['', '窦性', '房颤', '室早', '起搏'] },
  '收缩压': { key: 'sbp', default: 120, unit: 'mmHg', type: 'number' },
  '舒张压': { key: 'dbp', default: 70, unit: 'mmHg', type: 'number' },
  '脉搏': { key: 'hr', default: 75, unit: '次/分', type: 'number' },
  '机械通气': { key: 'ventilation', default: 'IPPV', unit: '', options: ['', 'IPPV', 'SIMV', 'PCV', 'PSV', '自主呼吸'] },
  '体温': { key: 'temp', default: 36.5, unit: '℃', type: 'number' },
  '有创舒张压': { key: 'invasiveDbp', default: 64, unit: 'mmHg', type: 'number' },
  ETCO2: { key: 'etco2', default: 38, unit: 'mmHg', type: 'number' },
  NIBP: { key: 'nibp', default: '120/75', unit: 'mmHg' },
  ART: { key: 'art', default: '118/70', unit: 'mmHg' },
  RESP: { key: 'rr', default: 12, unit: '次/分', type: 'number' },
  BIS: { key: 'bis', default: 48, unit: '', type: 'number' },
  T: { key: 'temp', default: 36.5, unit: '℃', type: 'number' },
  '气道压力': { key: 'airwayPressure', default: 18, unit: 'cmH2O', type: 'number' },
  MAC: { key: 'mac', default: 0.9, unit: '', type: 'number' },
  '呼吸动力': { key: 'respPower', default: '正常', unit: '' },
  TV: { key: 'tv', default: 450, unit: 'ml', type: 'number' },
};

selectedMonitorItems.value.forEach(ensureMonitorDefault);

const recentDrugNames = computed(() => [...new Set((props.record.medications || []).map((item) => item.name).filter(Boolean))].slice(0, 6));
const hasLineTarget = computed(() => ['medication', 'infusion', 'transfusion'].includes(liveMenu.type) && liveMenu.target);
const isGridMenu = computed(() => ['grid', 'monitor', 'chart'].includes(liveMenu.type));
const showDrugMenus = computed(() => ['grid', 'drugGrid', 'medication'].includes(liveMenu.type));
const showFluidMenus = computed(() => ['grid', 'infusionGrid', 'transfusionGrid', 'infusion', 'transfusion'].includes(liveMenu.type));

const menuSections = computed(() => {
  const type = liveMenu.type;
  const target = liveMenu.target;
  const sections = [];

  if (['medication', 'infusion', 'transfusion'].includes(type) && target) {
    sections.push({ key: 'edit-line' }, { key: 'continue-line' }, { key: 'delete-line' });
  }

  const fluidEntries = [
    { key: 'fluid-infusion', show: ['grid', 'infusionGrid', 'infusion'].includes(type) },
    { key: 'fluid-transfusion', show: ['grid', 'transfusionGrid', 'transfusion'].includes(type) },
  ];
  const drugEntries = [
    { key: 'drug-iv', show: ['grid', 'drugGrid', 'medication'].includes(type) },
    { key: 'drug-local', show: ['grid', 'drugGrid', 'medication'].includes(type) },
    { key: 'drug-recent', show: true },
  ];
  const vitalEntries = [
    { key: 'vital-add', show: isGridMenu.value },
    { key: 'vital-batch', show: isGridMenu.value },
    { key: 'vital-list', show: isGridMenu.value },
    { key: 'vital-observe', show: isGridMenu.value },
  ];
  const outputEntries = [
    { key: 'output-add', show: isGridMenu.value || type === 'balance' },
    { key: 'output-list', show: isGridMenu.value || type === 'balance' },
  ];
  const listEntries = [
    { key: 'medication-list', show: type === 'medication' || type === 'drugGrid' },
    { key: 'infusion-list', show: type === 'infusion' || type === 'infusionGrid' },
    { key: 'transfusion-list', show: type === 'transfusion' || type === 'transfusionGrid' },
  ];

  const groups = {
    infusion: [fluidEntries, vitalEntries, drugEntries, outputEntries, listEntries],
    infusionGrid: [fluidEntries, vitalEntries, drugEntries, outputEntries, listEntries],
    transfusion: [[fluidEntries[1], fluidEntries[0]], vitalEntries, drugEntries, outputEntries, listEntries],
    transfusionGrid: [[fluidEntries[1], fluidEntries[0]], vitalEntries, drugEntries, outputEntries, listEntries],
    medication: [drugEntries, fluidEntries, vitalEntries, outputEntries, listEntries],
    drugGrid: [drugEntries, fluidEntries, vitalEntries, outputEntries, listEntries],
    monitor: [vitalEntries, drugEntries, fluidEntries, outputEntries, listEntries],
    chart: [vitalEntries, drugEntries, fluidEntries, outputEntries, listEntries],
    balance: [outputEntries, vitalEntries, drugEntries, fluidEntries, listEntries],
    grid: [vitalEntries, drugEntries, fluidEntries, outputEntries, listEntries],
  };

  (groups[type] || groups.grid).forEach((group) => {
    group.filter((entry) => entry.show).forEach((entry) => sections.push(entry));
  });

  return sections;
});
const unselectedMonitorItems = computed(() => monitorOptions.filter((item) => !selectedMonitorItems.value.includes(item)));
const dataListTitle = computed(() => dataTabs.find((tab) => tab.key === activeDataList.value)?.label + '数据列表');

const sheetStart = computed(() => {
  const candidates = [props.record.anesthesia.inRoomTime, props.record.anesthesia.recordStart, props.record.startedAt, props.record.vitals?.[0]?.time, '11:00'].filter(Boolean);
  const first = candidates.map((time) => clockToMinutes(time)).filter((value) => value !== null).sort((a, b) => a - b)[0];
  return minutesToClock(Math.floor((first ?? 660) / 30) * 30);
});
const sheetEnd = computed(() => {
  const record = props.record;
  const candidates = [
    record.anesthesia.outRoomTime,
    record.anesthesia.anesthesiaEnd,
    record.anesthesia.surgeryEnd,
    (record.vitals || []).map((row) => row.time),
    (record.medications || []).flatMap((row) => [row.time, row.endTime]),
    (record.infusions || []).flatMap((row) => [row.time, row.endTime]),
    (record.transfusions || []).flatMap((row) => [row.time, row.endTime]),
    (record.outputs || []).map((row) => row.time),
    (record.events || []).map((row) => row.time),
  ];
  return calculateLiveSheetEnd(sheetStart.value, candidates, 210, 30);
});
const timeScale = computed(() => buildLiveTimeScale(sheetStart.value, sheetEnd.value, 5, 30));
const rulerMajorTicks = computed(() => timeScale.value.majorTicks.filter((tick) => String(tick.time || '').endsWith(':00')));
const sheetGridStyle = computed(() => ({
  '--minor-columns': Math.max(1, timeScale.value.totalMinutes / timeScale.value.minorInterval),
  '--major-columns': Math.max(1, timeScale.value.totalMinutes / timeScale.value.majorInterval),
  '--major-step': Math.max(1, timeScale.value.majorInterval / timeScale.value.minorInterval),
}));
const visibleVitals = computed(() => props.record.vitals || []);
const vitalTicks = computed(() => [40, 60, 80, 100, 120, 140, 160, 180, 200].map((value) => ({ value, top: 100 - ((value - 40) / 160) * 100 })));
const printVitalGridLines = computed(() => vitalTicks.value);
const chartSvgRef = ref(null);
const dragHint = reactive({ visible: false, y: 0, left: 0, top: 0, label: '' });
const activeDragCleanups = new Set();

function registerDragCleanup(cleanup) {
  activeDragCleanups.add(cleanup);
  return () => {
    if (activeDragCleanups.delete(cleanup)) cleanup();
  };
}

function cleanupDragListeners() {
  activeDragCleanups.forEach((cleanup) => cleanup());
  activeDragCleanups.clear();
  dragState.active = false;
  dragHint.visible = false;
  saveBadge.visible = false;
}

onUnmounted(cleanupDragListeners);

const VITAL_FIELD_SPECS = {
  sbp: { label: '收缩压', unit: 'mmHg', toY: (v) => 300 - ((v - 40) / 160) * 300, fromY: (y) => Math.round(40 + ((300 - y) / 300) * 160), min: 40, max: 220, decimals: 0 },
  dbp: { label: '舒张压', unit: 'mmHg', toY: (v) => 300 - ((v - 40) / 160) * 300, fromY: (y) => Math.round(40 + ((300 - y) / 300) * 160), min: 20, max: 180, decimals: 0 },
  hr:  { label: '脉搏', unit: '次/分', toY: (v) => 300 - ((v - 40) / 160) * 300, fromY: (y) => Math.round(40 + ((300 - y) / 300) * 160), min: 30, max: 220, decimals: 0 },
  spo2:{ label: 'SpO₂', unit: '%', toY: (v) => 300 - ((v - 40) / 60) * 300, fromY: (y) => Math.round(40 + ((300 - y) / 300) * 60), min: 50, max: 100, decimals: 0 },
  temp:{ label: '体温', unit: '°C', toY: (v) => 300 - ((v - 34) / 6) * 300, fromY: (y) => Math.round((34 + ((300 - y) / 300) * 6) * 10) / 10, min: 33, max: 41, decimals: 1 },
};
const medicationGroups = computed(() => {
  const groups = new Map();
  const order = [];
  (props.record.medications || []).forEach((med) => {
    if (!med) return;
    const name = String(med.name || '').trim() || '未命名';
    if (!groups.has(name)) {
      groups.set(name, []);
      order.push(name);
    }
    groups.get(name).push(med);
  });
  return order.slice(0, 8).map((name, index) => {
    const items = groups.get(name) || [];
    const units = [...new Set(items.map((item) => item?.unit).filter(Boolean))];
    return { key: `med-group-${index}-${name}`, name, items, units };
  });
});

const medicationLabelRows = computed(() => {
  const rows = [{ key: 'plane', name: '麻醉平面' }, ...medicationGroups.value.map((item) => ({ key: item.key, name: item.name }))];
  while (rows.length < 9) rows.push({ key: `med-empty-${rows.length}`, name: '' });
  return rows.slice(0, 9);
});

const medicationRows = computed(() =>
  medicationGroups.value.flatMap((group, index) =>
    group.items.map((med) => ({
      ...med,
      source: med,
      index,
      printIndex: index + 1,
      rowCount: 9,
      endTime: med.endTime || addMinutes(med.time, isContinuousDrug(med) ? 45 : 0),
      label: `${med.dose || ''}${med.unit ? ` ${med.unit}` : ''}`,
      key: `${med.id || med.time || ''}-${index}-${med.name || ''}`,
    })),
  ),
);

const continuousMedicationRows = computed(() => medicationRows.value.filter((row) => isContinuousDrug(row.source || row)));
const singleMedicationRows = computed(() => medicationRows.value.filter((row) => !isContinuousDrug(row.source || row)));

const printMedicationLabelRows = computed(() => [
  { key: 'plane', label: '麻醉平面' },
  ...Array.from({ length: 8 }, (_, index) => {
    const group = medicationGroups.value[index];
    const unitLabel = group?.units?.length ? `（${group.units.join('/')}）` : '';
    return {
      key: `med-${index + 1}`,
      label: `${index + 1}${group?.name ? ` ${group.name}` : ''}${unitLabel}`,
    };
  }),
]);
const printInfusionRowCount = 4;
const printInfusionLabelRows = computed(() =>
  Array.from({ length: printInfusionRowCount }, (_, index) => ({ key: `inf-${index}`, label: index === 0 ? '外周' : '' })),
);
const printTransfusionRowCount = 4;
const printTransfusionLabelRows = computed(() =>
  Array.from({ length: printTransfusionRowCount }, (_, index) => ({ key: `tr-${index}`, label: '' })),
);
const printMonitorRowCount = computed(() => Math.max(6, selectedMonitorItems.value.length || 6));
const printMonitorLabelRows = computed(() =>
  Array.from({ length: printMonitorRowCount.value }, (_, index) => ({
    key: `mon-${index}`,
    label: selectedMonitorItems.value[index] || '',
  })),
);
const infusionRows = computed(() => {
  const rows = (props.record.infusions || []).slice(0, 4);
  const rowCount = printInfusionRowCount;
  return rows.map((item, index) => ({
    ...item,
    source: item,
    index,
    rowCount,
    endTime: item.endTime || addMinutes(item.time, 75),
    label: `${item.name || '液体'} ${item.volume || ''}ml`,
    lineColor: index === 0 ? 'green' : 'blue',
  }));
});
const infusionBandStyle = computed(() => ({
  '--print-rows': printInfusionRowCount,
}));
const transfusionRows = computed(() =>
  (props.record.transfusions || []).map((item, index, sourceRows) => {
    const dictUnit = bloodProductOptions.find((o) => o.product === item.product)?.unit;
    const unit = dictUnit || item.unit || '';
    return {
      ...item,
      source: item,
      name: item.product || '输血',
      index,
      rowCount: printTransfusionRowCount,
      label: `${item.product || ''} ${item.volume || ''}${unit}`,
    };
  }),
);
const transfusionBandStyle = computed(() => ({
  '--print-rows': printTransfusionRowCount,
  minHeight: `${Math.max(66, transfusionRows.value.length * 22 + 12)}px`,
}));
const monitorCells = computed(() =>
  visibleVitals.value.flatMap((row) =>
    selectedMonitorItems.value
      .map((metric, index) => {
        const value = monitorValue(row, metric);
        if (value === '' || value === undefined || value === null) return null;
        return {
          key: `${row.id}-${metric}`,
          row,
          metric,
          value,
          time: row.time,
          top: `${6 + index * 22}px`,
          rowIndex: index,
          rowCount: printMonitorRowCount.value,
          abnormal: metric === 'SpO2' && Number(value) < 95,
        };
      })
      .filter(Boolean),
  ),
);
const monitorBandStyle = computed(() => ({
  '--monitor-rows': selectedMonitorItems.value.length,
  '--print-rows': printMonitorRowCount.value,
  minHeight: `${selectedMonitorItems.value.length * 22}px`,
}));
const statusEvents = computed(() => [
  { key: 'in', time: props.record.anesthesia.inRoomTime, symbol: '>', top: '6px' },
  { key: 'anes', time: props.record.anesthesia.anesthesiaStart, symbol: 'X', top: '6px' },
  { key: 'surgery-start', time: props.record.anesthesia.surgeryStart, symbol: '⊙', top: '6px' },
  { key: 'surgery-end', time: props.record.anesthesia.surgeryEnd, symbol: '0', top: '6px' },
  { key: 'out', time: props.record.anesthesia.outRoomTime, symbol: '▶', top: '6px' },
].filter((item) => item.time));
const outputMarkers = computed(() =>
  (props.record.outputs || []).flatMap((row) => [
    row.urine ? { key: `${row.id}-urine`, time: row.time, value: row.urine, top: '6px', printIndex: 0 } : null,
    row.bloodLoss ? { key: `${row.id}-blood`, time: row.time, value: row.bloodLoss, top: '28px', printIndex: 1 } : null,
    row.drainage ? { key: `${row.id}-drainage`, time: row.time, value: row.drainage, top: '50px', printIndex: 2 } : null,
    row.other ? { key: `${row.id}-other`, time: row.time, value: row.other, top: '72px', printIndex: 3 } : null,
  ].filter(Boolean)),
);
const highAlertMeds = computed(() => (props.record.medications || []).filter((med) => med.highAlert).slice(0, 4));
const keyEvents = computed(() => (props.record.events || []).filter((event) => ['插管', '穿刺', '手术开始', '抢救', '异常生命体征', '手术结束'].includes(event.type)).slice(0, 5));
const recoveryText = computed(() => props.record.recovery.conclusion || props.record.recovery.handoverNote || '术后镇痛方案待补充');
const surgeryTimeButtons = computed(() => [
  { label: '入手术室', value: props.record.anesthesia.inRoomTime },
  { label: '麻醉开始', value: props.record.anesthesia.anesthesiaStart },
  { label: '手术开始', value: props.record.anesthesia.surgeryStart },
  { label: '手术结束', value: props.record.anesthesia.surgeryEnd },
  { label: '麻醉结束', value: props.record.anesthesia.anesthesiaEnd },
  { label: '出手术室', value: props.record.anesthesia.outRoomTime },
]);
const anesthesiaDuration = computed(() => formatMinutes(props.record.anesthesia.anesthesiaStart, props.record.anesthesia.anesthesiaEnd) || '--');
const surgeryDuration = computed(() => formatMinutes(props.record.anesthesia.surgeryStart, props.record.anesthesia.surgeryEnd) || '--');
const fluidBalance = computed(() => calculateFluidBalance(props.record));
const printAsaLevel = computed(() => String(props.patient.asa || '').replace('级', '') || '-');
const printPreMedication = computed(() => props.patient.preMedication || '无');
const printFasting = computed(() => (props.patient.fasting || '').includes('禁食') ? '是' : (props.patient.fasting || '-'));
const printPosition = computed(() => props.record.anesthesia.position || props.patient.surgeryPosition || '平卧位');
const printIdentityNo = computed(() => props.patient.identityNo || props.patient.idCard || '610528199201168669');
const printFirstOutput = computed(() => (props.record.outputs || [])[0] || { urine: 0, bloodLoss: 0, drainage: 0, other: 0 });
const printMedicationSummary = computed(() => compactText((props.record.medications || []).slice(0, 6).map((med, index) => `${index + 1}. ${med.time || ''} ${med.name || ''} ${med.dose || ''}${med.unit || ''}`).join('；')));
const printSpecialMedSummary = computed(() => compactText(highAlertMeds.value.map((med) => `${med.name || ''}: ${med.dose || ''}${med.unit || ''}`).join('；')) || '无特殊说明');
const printKeyOperationSummary = computed(() => compactText(keyEvents.value.map((event, index) => `${index + 1}. ${event.content || event.type || ''}`).join('；')) || '无特殊关键操作');
const printAnalgesiaText = computed(() => compactText(props.record.recovery.conclusion || props.record.recovery.handoverNote || props.record.anesthesia.recoveryNote || '镇痛方式：PCEA'));
const printHandoverText = computed(() => {
  const anesthesia = props.record.anesthesia;
  return compactText([
    `${props.record.anesthesia.anesthesiologist || props.record.signatures.anesthesiologist || '-'} ${anesthesia.anesthesiaEnd || ''}`,
    `麻醉效果：${props.record.anesthesia.anesthesiaLevel || '-'}`,
    `麻醉开始:${anesthesia.anesthesiaStart || '-'}`,
    `手术开始:${anesthesia.surgeryStart || '-'}`,
    `手术结束:${anesthesia.surgeryEnd || '-'}`,
    `麻醉结束:${anesthesia.anesthesiaEnd || '-'}`,
    `离室时间:${props.record.recovery.leaveTime || anesthesia.outRoomTime || '-'}`,
    `病人送往:${props.record.recovery.destination || '-'}`,
  ].join('  '));
});

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function printRowLines(rowCount) {
  const count = Math.max(1, Number(rowCount) || 1);
  return Array.from({ length: count + 1 }, (_, index) => ({
    key: index,
    percent: (index / count) * 100,
    major: index === 0 || index === count || index % 4 === 0,
  }));
}

function addMinutes(time, minutes) {
  const start = clockToMinutes(time);
  if (start === null) return '';
  return minutesToClock(start + Number(minutes || 0));
}

function shiftObjectTime(object, field, minutes) {
  object[field] = addMinutes(object[field] || nowTime(), minutes);
}

function monitorMeta(item) {
  return monitorDefaults[item] || { key: item, default: '', unit: '' };
}

function monitorInputAttrs(item) {
  const meta = monitorMeta(item);
  if (meta.type !== 'number') return {};
  if (item === 'SpO2') return { min: 0, max: 100, step: 1 };
  if (item === '收缩压' || item === '舒张压') return { min: 0, max: 300, step: 1 };
  if (item === '脉搏') return { min: 0, max: 250, step: 1 };
  if (item === 'RESP') return { min: 0, max: 60, step: 1 };
  if (item === '体温' || item === 'T') return { min: 30, max: 45, step: 0.1 };
  if (item === 'ETCO2') return { min: 0, max: 80, step: 1 };
  if (item === 'BIS') return { min: 0, max: 100, step: 1 };
  if (item === '气道压力') return { min: 0, max: 80, step: 1 };
  if (item === 'TV') return { min: 0, max: 2000, step: 10 };
  return { step: meta.default % 1 ? 0.1 : 1 };
}

function updateMonitorValue(item, rawValue) {
  const meta = monitorMeta(item);
  if (meta.type === 'number') monitorValues[item] = rawValue === '' ? '' : Number(rawValue);
  else monitorValues[item] = rawValue;
}

function ensureMonitorDefault(item) {
  if (monitorValues[item] === undefined) monitorValues[item] = monitorMeta(item).default;
}

function toggleSeries(key) {
  if (!(key in seriesVisible)) return;
  seriesVisible[key] = !seriesVisible[key];
}

function labelRowStyle(index, rowCount) {
  const total = Math.max(1, Number(rowCount) || 1);
  if (index >= total - 1) return { borderBottomWidth: '0' };
  const boundary = index + 1;
  const major = boundary % 4 === 0 || boundary === total - 1;
  return { borderBottomColor: major ? '#111' : '#9ca3af' };
}

function isContinuousDrug(row) {
  const text = `${row?.route || ''} ${row?.unit || ''} ${row?.reason || ''}`;
  return Boolean(row?.endTime || /泵|持续|\/min|\/h|mg\/h|ug\/h|ug\/kg/.test(text));
}

function monitorValue(row, metric) {
  const key = monitorMeta(metric).key;
  return row[key] ?? row.monitorExtras?.[metric] ?? '';
}

function setMonitorValue(row, metric, value) {
  const key = monitorMeta(metric).key;
  if (key in row || key !== metric) row[key] = value;
  else {
    row.monitorExtras = row.monitorExtras || {};
    row.monitorExtras[metric] = value;
  }
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function timeLeft(time) {
  return `${timeToPercent(time, sheetStart.value, sheetEnd.value)}%`;
}

function clampPercent(value, padding = 0.8) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(padding, Math.min(100 - padding, numeric));
}

function monitorValueLeft(time) {
  return `${clampPercent(timeToPercent(time, sheetStart.value, sheetEnd.value))}%`;
}

function markerStyle(time, index, rowCount = 1, printIndex = index) {
  return {
    left: timeLeft(time),
    top: `${8 + index * 22}px`,
    '--row-index': printIndex,
    '--row-count': Math.max(1, rowCount),
  };
}

function outputMarkerStyle(row) {
  return {
    left: timeLeft(row.time),
    top: row.top,
    '--row-index': row.printIndex ?? 0,
    '--row-count': 5,
  };
}

function segmentStyle(row) {
  const left = timeToPercent(row.time, sheetStart.value, sheetEnd.value);
  const right = timeToPercent(row.endTime || addMinutes(row.time, 60), sheetStart.value, sheetEnd.value);
  return {
    left: `${left}%`,
    width: `${Math.max(3, right - left)}%`,
    top: `${10 + row.index * 22}px`,
    '--row-index': row.printIndex ?? row.index ?? 0,
    '--row-count': Math.max(1, row.rowCount || 1),
  };
}

function boardPercent(event) {
  const grid = event.currentTarget.closest('.band-grid') || event.currentTarget.parentElement;
  const rect = grid.getBoundingClientRect();
  return ((event.clientX - rect.left) / rect.width) * 100;
}

function percentTimeFromEvent(event) {
  const rangeStart = clockToMinutes(sheetStart.value);
  const rangeEnd = clockToMinutes(sheetEnd.value);
  if (rangeStart === null || rangeEnd === null) return nowTime();
  const raw = rangeStart + (Math.max(0, Math.min(100, boardPercent(event))) / 100) * (rangeEnd - rangeStart);
  return minutesToClock(Math.round(raw / LIVE_TIME_STEP_MINUTES) * LIVE_TIME_STEP_MINUTES);
}

function startSegmentDrag(event, row, mode) {
  if (props.readOnly || !row.source) return;
  closeLiveMenu();
  const grid = event.currentTarget.closest('.band-grid');
  const rect = grid.getBoundingClientRect();
  dragState.active = true;
  dragState.mode = mode;
  dragState.row = row;
  dragState.startX = event.clientX;
  dragState.originalStart = row.source.time || row.time;
  dragState.originalEnd = row.source.endTime || row.endTime;
  const onMove = (moveEvent) => {
    const deltaPercent = ((moveEvent.clientX - dragState.startX) / rect.width) * 100;
    const targetPercent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
    const result = dragTimeSegment(
      { start: dragState.originalStart, end: dragState.originalEnd },
      { mode: dragState.mode, deltaPercent, targetPercent, sheetStart: sheetStart.value, sheetEnd: sheetEnd.value, snapMinutes: LIVE_TIME_STEP_MINUTES, minDuration: LIVE_TIME_STEP_MINUTES },
    );
    dragState.row.source.time = result.start;
    dragState.row.source.endTime = result.end;
    saveBadge.x = moveEvent.clientX + 10;
    saveBadge.y = moveEvent.clientY - 22;
    saveBadge.time = `${result.start} ~ ${result.end}`;
    saveBadge.visible = true;
  };
  let unregisterDrag = () => {};
  const onUp = () => {
    unregisterDrag();
    dragState.active = false;
    window.setTimeout(() => {
      saveBadge.visible = false;
    }, 1200);
  };
  const cleanup = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  unregisterDrag = registerDragCleanup(cleanup);
}

function openLiveMenu(event, type, target = null) {
  closeLiveMenu();
  liveMenu.visible = true;
  liveMenu.x = Math.min(event.clientX, window.innerWidth - 230);
  liveMenu.y = Math.min(event.clientY, window.innerHeight - 330);
  liveMenu.type = type;
  liveMenu.target = target;
  monitorForm.time = percentTimeFromEvent(event);
}

function closeLiveMenu() {
  liveMenu.visible = false;
}

function openMonitorEdit(event, row) {
  openLiveMenu(event, 'monitor', row);
  monitorFormError.value = '';
  monitorForm.time = row.time || nowTime();
  monitorForm.batch = false;
  monitorForm.editingId = row.id;
  selectedMonitorItems.value.forEach((item) => {
    ensureMonitorDefault(item);
    const key = monitorMeta(item).key;
    const hasExplicit = key in row || (row.monitorExtras && item in row.monitorExtras);
    monitorValues[item] = hasExplicit ? monitorValue(row, item) : monitorMeta(item).default;
  });
  showMonitorDialog.value = true;
}

function openMonitorDialog(batch) {
  monitorForm.batch = batch;
  monitorForm.editingId = '';
  monitorFormError.value = '';
  if (!monitorForm.time) monitorForm.time = nowTime();
  monitorForm.endTime = addMinutes(monitorForm.time, 30);
  // 新建/批量新建：默认全部留空，需通过"自动获取监护数据"按钮模拟带入
  selectedMonitorItems.value.forEach((item) => { monitorValues[item] = ''; });
  showMonitorDialog.value = true;
  closeLiveMenu();
}

// 模拟自动获取监护数据：把字典默认值填入当前选中的监护项目，仅前端模拟，不连接真实设备
function fetchMonitorMock() {
  monitorFormError.value = '';
  selectedMonitorItems.value.forEach((item) => {
    const meta = monitorMeta(item);
    let value = meta.default;
    if (typeof value === 'number') {
      const jitter = Math.round((Math.random() - 0.5) * Math.max(2, value * 0.05));
      value = meta.type === 'number' ? Number((value + jitter).toFixed(meta.default % 1 ? 1 : 0)) : value;
    }
    monitorValues[item] = value;
  });
}

function saveMonitorRows() {
  monitorFormError.value = '';
  const start = clockToMinutes(monitorForm.time);
  const end = monitorForm.batch ? clockToMinutes(monitorForm.endTime) : start;
  if (start === null || end === null) {
    monitorFormError.value = '请填写有效的执行时间';
    return;
  }
  const missingRequired = selectedMonitorItems.value.filter((item) => {
    const meta = monitorMeta(item);
    if (!meta.required) return false;
    const value = monitorValues[item];
    return value === '' || value === undefined || value === null;
  });
  if (missingRequired.length) {
    monitorFormError.value = `${missingRequired.join('、')} 不能为空`;
    return;
  }
  if (!monitorForm.batch && monitorForm.editingId) {
    const existing = props.record.vitals.find((row) => row.id === monitorForm.editingId);
    if (existing) {
      existing.time = monitorForm.time;
      selectedMonitorItems.value.forEach((item) => setMonitorValue(existing, item, monitorValues[item]));
      showMonitorDialog.value = false;
      monitorForm.editingId = '';
      showSavedBadgeAtCenter(monitorForm.time);
      return;
    }
  }
  for (let minute = start; minute <= end; minute += monitorForm.batch ? Number(monitorForm.interval || 10) : 9999) {
    const row = { id: uniqueId('vital'), time: minutesToClock(minute), sbp: '', dbp: '', hr: '', rr: '', spo2: '', etco2: '', temp: '', bis: '', ecg: '', ventilation: '', source: '手工录入', remark: monitorForm.batch ? '右键批量录入' : '右键新增', abnormalHandled: {} };
    selectedMonitorItems.value.forEach((item) => setMonitorValue(row, item, monitorValues[item]));
    props.record.vitals.push(row);
    if (!monitorForm.batch) break;
  }
  monitorForm.editingId = '';
  showMonitorDialog.value = false;
  showSavedBadgeAtCenter(`${monitorForm.time}${monitorForm.batch ? ' 批量' : ''}`);
}

function openLineEditor() {
  const target = liveMenu.target;
  if (!target) return;
  if (liveMenu.type === 'infusion') return openInfusionEditor(target);
  if (liveMenu.type === 'transfusion') return openTransfusionEditor(target);
  lineForm.kind = '用药';
  lineForm.id = target.id;
  lineForm.name = target.name || '';
  lineForm.time = target.time || nowTime();
  lineForm.endTime = target.endTime || addMinutes(target.time, LIVE_TIME_STEP_MINUTES);
  lineForm.amount = target.dose || '';
  lineForm.unit = target.unit || '';
  lineForm.route = target.route || '';
  lineForm.continuous = isContinuousDrug(target);
  showLineEditor.value = true;
  closeLiveMenu();
}

function openInfusionEditor(row) {
  lineForm.kind = '输液';
  lineForm.id = row?.id || '';
  const matched = row?.name && infusionCatalog.some((item) => item.name === row.name);
  lineForm.name = matched ? row.name : (row?.name ? '__custom__' : infusionCatalog[0].name);
  lineForm.customName = matched ? '' : (row?.name || '');
  lineForm.time = row?.time || nowTime();
  lineForm.endTime = row?.endTime ?? '';
  lineForm.amount = row?.volume ?? infusionCatalog[0].volume;
  lineForm.unit = row?.spec || infusionCatalog[0].spec;
  lineForm.route = row?.executor || props.record.anesthesia.circulatingNurse || '';
  lineFormError.value = '';
  showLineEditor.value = true;
  closeLiveMenu();
}

function syncLineInfusionCatalog() {
  const item = infusionCatalog.find((entry) => entry.name === lineForm.name);
  if (item) {
    lineForm.unit = item.spec;
    lineForm.amount = item.volume;
  }
}

function openTransfusionEditor(row) {
  lineForm.kind = '输血';
  lineForm.id = row?.id || '';
  lineForm.name = row?.product || bloodProductOptions[2].product;
  lineForm.time = row?.time || nowTime();
  lineForm.endTime = row?.endTime || '';
  lineForm.customName = '';
  syncLineBloodProduct();
  lineForm.amount = row?.volume || bloodProductOptions.find((item) => item.product === lineForm.name)?.defaultVolume || 1;
  lineForm.unit = row?.bloodType || '';
  lineForm.volumeUnit = row?.unit || bloodProductOptions.find((item) => item.product === lineForm.name)?.unit || 'U';
  lineForm.bloodType = row?.bloodType || '';
  lineForm.bagNo = row?.bagNo || '';
  lineForm.anesthesiaConfirm = Boolean(row?.anesthesiaConfirm ?? row?.doubleCheck);
  lineForm.circulatingConfirm = Boolean(row?.circulatingConfirm ?? row?.doubleCheck);
  lineForm.doubleCheck = lineForm.anesthesiaConfirm && lineForm.circulatingConfirm;
  lineForm.reaction = row?.reaction || '无';
  lineFormError.value = '';
  showLineEditor.value = true;
  closeLiveMenu();
}

function syncLineBloodProduct() {
  const product = bloodProductOptions.find((item) => item.product === lineForm.name) || bloodProductOptions[0];
  lineForm.volumeUnit = product.unit;
  if (!lineForm.amount) lineForm.amount = product.defaultVolume;
}

function syncBloodProductRow(row) {
  const product = bloodProductOptions.find((item) => item.product === row.product) || bloodProductOptions[0];
  row.unit = product.unit;
  if (!row.volume) row.volume = product.defaultVolume;
}

function saveLineEditor() {
  lineFormError.value = '';
  const startMinutes = clockToMinutes(lineForm.time);
  if (startMinutes === null) {
    lineFormError.value = '请填写有效的开始时间';
    return;
  }
  if (lineForm.endTime) {
    const endMinutes = clockToMinutes(lineForm.endTime);
    if (endMinutes === null) {
      lineFormError.value = '请填写有效的结束时间';
      return;
    }
    if (endMinutes < startMinutes) {
      lineFormError.value = '结束时间不能早于开始时间';
      return;
    }
  } else if (lineForm.kind === '输血' || (lineForm.kind === '用药' && lineForm.continuous)) {
    lineFormError.value = '请填写结束时间';
    return;
  }
  if (lineForm.kind === '输血' && (!lineForm.anesthesiaConfirm || !lineForm.circulatingConfirm)) {
    lineFormError.value = '输血需麻醉医师与巡回护士双人核对';
    return;
  }
  if (lineForm.kind === '用药') {
    const row = props.record.medications.find((item) => item.id === lineForm.id);
    const payload = {
      ...normalizeMedicationEditorPayload({
        id: lineForm.id,
        name: lineForm.name,
        time: lineForm.time,
        endTime: lineForm.continuous ? lineForm.endTime : '',
        dose: lineForm.amount,
        unit: lineForm.unit,
        route: lineForm.route,
        continuous: lineForm.continuous,
      }),
      id: lineForm.id || uniqueId('med'),
      executor: row?.executor || props.record.anesthesia.anesthesiologist || '',
      checker: row?.checker || props.record.anesthesia.circulatingNurse || '',
      remark: row?.remark || '用药编辑器保存',
    };
    if (row) Object.assign(row, payload);
    else props.record.medications.push(payload);
  }
  if (lineForm.kind === '输液') {
    const finalName = lineForm.name === '__custom__'
      ? (lineForm.customName?.trim() || '自定义输液')
      : lineForm.name;
    const row = props.record.infusions.find((item) => item.id === lineForm.id);
    const payload = { id: lineForm.id || uniqueId('infusion'), time: lineForm.time, endTime: lineForm.endTime || '', name: finalName, spec: lineForm.unit, volume: Number(lineForm.amount) || 0, executor: lineForm.route };
    if (row) Object.assign(row, payload);
    else props.record.infusions.push(payload);
  }
  if (lineForm.kind === '输血') {
    const row = props.record.transfusions.find((item) => item.id === lineForm.id);
    const payload = {
      ...normalizeTransfusionEditorPayload({
        id: lineForm.id,
        time: lineForm.time,
        endTime: lineForm.endTime,
        product: lineForm.name,
        bagNo: lineForm.bagNo,
        bloodType: lineForm.bloodType || lineForm.unit,
        volume: lineForm.amount,
        unit: lineForm.volumeUnit,
        anesthesiaConfirm: lineForm.anesthesiaConfirm,
        circulatingConfirm: lineForm.circulatingConfirm,
        reaction: lineForm.reaction,
      }),
      id: lineForm.id || uniqueId('transfusion'),
    };
    if (row) Object.assign(row, payload);
    else props.record.transfusions.push(payload);
  }
  showLineEditor.value = false;
  showSavedBadgeAtCenter(lineForm.endTime || lineForm.time);
}

function continueLine() {
  const target = liveMenu.target;
  if (!target) return;
  target.endTime = addMinutes(target.endTime || target.time || nowTime(), 30);
  showSavedBadgeAtCenter(target.endTime);
  closeLiveMenu();
}

function deleteLine() {
  const target = liveMenu.target;
  if (!target) return;
  if (liveMenu.type === 'infusion') deleteRow(props.record.infusions, target.id);
  if (liveMenu.type === 'medication') deleteRow(props.record.medications, target.id);
  if (liveMenu.type === 'transfusion') deleteRow(props.record.transfusions, target.id);
  closeLiveMenu();
}

function addQuickDrug(name, continuous) {
  if (props.readOnly) return;
  // 改为弹出简易用药编辑器（lineForm 用药模式）：仅暴露关键字段，不展示药品字典维护界面
  const catalog = medicationCatalog.find((item) => item.name === name) || {};
  const time = monitorForm.time || nowTime();
  Object.assign(lineForm, {
    kind: '用药',
    id: '',
    name,
    customName: '',
    time,
    endTime: continuous ? addMinutes(time, 30) : '',
    amount: catalog.dose ?? '',
    unit: catalog.unit || (continuous ? 'ml/h' : 'mg'),
    route: catalog.route || (continuous ? '泵入' : '静脉注射'),
    continuous: Boolean(continuous),
  });
  lineFormError.value = '';
  showLineEditor.value = true;
  closeLiveMenu();
}

function addMenuInfusion(item) {
  if (props.readOnly) return;
  const time = nowTime();
  Object.assign(lineForm, {
    kind: '输液',
    id: '',
    name: item.name,
    customName: '',
    time,
    endTime: '',
    amount: item.volume,
    unit: item.spec,
    route: props.record.anesthesia.circulatingNurse || '',
  });
  lineFormError.value = '';
  showLineEditor.value = true;
  closeLiveMenu();
}

function addMenuTransfusion(item) {
  if (props.readOnly) return;
  const time = nowTime();
  Object.assign(lineForm, {
    kind: '输血',
    id: '',
    name: item.product,
    customName: '',
    time,
    endTime: addMinutes(time, 60),
    amount: item.defaultVolume,
    unit: '',
    volumeUnit: item.unit,
    bloodType: '',
    bagNo: '',
    anesthesiaConfirm: false,
    circulatingConfirm: false,
    doubleCheck: false,
    reaction: '无',
  });
  lineFormError.value = '';
  showLineEditor.value = true;
  closeLiveMenu();
}

function openOutputEditor(row) {
  Object.assign(outputForm, { id: row?.id || '', time: row?.time || monitorForm.time || nowTime(), urine: row?.urine || 0, bloodLoss: row?.bloodLoss || 0, drainage: row?.drainage || 0, other: row?.other || 0, remark: row?.remark || '' });
  showOutputDialog.value = true;
  closeLiveMenu();
}

function saveOutput() {
  const row = props.record.outputs.find((item) => item.id === outputForm.id);
  const payload = { id: outputForm.id || uniqueId('output'), time: outputForm.time, urine: Number(outputForm.urine) || 0, bloodLoss: Number(outputForm.bloodLoss) || 0, drainage: Number(outputForm.drainage) || 0, other: Number(outputForm.other) || 0, remark: outputForm.remark };
  if (row) Object.assign(row, payload);
  else props.record.outputs.push(payload);
  showOutputDialog.value = false;
  showSavedBadgeAtCenter(outputForm.time);
}

function openDataList(category) {
  activeDataList.value = category || 'vitals';
  showDataModal.value = true;
  closeLiveMenu();
}

// 从用药数据列表行触发的编辑入口：复用 lineForm 简易编辑器
function openLineEditFromList(row) {
  if (props.readOnly) return;
  const continuous = isContinuousDrug(row);
  Object.assign(lineForm, {
    kind: '用药',
    id: row.id,
    name: row.name || '',
    customName: '',
    time: row.time || nowTime(),
    endTime: continuous ? (row.endTime || addMinutes(row.time || nowTime(), 30)) : '',
    amount: row.dose ?? '',
    unit: row.unit || 'mg',
    route: row.route || '静脉注射',
    continuous,
  });
  lineFormError.value = '';
  showLineEditor.value = true;
}

function deleteRow(rows, id) {
  const index = rows.findIndex((row) => row.id === id);
  if (index >= 0) rows.splice(index, 1);
}

function toggleMonitorItem(item) {
  if (selectedMonitorItems.value.includes(item)) {
    selectedMonitorItems.value = selectedMonitorItems.value.filter((name) => name !== item);
  } else {
    selectedMonitorItems.value.push(item);
    ensureMonitorDefault(item);
  }
}

function showSavedBadgeAtCenter(time) {
  saveBadge.x = 310;
  saveBadge.y = 118;
  saveBadge.time = time;
  saveBadge.visible = true;
  window.setTimeout(() => {
    saveBadge.visible = false;
  }, 1300);
}

function chartPoints(field) {
  const spec = VITAL_FIELD_SPECS[field];
  if (!spec) return [];
  return visibleVitals.value
    .filter((row) => row.time && row[field] !== '' && row[field] !== undefined && row[field] !== null)
    .map((row) => {
      const x = timeToPercent(row.time, sheetStart.value, sheetEnd.value) * 10;
      const value = Number(row[field]);
      const y = Math.max(0, Math.min(300, spec.toY(value)));
      return { key: `${row.id}-${field}`, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), row, value, field };
    });
}

function chartLine(field) {
  return chartPoints(field).map((point) => `${point.x},${point.y}`).join(' ');
}

function trianglePath(x, y, up) {
  return up ? `M${x},${y - 6} L${x - 5},${y + 5} L${x + 5},${y + 5} Z` : `M${x},${y + 6} L${x - 5},${y - 5} L${x + 5},${y - 5} Z`;
}

function diamondPath(x, y) {
  return `M${x},${y - 5} L${x + 5},${y} L${x},${y + 5} L${x - 5},${y} Z`;
}

function starPath(x, y) {
  const r1 = 6, r2 = 2.5;
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = (-90 + i * 36) * Math.PI / 180;
    d += `${i === 0 ? 'M' : 'L'}${(x + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)} `;
  }
  return d + 'Z';
}

function startDragPoint(event, point) {
  if (props.readOnly) return;
  const spec = VITAL_FIELD_SPECS[point.field];
  if (!spec) return;
  const svg = chartSvgRef.value;
  if (!svg) return;
  event.preventDefault();
  try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (_) { /* ignore */ }
  const rect = svg.getBoundingClientRect();
  const apply = (clientY) => {
    const relY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const viewY = (relY / rect.height) * 300;
    let nextValue = spec.fromY(viewY);
    nextValue = Math.max(spec.min, Math.min(spec.max, nextValue));
    if (spec.decimals === 0) nextValue = Math.round(nextValue);
    else nextValue = Math.round(nextValue * 10) / 10;
    point.row[point.field] = nextValue;
    dragHint.visible = true;
    dragHint.y = viewY;
    dragHint.left = rect.left - svg.parentElement.getBoundingClientRect().left + 8;
    dragHint.top = relY - 18;
    dragHint.label = `${spec.label} ${nextValue}${spec.unit}`;
  };
  apply(event.clientY);
  const onMove = (e) => apply(e.clientY);
  let unregisterDrag = () => {};
  const onUp = () => {
    unregisterDrag();
    window.setTimeout(() => { dragHint.visible = false; }, 800);
  };
  const cleanup = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  unregisterDrag = registerDragCleanup(cleanup);
}
</script>
