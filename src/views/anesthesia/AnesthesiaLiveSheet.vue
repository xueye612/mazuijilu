<template>
  <section class="tab-panel live-sheet-panel" @click="closeLiveMenu">
    <div class="section-card live-sheet-toolbar">
      <div>
        <h2>实时麻醉记录单 <span class="input-badge">实时显示 + 持续录入</span></h2>
        <p>右键新增/批量录入，线段拖动后实时保存；数据列表可直接编辑和删除。</p>
      </div>
      <div class="row-actions">
        <button class="btn small primary" :disabled="readOnly" @click="$emit('add-vital')">新增当前时间生命体征</button>
        <button class="btn small" :disabled="readOnly" @click="$emit('import-device')">从设备占位带入</button>
        <button class="btn small" :disabled="readOnly" @click="$emit('add-medication')">新增用药</button>
        <button class="btn small" @click="$emit('quality-check')">质控检查</button>
      </div>
    </div>

    <div class="section-card live-paper-card">
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
        <div class="live-sheet-board" @contextmenu.prevent="openLiveMenu($event, 'grid')">
          <div class="sheet-time-ruler">
            <div class="sheet-left-head">项目</div>
            <div class="sheet-time-area">
              <span
                v-for="tick in timeScale.majorTicks"
                :key="tick.time"
                class="major-tick-label"
                :style="{ left: tick.percent + '%' }"
              >
                {{ tick.label }}
              </span>
              <span
                v-for="tick in timeScale.minorTicks"
                :key="tick.time"
                class="minor-tick"
                :class="{ major: tick.percent % 14.285 === 0 }"
                :style="{ left: tick.percent + '%' }"
              ></span>
            </div>
          </div>

          <div class="live-band band-medication">
            <div class="band-side vertical">麻醉用药</div>
            <div class="band-labels">
              <div>麻醉平面</div>
              <div v-for="row in medicationRows" :key="row.id">{{ row.name }}</div>
            </div>
            <div class="band-grid" @contextmenu.prevent.stop="openLiveMenu($event, 'drugGrid')">
              <div class="horizontal-lines"></div>
              <span
                v-for="row in singleMedicationRows"
                :key="row.id"
                class="drug-marker"
                :style="markerStyle(row.time, row.index)"
                @contextmenu.prevent.stop="openLiveMenu($event, 'medication', row.source)"
              >
                {{ row.label }}
              </span>
              <div
                v-for="row in continuousMedicationRows"
                :key="row.id"
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

          <div class="live-band band-infusion">
            <div class="band-side vertical">输液</div>
            <div class="band-labels">
              <div v-for="row in infusionRows" :key="row.id">{{ row.name }}</div>
            </div>
            <div class="band-grid" @contextmenu.prevent.stop="openLiveMenu($event, 'infusionGrid')">
              <div class="horizontal-lines"></div>
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

          <div class="live-band band-transfusion">
            <div class="band-side vertical">输血</div>
            <div class="band-labels">
              <div v-for="row in transfusionRows" :key="row.id">{{ row.name }}</div>
            </div>
            <div class="band-grid" @contextmenu.prevent.stop="openLiveMenu($event, 'transfusionGrid')">
              <div class="horizontal-lines"></div>
              <span
                v-for="row in transfusionRows"
                :key="row.id"
                class="blood-marker"
                :style="markerStyle(row.time, row.index)"
                @contextmenu.prevent.stop="openLiveMenu($event, 'transfusion', row.source)"
              >
                {{ row.label }}
              </span>
            </div>
          </div>

          <div class="live-band band-monitor">
            <div class="band-side vertical">监测</div>
            <div class="band-labels">
              <div v-for="item in selectedMonitorItems" :key="item">{{ item }}</div>
            </div>
            <div class="band-grid monitor-grid" @contextmenu.prevent.stop="openLiveMenu($event, 'monitor')">
              <span
                v-for="item in monitorCells"
                :key="item.key"
                class="monitor-text"
                :class="{ 'spo2-text': item.metric === 'SpO2', abnormal: item.abnormal }"
                :style="{ left: timeLeft(item.time), top: item.top }"
                @contextmenu.prevent.stop="openMonitorEdit($event, item.row)"
              >
                {{ item.value }}
              </span>
            </div>
          </div>

          <div class="live-vital-chart" @contextmenu.prevent.stop="openLiveMenu($event, 'chart')">
            <div class="chart-legend">
              <span class="legend-title">生命体征</span>
              <span><b class="symbol red">○</b> 收缩压</span>
              <span><b class="symbol red">△</b> 舒张压</span>
              <span><b class="symbol green">●</b> 脉搏</span>
              <span><b class="symbol gray">◇</b> 体温</span>
              <span><b class="symbol blue">3</b> 机械通气</span>
            </div>
            <div class="vital-scale">
              <span v-for="tick in vitalTicks" :key="tick.value" :style="{ bottom: tick.bottom + '%' }">{{ tick.value }}</span>
            </div>
            <div class="chart-grid-wrap">
              <svg class="live-chart-svg" viewBox="0 0 1000 310" preserveAspectRatio="none">
                <polyline :points="chartLine('sbp')" class="live-line pressure" />
                <polyline :points="chartLine('dbp')" class="live-line pressure thin" />
                <polyline :points="chartLine('hr')" class="live-line pulse" />
                <g>
                  <circle
                    v-for="point in chartPoints('hr')"
                    :key="point.key"
                    :cx="point.x"
                    :cy="point.y"
                    r="4"
                    class="pulse-point"
                  />
                </g>
                <g>
                  <path
                    v-for="point in chartPoints('sbp')"
                    :key="point.key"
                    :d="trianglePath(point.x, point.y, true)"
                    class="pressure-point"
                  />
                  <path
                    v-for="point in chartPoints('dbp')"
                    :key="point.key"
                    :d="trianglePath(point.x, point.y, false)"
                    class="pressure-point"
                  />
                </g>
              </svg>
            </div>
          </div>

          <div class="live-band band-status">
            <div class="band-side">手术状态</div>
            <div class="status-labels">
              <div>尿量（ml）</div>
              <div>出血量（ml）</div>
              <div>其他（ml）</div>
              <div>特殊用药序号</div>
              <div>手术关键操作</div>
            </div>
            <div class="band-grid status-grid" @contextmenu.prevent.stop="openLiveMenu($event, 'balance')">
              <span v-for="event in statusEvents" :key="event.key" class="status-marker" :style="{ left: timeLeft(event.time), top: event.top }">
                {{ event.symbol }}
              </span>
              <span v-for="row in outputMarkers" :key="row.key" class="output-marker" :style="{ left: timeLeft(row.time), top: row.top }">
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
    </div>

    <div
      v-if="liveMenu.visible"
      class="live-context-menu"
      :style="{ left: liveMenu.x + 'px', top: liveMenu.y + 'px' }"
      @click.stop
    >
      <button v-if="hasLineTarget" @click="openLineEditor">编辑数据</button>
      <button v-if="hasLineTarget" @click="continueLine">继续用药/输液</button>
      <button v-if="hasLineTarget" class="danger-menu" @click="deleteLine">删除当前项</button>
      <button v-if="showDrugMenus" @click="openMedicationManager()">麻醉用药维护</button>
      <button v-if="showFluidMenus" @click="openInfusionEditor(null)">新增输液</button>
      <button v-if="showFluidMenus" @click="openTransfusionEditor(null)">新增输血</button>
      <div v-if="showDrugMenus" class="menu-item has-sub">
        <span>静脉麻醉药</span>
        <div class="submenu">
          <button @click="addMenuDrug('右美托咪定', true)">右美托咪定 持续用药</button>
          <button @click="addMenuDrug('右美托咪定', false)">右美托咪定 单次用药</button>
          <button @click="addMenuDrug('丙泊酚', true)">丙泊酚 持续用药</button>
          <button @click="addMenuDrug('瑞芬太尼', true)">瑞芬太尼 持续用药</button>
        </div>
      </div>
      <div v-if="showDrugMenus" class="menu-item has-sub">
        <span>局麻用药</span>
        <div class="submenu">
          <div v-for="drug in localAnestheticDrugs" :key="drug" class="menu-item has-sub">
            <span>{{ drug }}</span>
            <div class="submenu">
              <button @click="addMenuDrug(drug, true)">持续用药</button>
              <button @click="addMenuDrug(drug, false)">单次用药</button>
            </div>
          </div>
        </div>
      </div>
      <div class="menu-item has-sub">
        <span>最近用药</span>
        <div class="submenu">
          <button v-for="drug in recentDrugNames" :key="drug" @click="addMenuDrug(drug, false)">{{ drug }}</button>
        </div>
      </div>
      <button v-if="isGridMenu" @click="openMonitorDialog(false)">添加数据</button>
      <button v-if="isGridMenu" @click="openMonitorDialog(true)">批量添加数据</button>
      <button v-if="isGridMenu" @click="openDataList('vitals')">体征数据列表</button>
      <button v-if="isGridMenu" @click="showObserveSetting = true">监测项目</button>
      <button v-if="isGridMenu || liveMenu.type === 'balance'" @click="openOutputEditor(null)">添加出入量</button>
      <button v-if="isGridMenu || liveMenu.type === 'balance'" @click="openDataList('outputs')">出入量列表</button>
      <button v-if="liveMenu.type === 'medication'" @click="openDataList('medications')">用药列表</button>
      <button v-if="liveMenu.type === 'infusion' || liveMenu.type === 'infusionGrid'" @click="openDataList('infusions')">输液列表</button>
      <button v-if="liveMenu.type === 'transfusion' || liveMenu.type === 'transfusionGrid'" @click="openDataList('transfusions')">输血列表</button>
    </div>

    <div v-if="showLineEditor" class="live-modal-backdrop">
      <div class="live-modal small">
        <header>
          <strong>{{ lineForm.kind }}数据</strong>
          <button @click="showLineEditor = false">×</button>
        </header>
        <div class="live-modal-body">
          <label v-if="lineForm.kind !== '输血'">名称<input v-model="lineForm.name" /></label>
          <label v-else>
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
            结束时间
            <span class="time-stepper">
              <button @click="shiftObjectTime(lineForm, 'endTime', -LIVE_TIME_STEP_MINUTES)">-</button>
              <input v-model="lineForm.endTime" type="time" step="60" @keydown.up.prevent="shiftObjectTime(lineForm, 'endTime', LIVE_TIME_STEP_MINUTES)" @keydown.down.prevent="shiftObjectTime(lineForm, 'endTime', -LIVE_TIME_STEP_MINUTES)" />
              <button @click="shiftObjectTime(lineForm, 'endTime', LIVE_TIME_STEP_MINUTES)">+</button>
            </span>
          </label>
          <label>剂量/容量<input v-model="lineForm.amount" type="number" /></label>
          <label v-if="lineForm.kind === '用药'">
            单位
            <select v-model="lineForm.unit">
              <option v-for="unit in medicationUnitOptions" :key="unit">{{ unit }}</option>
            </select>
          </label>
          <label v-if="lineForm.kind === '输血'">
            血品单位
            <select v-model="lineForm.volumeUnit">
              <option v-for="unit in transfusionUnits" :key="unit">{{ unit }}</option>
            </select>
          </label>
          <label v-if="lineForm.kind === '输血'">血型<input v-model="lineForm.bloodType" /></label>
          <label v-if="lineForm.kind === '用药'">途径<input v-model="lineForm.route" /></label>
          <label v-if="lineForm.kind === '输血'">血袋号<input v-model="lineForm.bagNo" /></label>
          <label v-if="lineForm.kind === '输血'">双人核对<input v-model="lineForm.doubleCheck" type="checkbox" /></label>
          <label v-if="lineForm.kind === '输血'">反应情况<input v-model="lineForm.reaction" /></label>
        </div>
        <footer>
          <button class="btn small" @click="showLineEditor = false">关闭</button>
          <button class="btn small primary" @click="saveLineEditor">保存</button>
        </footer>
      </div>
    </div>

    <div v-if="showMedicationManager" class="live-modal-backdrop">
      <div class="live-modal medication-manager-modal">
        <header>
          <strong>麻醉用药</strong>
          <button @click="showMedicationManager = false">×</button>
        </header>
        <div class="medication-manager-body">
          <aside class="drug-catalog-pane">
            <label class="drug-search">拼音字头<input v-model="medicationSearch" /></label>
            <table class="drug-catalog-table">
              <thead><tr><th>药品名称</th><th>单位</th><th>规格</th></tr></thead>
              <tbody>
                <tr v-for="drug in filteredMedicationCatalog" :key="drug.name" @click="selectMedicationCatalog(drug)">
                  <td>{{ drug.name }}</td>
                  <td>{{ drug.unit }}</td>
                  <td>{{ drug.route }}</td>
                </tr>
              </tbody>
            </table>
            <div class="drug-editor-panel">
              <label><input v-model="medicationForm.mode" type="radio" value="single" /> 单次</label>
              <label><input v-model="medicationForm.mode" type="radio" value="continuous" /> 持续</label>
              <label>药品名称<input v-model="medicationForm.name" /></label>
              <label>
                注入方式
                <select v-model="medicationForm.route">
                  <option v-for="route in medicationRoutes" :key="route">{{ route }}</option>
                </select>
              </label>
              <label>
                剂量
                <span class="dose-pair">
                  <input v-model="medicationForm.dose" type="number" />
                  <select v-model="medicationForm.unit">
                    <option v-for="unit in medicationUnitOptions" :key="unit">{{ unit }}</option>
                  </select>
                </span>
              </label>
              <label>数量<input v-model.number="medicationForm.quantity" type="number" /></label>
              <label>日期<input v-model="medicationForm.date" type="date" /></label>
              <label>
                开始时间
                <span class="time-stepper">
                  <button @click="shiftObjectTime(medicationForm, 'time', -LIVE_TIME_STEP_MINUTES)">-</button>
                  <input v-model="medicationForm.time" type="time" step="60" @keydown.up.prevent="shiftObjectTime(medicationForm, 'time', LIVE_TIME_STEP_MINUTES)" @keydown.down.prevent="shiftObjectTime(medicationForm, 'time', -LIVE_TIME_STEP_MINUTES)" />
                  <button @click="shiftObjectTime(medicationForm, 'time', LIVE_TIME_STEP_MINUTES)">+</button>
                </span>
              </label>
              <label v-if="medicationForm.mode === 'continuous'">
                结束时间
                <span class="time-stepper">
                  <button @click="shiftObjectTime(medicationForm, 'endTime', -LIVE_TIME_STEP_MINUTES)">-</button>
                  <input v-model="medicationForm.endTime" type="time" step="60" @keydown.up.prevent="shiftObjectTime(medicationForm, 'endTime', LIVE_TIME_STEP_MINUTES)" @keydown.down.prevent="shiftObjectTime(medicationForm, 'endTime', -LIVE_TIME_STEP_MINUTES)" />
                  <button @click="shiftObjectTime(medicationForm, 'endTime', LIVE_TIME_STEP_MINUTES)">+</button>
                </span>
              </label>
              <button class="btn small primary" @click="saveMedicationForm">{{ medicationForm.id ? '保存修改' : '添加' }}</button>
            </div>
          </aside>

          <section class="used-drug-pane">
            <h4>麻醉用药</h4>
            <div v-for="row in record.medications" :key="row.id" class="used-drug-card">
              <div>
                <strong>{{ row.name }}</strong>
                <span>{{ row.dose }}{{ row.unit }}</span>
                <small>{{ row.route }} · {{ row.endTime ? `${row.time} ~ ${row.endTime}` : row.time }}</small>
              </div>
              <button class="btn small" @click="editMedicationFromManager(row)">编辑</button>
            </div>
          </section>
        </div>
        <footer>
          <button class="btn small" @click="showMedicationManager = false">关闭</button>
        </footer>
      </div>
    </div>

    <div v-if="showMonitorDialog" class="live-modal-backdrop">
      <div class="live-modal">
        <header>
          <strong>新建监护项目结果</strong>
          <button @click="showMonitorDialog = false">×</button>
        </header>
        <div class="live-modal-body monitor-form">
          <h4>{{ monitorForm.batch ? '批量监护项目结果' : '监护项目结果' }}</h4>
          <label>执行日期<input v-model="monitorForm.date" type="date" /></label>
          <label>
            执行时间
            <span class="time-stepper">
              <button @click="shiftObjectTime(monitorForm, 'time', -LIVE_TIME_STEP_MINUTES)">-</button>
              <input v-model="monitorForm.time" type="time" step="60" @keydown.up.prevent="shiftObjectTime(monitorForm, 'time', LIVE_TIME_STEP_MINUTES)" @keydown.down.prevent="shiftObjectTime(monitorForm, 'time', -LIVE_TIME_STEP_MINUTES)" />
              <button @click="shiftObjectTime(monitorForm, 'time', LIVE_TIME_STEP_MINUTES)">+</button>
            </span>
          </label>
          <label v-if="monitorForm.batch">
            结束时间
            <span class="time-stepper">
              <button @click="shiftObjectTime(monitorForm, 'endTime', -LIVE_TIME_STEP_MINUTES)">-</button>
              <input v-model="monitorForm.endTime" type="time" step="60" @keydown.up.prevent="shiftObjectTime(monitorForm, 'endTime', LIVE_TIME_STEP_MINUTES)" @keydown.down.prevent="shiftObjectTime(monitorForm, 'endTime', -LIVE_TIME_STEP_MINUTES)" />
              <button @click="shiftObjectTime(monitorForm, 'endTime', LIVE_TIME_STEP_MINUTES)">+</button>
            </span>
          </label>
          <label v-if="monitorForm.batch">记录间隔<input v-model.number="monitorForm.interval" type="number" min="1" /> 分钟</label>
          <h4>新建监护项目结果</h4>
          <label v-for="item in selectedMonitorItems" :key="item">
            {{ item }}
            <select v-if="monitorMeta(item).options" v-model="monitorValues[item]">
              <option v-for="option in monitorMeta(item).options" :key="option">{{ option }}</option>
            </select>
            <input v-else v-model="monitorValues[item]" :type="monitorMeta(item).type || 'text'" />
            <span>{{ monitorMeta(item).unit }}</span>
          </label>
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
              <tr v-for="row in record.vitals" :key="row.id">
                <td><input v-model="row.time" type="time" /></td>
                <td v-for="item in selectedMonitorItems" :key="item"><input :value="monitorValue(row, item)" @input="setMonitorValue(row, item, $event.target.value)" /></td>
                <td><input v-model="row.source" /></td>
                <td><button @click="deleteRow(record.vitals, row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>

          <table v-if="activeDataList === 'medications'" class="live-data-table">
            <thead><tr><th>时间</th><th>结束</th><th>药名</th><th>剂量</th><th>单位</th><th>途径</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.medications" :key="row.id">
                <td><input v-model="row.time" type="time" /></td>
                <td><input v-model="row.endTime" type="time" /></td>
                <td><input v-model="row.name" /></td>
                <td><input v-model="row.dose" /></td>
                <td><input v-model="row.unit" /></td>
                <td><input v-model="row.route" /></td>
                <td><button @click="deleteRow(record.medications, row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>

          <table v-if="activeDataList === 'infusions'" class="live-data-table">
            <thead><tr><th>时间</th><th>结束</th><th>液体</th><th>规格</th><th>量 ml</th><th>执行人</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.infusions" :key="row.id">
                <td><input v-model="row.time" type="time" /></td>
                <td><input v-model="row.endTime" type="time" /></td>
                <td><input v-model="row.name" /></td>
                <td><input v-model="row.spec" /></td>
                <td><input v-model.number="row.volume" type="number" /></td>
                <td><input v-model="row.executor" /></td>
                <td><button @click="deleteRow(record.infusions, row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>

          <table v-if="activeDataList === 'transfusions'" class="live-data-table">
            <thead><tr><th>时间</th><th>结束</th><th>血品</th><th>血袋号</th><th>血型</th><th>数量</th><th>单位</th><th>核对</th><th>反应</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.transfusions" :key="row.id">
                <td><input v-model="row.time" type="time" /></td>
                <td><input v-model="row.endTime" type="time" /></td>
                <td>
                  <select v-model="row.product" @change="syncBloodProductRow(row)">
                    <option v-for="item in bloodProductOptions" :key="item.product" :value="item.product">{{ item.product }}</option>
                  </select>
                </td>
                <td><input v-model="row.bagNo" /></td>
                <td><input v-model="row.bloodType" /></td>
                <td><input v-model.number="row.volume" type="number" /></td>
                <td>
                  <select v-model="row.unit">
                    <option v-for="unit in transfusionUnits" :key="unit">{{ unit }}</option>
                  </select>
                </td>
                <td><input v-model="row.doubleCheck" type="checkbox" /></td>
                <td><input v-model="row.reaction" /></td>
                <td><button @click="deleteRow(record.transfusions, row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>

          <table v-if="activeDataList === 'outputs'" class="live-data-table">
            <thead><tr><th>时间</th><th>尿量</th><th>出血</th><th>引流</th><th>其他</th><th>备注</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.outputs" :key="row.id">
                <td><input v-model="row.time" type="time" /></td>
                <td><input v-model.number="row.urine" type="number" /></td>
                <td><input v-model.number="row.bloodLoss" type="number" /></td>
                <td><input v-model.number="row.drainage" type="number" /></td>
                <td><input v-model.number="row.other" type="number" /></td>
                <td><input v-model="row.remark" /></td>
                <td><button @click="deleteRow(record.outputs, row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import {
  buildLiveTimeScale,
  bloodProductOptions,
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

defineEmits(['add-vital', 'import-device', 'add-medication', 'quality-check']);

const liveMenu = reactive({ visible: false, x: 0, y: 0, type: 'grid', target: null });
const saveBadge = reactive({ visible: false, x: 0, y: 0, time: '' });
const dragState = reactive({ active: false, mode: '', row: null, startX: 0, originalStart: '', originalEnd: '' });
const showLineEditor = ref(false);
const showMedicationManager = ref(false);
const showMonitorDialog = ref(false);
const showOutputDialog = ref(false);
const showObserveSetting = ref(false);
const showDataModal = ref(false);
const activeDataList = ref('vitals');
const selectedMonitorItems = ref(['SpO2', 'ECG', '有创舒张压']);
const monitorValues = reactive({});
const lineForm = reactive({ kind: '用药', id: '', name: '', time: '', endTime: '', amount: '', unit: '', route: '', bagNo: '', bloodType: '', volumeUnit: '', doubleCheck: false, reaction: '无', continuous: false });
const outputForm = reactive({ id: '', time: '', urine: 0, bloodLoss: 0, drainage: 0, other: 0, remark: '' });
const monitorForm = reactive({ batch: false, date: '2026-05-18', time: '11:06', endTime: '11:36', interval: 10 });
const medicationSearch = ref('');
const medicationForm = reactive({ id: '', mode: 'single', name: '', route: '静脉注射', dose: '', unit: 'mg', quantity: 0, date: '2026-05-18', time: '11:06', endTime: '11:07' });

const dataTabs = [
  { key: 'vitals', label: '体征' },
  { key: 'medications', label: '用药' },
  { key: 'infusions', label: '输液' },
  { key: 'transfusions', label: '输血' },
  { key: 'outputs', label: '出入量' },
];
const monitorOptions = ['ETCO2', 'ECG', 'NIBP', 'ART', 'RESP', 'BIS', 'T', '气道压力', 'MAC', '呼吸动力', 'SpO2', '有创舒张压', 'TV'];
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
const medicationRoutes = ['静脉注射', '泵入', '吸入', '硬膜外', '蛛网膜下腔', '局部浸润'];
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
  ECG: { key: 'ecg', default: '房颤', unit: 'bpm', options: ['窦性', '房颤', '室早', '起搏'] },
  有创舒张压: { key: 'invasiveDbp', default: 64, unit: 'mmHg', type: 'number' },
  ETCO2: { key: 'etco2', default: 38, unit: 'mmHg', type: 'number' },
  NIBP: { key: 'nibp', default: '120/75', unit: 'mmHg' },
  ART: { key: 'art', default: '118/70', unit: 'mmHg' },
  RESP: { key: 'rr', default: 12, unit: '次/分', type: 'number' },
  BIS: { key: 'bis', default: 48, unit: '', type: 'number' },
  T: { key: 'temp', default: 36.5, unit: '℃', type: 'number' },
  气道压力: { key: 'airwayPressure', default: 18, unit: 'cmH2O', type: 'number' },
  MAC: { key: 'mac', default: 0.9, unit: '', type: 'number' },
  呼吸动力: { key: 'respPower', default: '正常', unit: '' },
  TV: { key: 'tv', default: 450, unit: 'ml', type: 'number' },
};

selectedMonitorItems.value.forEach(ensureMonitorDefault);

const recentDrugNames = computed(() => [...new Set((props.record.medications || []).map((item) => item.name).filter(Boolean))].slice(0, 6));
const hasLineTarget = computed(() => ['medication', 'infusion', 'transfusion'].includes(liveMenu.type) && liveMenu.target);
const isGridMenu = computed(() => ['grid', 'monitor', 'chart'].includes(liveMenu.type));
const showDrugMenus = computed(() => ['grid', 'drugGrid', 'medication'].includes(liveMenu.type));
const showFluidMenus = computed(() => ['grid', 'infusionGrid', 'transfusionGrid', 'infusion', 'transfusion'].includes(liveMenu.type));
const unselectedMonitorItems = computed(() => monitorOptions.filter((item) => !selectedMonitorItems.value.includes(item)));
const dataListTitle = computed(() => dataTabs.find((tab) => tab.key === activeDataList.value)?.label + '数据列表');
const filteredMedicationCatalog = computed(() => {
  const keyword = medicationSearch.value.trim().toLowerCase();
  if (!keyword) return medicationCatalog;
  return medicationCatalog.filter((item) => item.name.toLowerCase().includes(keyword));
});

const sheetStart = computed(() => {
  const candidates = [props.record.anesthesia.inRoomTime, props.record.anesthesia.recordStart, props.record.startedAt, props.record.vitals?.[0]?.time, '11:00'].filter(Boolean);
  const first = candidates.map((time) => clockToMinutes(time)).filter((value) => value !== null).sort((a, b) => a - b)[0];
  return minutesToClock(Math.floor((first ?? 660) / 30) * 30);
});
const sheetEnd = computed(() => {
  const start = clockToMinutes(sheetStart.value) ?? 660;
  const candidates = [props.record.anesthesia.outRoomTime, props.record.anesthesia.anesthesiaEnd, props.record.anesthesia.surgeryEnd, props.record.vitals?.at(-1)?.time]
    .filter(Boolean)
    .map((time) => clockToMinutes(time))
    .filter((value) => value !== null);
  return minutesToClock(Math.ceil(Math.max(start + 210, ...candidates) / 30) * 30);
});
const timeScale = computed(() => buildLiveTimeScale(sheetStart.value, sheetEnd.value, 5, 30));
const visibleVitals = computed(() => props.record.vitals || []);
const vitalTicks = computed(() => [14, 16, 18, 20, 22, 24, 26, 28, 30].map((value) => ({ value, bottom: ((value - 14) / 16) * 100 })));
const medicationRows = computed(() =>
  (props.record.medications || []).slice(0, 7).map((med, index) => ({
    ...med,
    source: med,
    index,
    endTime: med.endTime || addMinutes(med.time, isContinuousDrug(med) ? 45 : 0),
    label: `${med.dose || ''}${med.unit || ''}`,
  })),
);
const continuousMedicationRows = computed(() => medicationRows.value.filter((row) => isContinuousDrug(row)));
const singleMedicationRows = computed(() => medicationRows.value.filter((row) => !isContinuousDrug(row)));
const infusionRows = computed(() =>
  (props.record.infusions || []).slice(0, 4).map((item, index) => ({
    ...item,
    source: item,
    index,
    endTime: item.endTime || addMinutes(item.time, 75),
    label: `${item.name || '液体'} ${item.volume || ''}ml`,
    lineColor: index === 0 ? 'green' : 'blue',
  })),
);
const transfusionRows = computed(() =>
  (props.record.transfusions || []).slice(0, 3).map((item, index) => ({
    ...item,
    source: item,
    name: item.product || '输血',
    index,
    label: `${item.product || ''} ${item.volume || ''}ml`,
  })),
);
const monitorCells = computed(() =>
  visibleVitals.value.flatMap((row) =>
    selectedMonitorItems.value
      .map((metric, index) => {
        const value = monitorValue(row, metric);
        if (value === '' || value === undefined || value === null) return null;
        return { key: `${row.id}-${metric}`, row, metric, value, time: row.time, top: `${7 + index * 22}px`, abnormal: metric === 'SpO2' && Number(value) < 95 };
      })
      .filter(Boolean),
  ),
);
const statusEvents = computed(() => [
  { key: 'in', time: props.record.anesthesia.inRoomTime, symbol: '>', top: '6px' },
  { key: 'anes', time: props.record.anesthesia.anesthesiaStart, symbol: 'X', top: '6px' },
  { key: 'surgery-start', time: props.record.anesthesia.surgeryStart, symbol: '⊙', top: '6px' },
  { key: 'surgery-end', time: props.record.anesthesia.surgeryEnd, symbol: '0', top: '6px' },
  { key: 'out', time: props.record.anesthesia.outRoomTime, symbol: '▶', top: '6px' },
].filter((item) => item.time));
const outputMarkers = computed(() =>
  (props.record.outputs || []).flatMap((row) => [
    row.urine ? { key: `${row.id}-urine`, time: row.time, value: row.urine, top: '29px' } : null,
    row.bloodLoss ? { key: `${row.id}-blood`, time: row.time, value: row.bloodLoss, top: '51px' } : null,
    row.other ? { key: `${row.id}-other`, time: row.time, value: row.other, top: '73px' } : null,
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

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
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

function ensureMonitorDefault(item) {
  if (monitorValues[item] === undefined) monitorValues[item] = monitorMeta(item).default;
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

function markerStyle(time, index) {
  return { left: timeLeft(time), top: `${8 + index * 22}px` };
}

function segmentStyle(row) {
  const left = timeToPercent(row.time, sheetStart.value, sheetEnd.value);
  const right = timeToPercent(row.endTime || addMinutes(row.time, 60), sheetStart.value, sheetEnd.value);
  return { left: `${left}%`, width: `${Math.max(3, right - left)}%`, top: `${10 + row.index * 22}px` };
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
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.setTimeout(() => {
      saveBadge.visible = false;
    }, 1200);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
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
  monitorForm.time = row.time || nowTime();
  selectedMonitorItems.value.forEach((item) => {
    ensureMonitorDefault(item);
    monitorValues[item] = monitorValue(row, item) || monitorMeta(item).default;
  });
  showMonitorDialog.value = true;
}

function openMonitorDialog(batch) {
  monitorForm.batch = batch;
  if (!monitorForm.time) monitorForm.time = nowTime();
  monitorForm.endTime = addMinutes(monitorForm.time, 30);
  selectedMonitorItems.value.forEach(ensureMonitorDefault);
  showMonitorDialog.value = true;
  closeLiveMenu();
}

function saveMonitorRows() {
  const start = clockToMinutes(monitorForm.time);
  const end = monitorForm.batch ? clockToMinutes(monitorForm.endTime) : start;
  if (start === null || end === null) return;
  for (let minute = start; minute <= end; minute += monitorForm.batch ? Number(monitorForm.interval || 10) : 9999) {
    const row = { id: uniqueId('vital'), time: minutesToClock(minute), sbp: '', dbp: '', hr: '', rr: '', spo2: '', etco2: '', temp: '', bis: '', source: '手工录入', remark: '右键新增监测', abnormalHandled: {} };
    selectedMonitorItems.value.forEach((item) => setMonitorValue(row, item, monitorValues[item]));
    props.record.vitals.push(row);
    if (!monitorForm.batch) break;
  }
  showMonitorDialog.value = false;
  showSavedBadgeAtCenter(`${monitorForm.time}${monitorForm.batch ? ' 批量' : ''}`);
}

function openLineEditor() {
  const target = liveMenu.target;
  if (!target) return;
  if (liveMenu.type === 'infusion') return openInfusionEditor(target);
  if (liveMenu.type === 'transfusion') return openTransfusionEditor(target);
  if (liveMenu.type === 'medication') return openMedicationManager(target);
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

function selectMedicationCatalog(drug) {
  medicationForm.name = drug.name;
  medicationForm.unit = drug.unit || medicationForm.unit;
  medicationForm.dose = drug.dose ?? medicationForm.dose;
  medicationForm.route = drug.route || medicationForm.route;
}

function openMedicationManager(row = null, preset = {}) {
  const name = preset.name || row?.name || medicationCatalog[0].name;
  const catalog = medicationCatalog.find((item) => item.name === name) || {};
  const continuous = Boolean(preset.continuous ?? (row ? isContinuousDrug(row) : false));
  const time = row?.time || monitorForm.time || nowTime();
  Object.assign(medicationForm, {
    id: row?.id || '',
    mode: continuous ? 'continuous' : 'single',
    name,
    route: row?.route || preset.route || catalog.route || (continuous ? '泵入' : '静脉注射'),
    dose: row?.dose ?? preset.dose ?? catalog.dose ?? (continuous ? 2 : 1),
    unit: row?.unit || preset.unit || catalog.unit || (continuous ? 'ml/h' : 'ml'),
    quantity: row?.quantity ?? 0,
    date: preset.date || '2026-05-18',
    time,
    endTime: row?.endTime || (continuous ? addMinutes(time, LIVE_TIME_STEP_MINUTES) : ''),
  });
  showMedicationManager.value = true;
  closeLiveMenu();
}

function editMedicationFromManager(row) {
  openMedicationManager(row);
}

function saveMedicationForm() {
  const payload = normalizeMedicationEditorPayload({
    id: medicationForm.id,
    name: medicationForm.name,
    time: medicationForm.time,
    endTime: medicationForm.mode === 'continuous' ? medicationForm.endTime : '',
    dose: medicationForm.dose,
    unit: medicationForm.unit,
    route: medicationForm.route,
    quantity: medicationForm.quantity,
    continuous: medicationForm.mode === 'continuous',
  });
  const row = props.record.medications.find((item) => item.id === payload.id);
  const saved = {
    ...payload,
    id: payload.id || uniqueId('med'),
    executor: row?.executor || props.record.anesthesia.anesthesiologist || '',
    checker: row?.checker || props.record.anesthesia.circulatingNurse || '',
    remark: row?.remark || '麻醉用药维护',
  };
  if (row) Object.assign(row, saved);
  else props.record.medications.push(saved);
  medicationForm.id = saved.id;
  showSavedBadgeAtCenter(saved.endTime || saved.time);
}

function openInfusionEditor(row) {
  lineForm.kind = '输液';
  lineForm.id = row?.id || '';
  lineForm.name = row?.name || '乳酸钠林格液';
  lineForm.time = row?.time || monitorForm.time || nowTime();
  lineForm.endTime = row?.endTime || addMinutes(lineForm.time, 60);
  lineForm.amount = row?.volume || 500;
  lineForm.unit = row?.spec || '500ml';
  lineForm.route = row?.executor || props.record.anesthesia.circulatingNurse || '';
  showLineEditor.value = true;
  closeLiveMenu();
}

function openTransfusionEditor(row) {
  lineForm.kind = '输血';
  lineForm.id = row?.id || '';
  lineForm.name = row?.product || bloodProductOptions[2].product;
  lineForm.time = row?.time || monitorForm.time || nowTime();
  lineForm.endTime = row?.endTime || '';
  syncLineBloodProduct();
  lineForm.amount = row?.volume || bloodProductOptions.find((item) => item.product === lineForm.name)?.defaultVolume || 1;
  lineForm.unit = row?.bloodType || '';
  lineForm.volumeUnit = row?.unit || bloodProductOptions.find((item) => item.product === lineForm.name)?.unit || 'U';
  lineForm.bloodType = row?.bloodType || '';
  lineForm.bagNo = row?.bagNo || '';
  lineForm.doubleCheck = Boolean(row?.doubleCheck);
  lineForm.reaction = row?.reaction || '无';
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
    const row = props.record.infusions.find((item) => item.id === lineForm.id);
    const payload = { id: lineForm.id || uniqueId('infusion'), time: lineForm.time, endTime: lineForm.endTime, name: lineForm.name, spec: lineForm.unit, volume: Number(lineForm.amount) || 0, executor: lineForm.route };
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
        doubleCheck: lineForm.doubleCheck,
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

function addMenuDrug(name, continuous) {
  openMedicationManager(null, { name, continuous });
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
  return visibleVitals.value
    .filter((row) => row.time && row[field] !== '' && row[field] !== undefined && row[field] !== null)
    .map((row) => {
      const x = timeToPercent(row.time, sheetStart.value, sheetEnd.value) * 10;
      const value = Number(row[field]);
      const scaled = field === 'spo2' ? value / 4 : value / 5;
      const y = 300 - Math.max(0, Math.min(300, ((scaled - 14) / 16) * 300));
      return { key: `${row.id}-${field}`, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });
}

function chartLine(field) {
  return chartPoints(field).map((point) => `${point.x},${point.y}`).join(' ');
}

function trianglePath(x, y, up) {
  return up ? `M${x},${y - 6} L${x - 5},${y + 5} L${x + 5},${y + 5} Z` : `M${x},${y + 6} L${x - 5},${y - 5} L${x + 5},${y - 5} Z`;
}
</script>
