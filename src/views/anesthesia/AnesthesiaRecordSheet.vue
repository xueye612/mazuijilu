<template>
  <div class="anesthesia-shell" @click="hideFieldMenu">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">麻</div>
        <div>
          <h1>麻醉记录单</h1>
          <p>麻醉工作台 + 单患者记录单</p>
        </div>
      </div>

      <div class="top-context">
        <span class="status-pill" :class="statusClass(currentRecord.status)">{{ currentRecord.status }}</span>
        <strong>{{ currentPatient.name }}</strong>
        <span>{{ currentPatient.inpatientNo }}</span>
        <span>{{ currentPatient.room }}</span>
        <span class="mode-inline">当前区域：{{ activeTabLabel }} / {{ activeTabMeta.mode }}</span>
      </div>

      <div class="top-actions">
        <button class="btn primary" :disabled="isReadOnly" @click="startRecord">启动记录</button>
        <button class="btn collect" :disabled="isReadOnly" @click="startDeviceCollect">启动设备采集</button>
        <button v-if="!currentRecord.rescue.active" class="btn danger" :disabled="isReadOnly" @click="enterRescueMode">抢救模式</button>
        <button v-else class="btn danger ghost" @click="openRescueExit">结束抢救模式</button>
        <button class="btn" @click="saveDraft">保存草稿</button>
        <button class="btn" @click="runQualityCheck">完整性检查</button>
        <button class="btn" @click="goPreview">生成预览</button>
        <button class="btn" @click="printPreview">打印预览</button>
        <button class="btn success" @click="submitSignature">提交签名</button>
        <button class="btn warning" @click="openUnlock">解锁修改申请</button>
      </div>
    </header>

    <div class="workspace">
      <aside class="patient-panel">
        <div class="panel-title">
          <span>手术间患者</span>
          <small>{{ filteredPatients.length }} 人</small>
        </div>
        <div class="filter-tabs">
          <button
            v-for="filter in patientFilters"
            :key="filter"
            :class="{ active: activeFilter === filter }"
            @click="activeFilter = filter"
          >
            {{ filter }}
          </button>
        </div>

        <section v-for="(group, room) in groupedPatients" :key="room" class="room-group">
          <div class="room-heading">
            <strong>{{ room }}</strong>
            <span>{{ group.length }} 人</span>
          </div>
          <article
            v-for="patient in group"
            :key="patient.id"
            class="patient-card"
            :class="{ active: patient.id === selectedPatientId, rescue: patient.record.rescue.active }"
            @click="selectPatient(patient.id)"
          >
            <div class="patient-card-head">
              <strong>{{ patient.name }}</strong>
              <span>{{ patient.gender }} · {{ patient.age }}岁</span>
            </div>
            <p>{{ patient.inpatientNo }}</p>
            <p class="surgery-name">{{ patient.actualSurgery }}</p>
            <div class="card-tags">
              <span>{{ patient.record.anesthesia.method }}</span>
              <span :class="statusClass(patient.record.status)">{{ patient.record.status }}</span>
              <span :class="collectClass(patient.record.device.collectStatus)">{{ patient.record.device.collectStatus }}</span>
            </div>
            <div class="mini-flags">
              <span v-if="patient.record.device.collectStatus === '采集中'">采集中</span>
              <span v-if="patient.record.rescue.active" class="danger-text">抢救中</span>
            </div>
          </article>
        </section>
      </aside>

      <main class="record-main">
        <nav class="record-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>

        <section class="mode-strip">
          <div>
            <strong>当前录入模式说明</strong>
            <span>{{ activeTabLabel }}：{{ activeTabMeta.mode }}</span>
          </div>
          <div>
            <span>记录频率：{{ currentRecord.vitalFrequency }}分钟/次</span>
            <span>数据来源：{{ currentRecord.dataSource }}</span>
            <span>下一次建议记录：{{ nextVitalTime }}</span>
          </div>
        </section>

        <AnesthesiaLiveSheet
          v-if="activeTab === 'live'"
          :patient="currentPatient"
          :record="currentRecord"
          :read-only="isReadOnly"
          @add-vital="addVitalRow()"
          @import-device="importDeviceVitals"
          @add-medication="addMedication()"
          @quality-check="runQualityCheck"
        />

        <section v-if="activeTab === 'patient'" class="tab-panel">
          <div class="section-card patient-overview">
            <div class="avatar">患</div>
            <div class="overview-main">
              <div class="card-title-row">
                <h2>患者信息 <span class="input-badge">一次性输入</span></h2>
                <div class="risk-tags">
                  <span class="room-tag">{{ currentPatient.room }}</span>
                  <span v-if="isHighAsa" class="risk-tag warn">ASA III 及以上</span>
                  <span v-if="hasAllergy" class="risk-tag danger">过敏史</span>
                  <span v-for="tag in currentPatient.riskTags" :key="tag" class="risk-tag">{{ tag }}</span>
                </div>
              </div>
              <p>{{ currentPatient.department }} · {{ currentPatient.ward }} · {{ currentPatient.bedNo }}</p>
              <p>{{ currentPatient.diagnosis }}</p>
            </div>
            <div class="auto-card">
              <span>自动计算</span>
              <strong>BMI {{ patientBMI || '-' }}</strong>
              <small>由身高体重实时计算</small>
            </div>
          </div>

          <div class="section-card">
            <div class="card-title-row">
              <h2>基本身份与术前信息 <span class="input-badge">一次性输入</span></h2>
              <span class="readonly-tip" v-if="isReadOnly">已签名只读，需解锁后修改</span>
            </div>
            <div class="form-grid four">
              <label>姓名<input v-model="currentPatient.name" :disabled="isReadOnly" @contextmenu.prevent.stop="openFieldMenu($event, currentPatient, 'name')" /></label>
              <label>性别<input v-model="currentPatient.gender" :disabled="isReadOnly" /></label>
              <label>年龄<input v-model.number="currentPatient.age" type="number" :disabled="isReadOnly" /></label>
              <label>住院号<input v-model="currentPatient.inpatientNo" :disabled="isReadOnly" /></label>
              <label>身高 cm<input v-model.number="currentPatient.height" type="number" :disabled="isReadOnly" /></label>
              <label>体重 kg<input v-model.number="currentPatient.weight" type="number" :disabled="isReadOnly" /></label>
              <label>BMI<input :value="patientBMI" disabled /></label>
              <label>科室<input v-model="currentPatient.department" :disabled="isReadOnly" /></label>
              <label>病区<input v-model="currentPatient.ward" :disabled="isReadOnly" /></label>
              <label>床号<input v-model="currentPatient.bedNo" :disabled="isReadOnly" /></label>
              <label>手术日期<input v-model="currentPatient.surgeryDate" type="date" :disabled="isReadOnly" /></label>
              <label>手术间<input v-model="currentPatient.room" :disabled="isReadOnly" /></label>
              <label>ASA 分级
                <select v-model="currentPatient.asa" :disabled="isReadOnly">
                  <option v-for="level in dictionaries.asaLevels" :key="level">{{ level }}</option>
                </select>
              </label>
              <label>过敏史<input v-model="currentPatient.allergy" :disabled="isReadOnly" /></label>
              <label class="wide">诊断<input v-model="currentPatient.diagnosis" :disabled="isReadOnly" /></label>
              <label class="wide">拟行手术<input v-model="currentPatient.plannedSurgery" :disabled="isReadOnly" /></label>
              <label class="wide">实施手术<input v-model="currentPatient.actualSurgery" :disabled="isReadOnly" /></label>
              <label class="wide">术前禁食情况<input v-model="currentPatient.fasting" :disabled="isReadOnly" /></label>
              <label class="wide full">术前特殊情况<textarea v-model="currentPatient.preSpecial" :disabled="isReadOnly"></textarea></label>
            </div>
          </div>

          <div class="section-card">
            <div class="card-title-row">
              <h2>术前生命体征 <span class="input-badge">一次性输入</span></h2>
            </div>
            <div class="form-grid five">
              <label>体温<input v-model.number="currentPatient.preVitals.temp" type="number" step="0.1" :disabled="isReadOnly" /></label>
              <label>脉搏<input v-model.number="currentPatient.preVitals.pulse" type="number" :disabled="isReadOnly" /></label>
              <label>呼吸<input v-model.number="currentPatient.preVitals.respiration" type="number" :disabled="isReadOnly" /></label>
              <label>血压<input v-model="currentPatient.preVitals.bp" :disabled="isReadOnly" /></label>
              <label>SpO2<input v-model.number="currentPatient.preVitals.spo2" type="number" :disabled="isReadOnly" /></label>
            </div>
          </div>
        </section>

        <section v-if="activeTab === 'anesthesia'" class="tab-panel">
          <div class="section-card">
            <div class="card-title-row">
              <h2>麻醉基本信息 <span class="input-badge">一次性输入 + 事件触发</span></h2>
              <span class="auto-note">自动校验关键时间顺序</span>
            </div>
            <div class="form-grid four">
              <label>麻醉方式
                <select v-model="currentRecord.anesthesia.method" :disabled="isReadOnly">
                  <option v-for="method in dictionaries.anesthesiaMethods" :key="method">{{ method }}</option>
                </select>
              </label>
              <label>麻醉医师<input v-model="currentRecord.anesthesia.anesthesiologist" :disabled="isReadOnly" /></label>
              <label>手术医师<input v-model="currentRecord.anesthesia.surgeon" :disabled="isReadOnly" /></label>
              <label>巡回护士<input v-model="currentRecord.anesthesia.circulatingNurse" :disabled="isReadOnly" /></label>
              <label>器械护士<input v-model="currentRecord.anesthesia.scrubNurse" :disabled="isReadOnly" /></label>
              <label>麻醉分级<input v-model="currentRecord.anesthesia.anesthesiaLevel" :disabled="isReadOnly" /></label>
            </div>
          </div>

          <div class="section-card">
            <div class="card-title-row">
              <h2>关键时间节点 <span class="input-badge">一次性输入 + 事件触发</span></h2>
              <button class="link-btn" @click="fillCommonTimeline" :disabled="isReadOnly">填入常用顺序</button>
            </div>
            <div class="timeline-grid">
              <label v-for="field in timeFields" :key="field.key" :class="{ invalid: timelineIssueFields.includes(field.key) }">
                <span>{{ field.label }}</span>
                <div class="time-input">
                  <input v-model="currentRecord.anesthesia[field.key]" type="time" :disabled="isReadOnly" @change="handleTimeChange(field)" />
                  <button :disabled="isReadOnly" @click="setTimeNow(field)">现在</button>
                </div>
              </label>
            </div>
            <div v-if="timelineIssues.length" class="alert-list">
              <p v-for="issue in timelineIssues" :key="issue.field">{{ issue.message }}</p>
            </div>
            <ol class="medical-timeline">
              <li v-for="field in filledTimeline" :key="field.key">
                <time>{{ currentRecord.anesthesia[field.key] }}</time>
                <span>{{ field.label }}</span>
              </li>
            </ol>
          </div>

          <div class="two-col">
            <div class="section-card">
              <h2>麻醉过程记录 <span class="input-badge">一次性输入</span></h2>
              <label class="stacked">诱导情况<textarea v-model="currentRecord.anesthesia.inductionNote" :disabled="isReadOnly"></textarea></label>
              <label class="stacked">维持情况<textarea v-model="currentRecord.anesthesia.maintenanceNote" :disabled="isReadOnly"></textarea></label>
              <label class="stacked">苏醒情况<textarea v-model="currentRecord.anesthesia.recoveryNote" :disabled="isReadOnly"></textarea></label>
              <label class="stacked">特殊事件说明<textarea v-model="currentRecord.anesthesia.specialEventNote" :disabled="isReadOnly"></textarea></label>
            </div>
            <DeviceStatusCard
              :device="currentRecord.device"
              :read-only="isReadOnly"
              @start="startDeviceCollect"
              @pause="pauseDeviceCollect"
              @resume="resumeDeviceCollect"
              @manual="manualDeviceRecord"
              @logs="showDeviceLogs = true"
            />
          </div>
        </section>

        <section v-if="activeTab === 'vitals'" class="tab-panel">
          <div class="section-card vital-command">
            <div>
              <h2>生命体征记录 <span class="input-badge">持续输入 + 设备采集占位</span></h2>
              <p>最近记录：{{ latestVitalTime || '-' }}；下一次建议：{{ nextVitalTime }}；未处理异常：{{ unhandledAbnormalCount }} 项</p>
            </div>
            <div class="frequency-control">
              <span>记录频率</span>
              <button
                v-for="freq in dictionaries.frequencyOptions"
                :key="freq"
                :class="{ active: currentRecord.vitalFrequency === freq }"
                :disabled="isReadOnly || currentRecord.rescue.active"
                @click="currentRecord.vitalFrequency = freq"
              >
                {{ freq }}分钟
              </button>
              <span :class="collectClass(currentRecord.device.collectStatus)">{{ currentRecord.device.collectStatus }}</span>
            </div>
          </div>

          <div class="section-card">
            <div class="card-title-row">
              <h2>时间点生成与快捷追加 <span class="input-badge">持续输入</span></h2>
            </div>
            <div class="control-row">
              <label>起始时间<input v-model="generationForm.start" type="time" /></label>
              <label>结束时间<input v-model="generationForm.end" type="time" /></label>
              <label>间隔
                <select v-model.number="generationForm.interval">
                  <option v-for="freq in dictionaries.frequencyOptions" :key="freq" :value="freq">{{ freq }}分钟</option>
                </select>
              </label>
              <button class="btn primary small" :disabled="isReadOnly" @click="generateVitalTimePoints">一键生成时间点</button>
              <button class="btn small" :disabled="isReadOnly" @click="clearEmptyVitals">清空空白时间点</button>
              <button class="btn small" :disabled="isReadOnly" @click="addVitalRow()">新增当前时间记录</button>
              <button class="btn small" :disabled="isReadOnly" @click="duplicateLastVital">复制上一条</button>
              <button class="btn small" :disabled="isReadOnly" @click="importDeviceVitals">从设备采集占位带入</button>
              <button class="btn small danger-lite" :disabled="isReadOnly" @click="markLastVitalAbnormal">标记异常</button>
            </div>
          </div>

          <div class="section-card table-card">
            <div class="card-title-row">
              <h2>生命体征录入表 <span class="input-badge">持续输入</span></h2>
              <span class="auto-note">异常单元格自动高亮</span>
            </div>
            <div class="table-scroll">
              <table class="editable-table">
                <thead>
                  <tr>
                    <th>时间</th><th>SBP</th><th>DBP</th><th>HR</th><th>RR</th><th>SpO2</th><th>EtCO2</th><th>TEMP</th><th>BIS</th><th>来源</th><th>备注</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in currentRecord.vitals" :key="row.id">
                    <td><input v-model="row.time" type="time" :disabled="isReadOnly" /></td>
                    <td :class="{ abnormal: isAbnormal(row, 'sbp') }"><input v-model.number="row.sbp" type="number" :disabled="isReadOnly" /></td>
                    <td :class="{ abnormal: isAbnormal(row, 'dbp') }"><input v-model.number="row.dbp" type="number" :disabled="isReadOnly" /></td>
                    <td :class="{ abnormal: isAbnormal(row, 'hr') }"><input v-model.number="row.hr" type="number" :disabled="isReadOnly" /></td>
                    <td :class="{ abnormal: isAbnormal(row, 'rr') }"><input v-model.number="row.rr" type="number" :disabled="isReadOnly" /></td>
                    <td :class="{ abnormal: isAbnormal(row, 'spo2') }"><input v-model.number="row.spo2" type="number" :disabled="isReadOnly" /></td>
                    <td :class="{ abnormal: isAbnormal(row, 'etco2') }"><input v-model.number="row.etco2" type="number" :disabled="isReadOnly" /></td>
                    <td :class="{ abnormal: isAbnormal(row, 'temp') }"><input v-model.number="row.temp" type="number" step="0.1" :disabled="isReadOnly" /></td>
                    <td :class="{ abnormal: isAbnormal(row, 'bis') }"><input v-model.number="row.bis" type="number" :disabled="isReadOnly" /></td>
                    <td>
                      <select v-model="row.source" :disabled="isReadOnly">
                        <option>手工录入</option>
                        <option>设备采集占位</option>
                        <option>手工修正</option>
                      </select>
                    </td>
                    <td><input v-model="row.remark" :disabled="isReadOnly" /></td>
                    <td class="table-actions">
                      <button :disabled="isReadOnly" @click="copyVitalRow(row)">复制</button>
                      <button :disabled="isReadOnly" @click="removeVitalRow(row.id)">删除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="two-col trend-layout">
            <div class="section-card">
              <div class="card-title-row">
                <h2>趋势图 <span class="input-badge">自动生成</span></h2>
                <span class="auto-note">SVG 简易曲线，无 ECharts 依赖</span>
              </div>
              <svg class="trend-chart" viewBox="0 0 720 240" role="img" aria-label="生命体征趋势">
                <g class="grid-lines">
                  <line v-for="y in [40, 80, 120, 160, 200]" :key="y" x1="40" :y1="y" x2="700" :y2="y" />
                </g>
                <polyline :points="seriesPoints('sbp', 40, 180)" class="line sbp" />
                <polyline :points="seriesPoints('dbp', 30, 120)" class="line dbp" />
                <polyline :points="seriesPoints('hr', 40, 150)" class="line hr" />
                <polyline :points="seriesPoints('spo2', 80, 100)" class="line spo2" />
                <polyline :points="seriesPoints('etco2', 20, 60)" class="line etco2" />
                <g class="x-labels">
                  <text v-for="(row, index) in chartRows" :key="row.id" :x="chartX(index)" y="230">{{ row.time }}</text>
                </g>
              </svg>
              <div class="legend">
                <span class="sbp">SBP</span><span class="dbp">DBP</span><span class="hr">HR</span><span class="spo2">SpO2</span><span class="etco2">EtCO2</span>
              </div>
            </div>
            <div class="section-card abnormal-panel">
              <h2>异常指标闭环 <span class="input-badge">自动计算 + 事件触发</span></h2>
              <div v-if="abnormalVitals.length === 0" class="empty-state">暂无异常生命体征</div>
              <article v-for="item in abnormalVitals" :key="item.id" class="abnormal-item">
                <div>
                  <strong>{{ item.time }} {{ item.metric }}={{ item.value }}</strong>
                  <p>{{ item.suggestion }}</p>
                </div>
                <textarea v-model="abnormalMeasureDraft[item.id]" :disabled="isReadOnly" placeholder="填写处理措施"></textarea>
                <div class="row-actions">
                  <button :disabled="isReadOnly" @click="saveAbnormalMeasure(item)">保存处置</button>
                  <button :disabled="isReadOnly" @click="generateAbnormalEvent(item)">生成事件</button>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section v-if="activeTab === 'medication'" class="tab-panel">
          <div class="stats-row">
            <div class="stat-card"><span>输液量</span><strong>{{ fluidBalance.infusionTotal }} ml</strong><small>自动计算</small></div>
            <div class="stat-card"><span>输血量</span><strong>{{ fluidBalance.transfusionTotal }} ml</strong><small>自动计算</small></div>
            <div class="stat-card"><span>总入量</span><strong>{{ fluidBalance.inputTotal }} ml</strong><small>自动计算</small></div>
            <div class="stat-card"><span>总出量</span><strong>{{ fluidBalance.outputTotal }} ml</strong><small>自动计算</small></div>
            <div class="stat-card"><span>液体平衡</span><strong>{{ fluidBalance.fluidBalance }} ml</strong><small>自动计算</small></div>
            <div class="stat-card"><span>出血量</span><strong>{{ fluidBalance.bloodLossTotal }} ml</strong><small>自动计算</small></div>
          </div>

          <div class="section-card table-card">
            <div class="card-title-row">
              <h2>术中用药记录 <span class="input-badge">持续输入 + 事件触发</span></h2>
              <button class="btn small primary" :disabled="isReadOnly" @click="addMedication()">新增药品</button>
            </div>
            <div class="quick-picks">
              <button v-for="name in dictionaries.medicationNames" :key="name" :disabled="isReadOnly" @click="quickAddMedication(name)">{{ name }}</button>
            </div>
            <EditableMedicationTable
              :rows="currentRecord.medications"
              :read-only="isReadOnly"
              @copy="copyMedication"
              @remove="removeMedication"
              @event="generateMedicationEvent"
            />
          </div>

          <div class="two-col">
            <div class="section-card table-card">
              <div class="card-title-row">
                <h2>输液输血记录 <span class="input-badge">持续输入</span></h2>
                <div class="row-actions">
                  <button class="btn small" :disabled="isReadOnly" @click="addInfusion">新增输液</button>
                  <button class="btn small" :disabled="isReadOnly" @click="addTransfusion">新增输血</button>
                </div>
              </div>
              <h3>输液</h3>
              <table class="editable-table compact">
                <thead><tr><th>时间</th><th>液体名称</th><th>规格</th><th>输入量 ml</th><th>执行人</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="row in currentRecord.infusions" :key="row.id">
                    <td><input v-model="row.time" type="time" :disabled="isReadOnly" /></td>
                    <td><input v-model="row.name" :disabled="isReadOnly" /></td>
                    <td><input v-model="row.spec" :disabled="isReadOnly" /></td>
                    <td><input v-model.number="row.volume" type="number" :disabled="isReadOnly" /></td>
                    <td><input v-model="row.executor" :disabled="isReadOnly" /></td>
                    <td><button :disabled="isReadOnly" @click="removeRow(currentRecord.infusions, row.id)">删除</button></td>
                  </tr>
                </tbody>
              </table>
              <h3>输血</h3>
              <table class="editable-table compact">
                <thead><tr><th>时间</th><th>血液品种</th><th>血袋号</th><th>血型</th><th>输入量</th><th>双人核对</th><th>反应</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="row in currentRecord.transfusions" :key="row.id">
                    <td><input v-model="row.time" type="time" :disabled="isReadOnly" /></td>
                    <td><input v-model="row.product" :disabled="isReadOnly" /></td>
                    <td><input v-model="row.bagNo" :disabled="isReadOnly" /></td>
                    <td><input v-model="row.bloodType" :disabled="isReadOnly" /></td>
                    <td><input v-model.number="row.volume" type="number" :disabled="isReadOnly" /></td>
                    <td><input v-model="row.doubleCheck" type="checkbox" :disabled="isReadOnly" /></td>
                    <td><input v-model="row.reaction" :disabled="isReadOnly" /></td>
                    <td><button :disabled="isReadOnly" @click="removeRow(currentRecord.transfusions, row.id)">删除</button></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="section-card table-card">
              <div class="card-title-row">
                <h2>出量记录 <span class="input-badge">持续输入 + 自动计算</span></h2>
                <button class="btn small" :disabled="isReadOnly" @click="addOutput">新增出量</button>
              </div>
              <table class="editable-table compact">
                <thead><tr><th>时间</th><th>尿量</th><th>出血量</th><th>引流量</th><th>其他</th><th>备注</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="row in currentRecord.outputs" :key="row.id">
                    <td><input v-model="row.time" type="time" :disabled="isReadOnly" /></td>
                    <td><input v-model.number="row.urine" type="number" :disabled="isReadOnly" /></td>
                    <td><input v-model.number="row.bloodLoss" type="number" :disabled="isReadOnly" /></td>
                    <td><input v-model.number="row.drainage" type="number" :disabled="isReadOnly" /></td>
                    <td><input v-model.number="row.other" type="number" :disabled="isReadOnly" /></td>
                    <td><input v-model="row.remark" :disabled="isReadOnly" /></td>
                    <td><button :disabled="isReadOnly" @click="removeRow(currentRecord.outputs, row.id)">删除</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section v-if="activeTab === 'airway'" class="tab-panel">
          <div class="two-col">
            <div class="section-card">
              <div class="card-title-row">
                <h2>气道管理记录 <span class="input-badge">一次性输入 + 事件触发</span></h2>
                <span v-if="currentRecord.airway.difficultAirway" class="risk-tag danger">困难气道</span>
              </div>
              <div class="form-grid two">
                <label>气道方式
                  <select v-model="currentRecord.airway.airwayMethod" :disabled="isReadOnly">
                    <option v-for="method in dictionaries.airwayMethods" :key="method">{{ method }}</option>
                  </select>
                </label>
                <label>插管时间
                  <div class="time-input">
                    <input v-model="currentRecord.airway.intubationTime" type="time" :disabled="isReadOnly" @change="handleAirwayIntubation" />
                    <button :disabled="isReadOnly" @click="setAirwayTime('intubationTime')">现在</button>
                  </div>
                </label>
                <label>插管方式
                  <select v-model="currentRecord.airway.intubationMethod" :disabled="isReadOnly">
                    <option v-for="method in dictionaries.intubationMethods" :key="method">{{ method }}</option>
                  </select>
                </label>
                <label>插管次数<input v-model.number="currentRecord.airway.intubationAttempts" type="number" :disabled="isReadOnly" /></label>
                <label>插管型号<input v-model="currentRecord.airway.tubeModel" :disabled="isReadOnly" /></label>
                <label>插管深度 cm<input v-model="currentRecord.airway.tubeDepth" :disabled="isReadOnly" /></label>
                <label>固定位置<input v-model="currentRecord.airway.fixationPosition" :disabled="isReadOnly" /></label>
                <label>Cormack-Lehane 分级<input v-model="currentRecord.airway.cormack" :disabled="isReadOnly" /></label>
                <label class="checkbox-line"><input v-model="currentRecord.airway.difficultAirway" type="checkbox" :disabled="isReadOnly" /> 是否困难气道</label>
                <label>拔管时间
                  <div class="time-input">
                    <input v-model="currentRecord.airway.extubationTime" type="time" :disabled="isReadOnly" @change="syncExtubationTime" />
                    <button :disabled="isReadOnly" @click="setAirwayTime('extubationTime')">现在</button>
                  </div>
                </label>
                <label>拔管情况
                  <select v-model="currentRecord.airway.extubationStatus" :disabled="isReadOnly">
                    <option v-for="status in dictionaries.extubationStatuses" :key="status">{{ status }}</option>
                  </select>
                </label>
                <label>拔管后 SpO2<input v-model.number="currentRecord.airway.postExtubationSpo2" type="number" :disabled="isReadOnly" /></label>
                <label class="full">困难气道处理措施<textarea v-model="currentRecord.airway.difficultMeasure" :disabled="isReadOnly"></textarea></label>
                <label class="full">气道备注<textarea v-model="currentRecord.airway.airwayNote" :disabled="isReadOnly"></textarea></label>
              </div>
              <p v-if="currentRecord.airway.difficultAirway && !currentRecord.airway.difficultMeasure" class="form-warning">困难气道必须填写处理措施。</p>
              <p v-if="currentRecord.airway.extubationStatus === '带管入 PACU/ICU'" class="form-warning">带管离室时，离室去向需选择 PACU 或 ICU，并填写交接备注。</p>
            </div>

            <div class="section-card event-card">
              <div class="card-title-row">
                <h2>麻醉事件时间线 <span class="input-badge">事件触发 + 手工补录</span></h2>
                <button class="btn small primary" :disabled="isReadOnly" @click="addEventRow">手工补录</button>
              </div>
              <div class="event-list">
                <article v-for="event in orderedEvents" :key="event.id" :class="['event-item', event.type.includes('抢救') || event.type.includes('异常') ? 'critical' : '']">
                  <div class="event-time">{{ event.time }}</div>
                  <div class="event-body">
                    <strong>{{ event.type }} · {{ event.content }}</strong>
                    <p>{{ event.measure || '未填写处理措施' }}</p>
                    <small>{{ event.source }} · {{ event.recorder }}</small>
                  </div>
                </article>
              </div>
            </div>
          </div>

          <div class="section-card table-card">
            <div class="card-title-row">
              <h2>事件明细维护 <span class="input-badge">持续输入</span></h2>
              <button class="btn small" :disabled="isReadOnly" @click="sortEvents">按时间排序</button>
            </div>
            <table class="editable-table">
              <thead><tr><th>时间</th><th>类型</th><th>内容</th><th>处理措施</th><th>记录人</th><th>来源</th><th>备注</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="event in currentRecord.events" :key="event.id">
                  <td><input v-model="event.time" type="time" :disabled="isReadOnly" /></td>
                  <td><select v-model="event.type" :disabled="isReadOnly"><option v-for="type in dictionaries.eventTypes" :key="type">{{ type }}</option></select></td>
                  <td><input v-model="event.content" :disabled="isReadOnly" /></td>
                  <td><input v-model="event.measure" :disabled="isReadOnly" /></td>
                  <td><input v-model="event.recorder" :disabled="isReadOnly" /></td>
                  <td><input v-model="event.source" :disabled="isReadOnly" /></td>
                  <td><input v-model="event.remark" :disabled="isReadOnly" /></td>
                  <td><button :disabled="isReadOnly" @click="removeRow(currentRecord.events, event.id)">删除</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="activeTab === 'recovery'" class="tab-panel">
          <div class="section-card">
            <div class="card-title-row">
              <h2>复苏离室与交接 <span class="input-badge">一次性输入 + 持续输入</span></h2>
              <span v-if="currentRecord.recovery.destination === 'ICU'" class="risk-tag danger">ICU 高风险去向</span>
              <span v-if="Number(currentRecord.recovery.aldrete) < 9" class="risk-tag warn">Aldrete 低于 9 分</span>
            </div>
            <div class="form-grid four">
              <label>离室时间<input v-model="currentRecord.recovery.leaveTime" type="time" :disabled="isReadOnly" /></label>
              <label>离室去向
                <select v-model="currentRecord.recovery.destination" :disabled="isReadOnly">
                  <option v-for="dest in dictionaries.destinations" :key="dest">{{ dest }}</option>
                </select>
              </label>
              <label>意识状态<input v-model="currentRecord.recovery.consciousness" :disabled="isReadOnly" /></label>
              <label>呼吸情况<input v-model="currentRecord.recovery.respiration" :disabled="isReadOnly" /></label>
              <label>循环情况<input v-model="currentRecord.recovery.circulation" :disabled="isReadOnly" /></label>
              <label>疼痛评分<input v-model.number="currentRecord.recovery.painScore" type="number" :disabled="isReadOnly" /></label>
              <label>Aldrete 评分<input v-model.number="currentRecord.recovery.aldrete" type="number" :disabled="isReadOnly" /></label>
              <label>管路情况<input v-model="currentRecord.recovery.tubes" :disabled="isReadOnly" /></label>
              <label>皮肤情况<input v-model="currentRecord.recovery.skin" :disabled="isReadOnly" /></label>
              <label>交接护士<input v-model="currentRecord.recovery.handoverNurse" :disabled="isReadOnly" /></label>
              <label>接收人<input v-model="currentRecord.recovery.receiver" :disabled="isReadOnly" /></label>
              <label>入 PACU 时间<input v-model="currentRecord.recovery.pacuInTime" type="time" :disabled="isReadOnly" /></label>
              <label>出 PACU 时间<input v-model="currentRecord.recovery.pacuOutTime" type="time" :disabled="isReadOnly" /></label>
              <label class="wide">PACU 生命体征摘要<input v-model="currentRecord.recovery.pacuVitalSummary" :disabled="isReadOnly" /></label>
              <label class="full">交接备注<textarea v-model="currentRecord.recovery.handoverNote" :disabled="isReadOnly"></textarea></label>
              <label class="full">复苏结论<textarea v-model="currentRecord.recovery.conclusion" :disabled="isReadOnly"></textarea></label>
            </div>
          </div>

          <div class="section-card table-card">
            <div class="card-title-row">
              <h2>PACU 观察记录 <span class="input-badge">持续输入</span></h2>
              <button class="btn small" :disabled="isReadOnly" @click="addPacuObservation">新增观察</button>
            </div>
            <table class="editable-table">
              <thead><tr><th>时间</th><th>意识</th><th>呼吸</th><th>循环</th><th>疼痛</th><th>处理</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="row in currentRecord.recovery.pacuObservations" :key="row.id">
                  <td><input v-model="row.time" type="time" :disabled="isReadOnly" /></td>
                  <td><input v-model="row.consciousness" :disabled="isReadOnly" /></td>
                  <td><input v-model="row.respiration" :disabled="isReadOnly" /></td>
                  <td><input v-model="row.circulation" :disabled="isReadOnly" /></td>
                  <td><input v-model.number="row.painScore" type="number" :disabled="isReadOnly" /></td>
                  <td><input v-model="row.measure" :disabled="isReadOnly" /></td>
                  <td><button :disabled="isReadOnly" @click="removeRow(currentRecord.recovery.pacuObservations, row.id)">删除</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="activeTab === 'quality'" class="tab-panel">
          <div class="two-col">
            <div class="section-card">
              <div class="card-title-row">
                <h2>完整性检查 <span class="input-badge">自动检查 + 一次性确认</span></h2>
                <button class="btn primary small" @click="runQualityCheck">执行完整性检查</button>
              </div>
              <div class="quality-summary">
                <div><strong>{{ qualitySummary.pass }}</strong><span>通过</span></div>
                <div><strong>{{ qualitySummary.warn }}</strong><span>警告</span></div>
                <div><strong>{{ qualitySummary.fail }}</strong><span>未通过</span></div>
                <div><strong>{{ recordCompleteness }}%</strong><span>完整度</span></div>
              </div>
              <table class="quality-table">
                <thead><tr><th>检查项</th><th>状态</th><th>问题说明</th><th>定位</th></tr></thead>
                <tbody>
                  <tr v-for="item in displayQualityResults" :key="item.item">
                    <td>{{ item.item }}</td>
                    <td><span :class="qualityClass(item.status)">{{ item.status }}</span></td>
                    <td>{{ item.message }}</td>
                    <td><button @click="locateQuality(item.target)">定位</button></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="section-card">
              <h2>电子签名模拟 <span class="input-badge">一次性确认</span></h2>
              <div class="form-grid two">
                <label>麻醉医师签名<input v-model="currentRecord.signatures.anesthesiologist" :disabled="isReadOnly" /></label>
                <label>手术医师确认<input v-model="currentRecord.signatures.surgeon" :disabled="isReadOnly" /></label>
                <label>巡回护士签名<input v-model="currentRecord.signatures.nurse" :disabled="isReadOnly" /></label>
                <label>复核人签名<input v-model="currentRecord.signatures.reviewer" :disabled="isReadOnly" /></label>
                <label>签名时间<input v-model="currentRecord.signatures.signedAt" type="time" :disabled="isReadOnly" /></label>
                <label>签名状态<input v-model="currentRecord.signatures.status" disabled /></label>
              </div>
              <button class="btn success block" @click="submitSignature">提交签名</button>
              <p class="form-warning">存在“未通过”项时会阻止签名；签名成功后主表单只读。</p>
            </div>
          </div>

          <div class="section-card table-card">
            <div class="card-title-row">
              <h2>修改留痕表 <span class="input-badge">事件触发</span></h2>
              <button class="btn warning small" @click="openUnlock">解锁修改申请</button>
            </div>
            <table class="editable-table compact">
              <thead><tr><th>修改时间</th><th>修改人</th><th>修改原因</th><th>修改字段</th><th>修改前</th><th>修改后</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="log in currentRecord.modificationLogs" :key="log.id">
                  <td>{{ log.time }}</td><td>{{ log.operator }}</td><td>{{ log.reason }}</td><td>{{ log.scope }}</td><td>{{ log.before }}</td><td>{{ log.after }}</td><td>{{ log.status }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="activeTab === 'archive'" class="tab-panel">
          <div class="section-card">
            <div class="card-title-row">
              <h2>预览归档 <span class="input-badge">自动生成 + 前端占位</span></h2>
              <div class="row-actions">
                <button class="btn small" @click="placeholderAction('导出 PDF')">导出 PDF</button>
                <button class="btn small" @click="placeholderAction('导出 OFD')">导出 OFD</button>
                <button class="btn small" @click="placeholderAction('归档病案')">归档病案</button>
                <button class="btn small" @click="placeholderAction('共享调阅')">共享调阅</button>
                <button class="btn small primary" @click="openJsonPreview">查看结构化 JSON</button>
              </div>
            </div>
            <div class="paper-preview print-area">
              <div class="paper-header">
                <h2>麻醉记录单</h2>
                <span>{{ currentPatient.surgeryDate }} · {{ currentPatient.room }}</span>
              </div>
              <div class="paper-grid">
                <span>姓名：{{ currentPatient.name }}</span>
                <span>性别：{{ currentPatient.gender }}</span>
                <span>年龄：{{ currentPatient.age }}</span>
                <span>住院号：{{ currentPatient.inpatientNo }}</span>
                <span>诊断：{{ currentPatient.diagnosis }}</span>
                <span>手术：{{ currentPatient.actualSurgery }}</span>
                <span>麻醉方式：{{ currentRecord.anesthesia.method }}</span>
                <span>ASA：{{ currentPatient.asa }}</span>
              </div>
              <div class="paper-section">
                <h3>生命体征趋势</h3>
                <svg class="paper-chart" viewBox="0 0 720 180">
                  <polyline :points="seriesPoints('sbp', 40, 180, 170)" class="line sbp" />
                  <polyline :points="seriesPoints('dbp', 30, 120, 170)" class="line dbp" />
                  <polyline :points="seriesPoints('hr', 40, 150, 170)" class="line hr" />
                  <polyline :points="seriesPoints('spo2', 80, 100, 170)" class="line spo2" />
                </svg>
              </div>
              <div class="paper-columns">
                <div>
                  <h3>用药记录</h3>
                  <p v-for="med in currentRecord.medications" :key="med.id">{{ med.time }} {{ med.name }} {{ med.dose }}{{ med.unit }} {{ med.route }}</p>
                </div>
                <div>
                  <h3>出入量</h3>
                  <p>总入量 {{ fluidBalance.inputTotal }} ml；总出量 {{ fluidBalance.outputTotal }} ml；平衡 {{ fluidBalance.fluidBalance }} ml</p>
                  <p>输血 {{ fluidBalance.transfusionTotal }} ml；出血 {{ fluidBalance.bloodLossTotal }} ml</p>
                </div>
                <div>
                  <h3>气道管理</h3>
                  <p>{{ currentRecord.airway.airwayMethod }}；插管 {{ currentRecord.airway.intubationTime || '未填' }}；拔管 {{ currentRecord.airway.extubationTime || '未填' }}</p>
                  <p>{{ currentRecord.airway.airwayNote }}</p>
                </div>
              </div>
              <div class="paper-section">
                <h3>麻醉事件与抢救记录</h3>
                <p v-for="event in orderedEvents" :key="event.id">{{ event.time }} {{ event.type }}：{{ event.content }}；处理：{{ event.measure }}</p>
                <p v-if="currentRecord.rescue.summary">抢救小结：{{ currentRecord.rescue.summary.course }}；结果：{{ currentRecord.rescue.summary.result }}</p>
              </div>
              <div class="paper-columns">
                <div>
                  <h3>复苏离室</h3>
                  <p>去向：{{ currentRecord.recovery.destination }}；Aldrete：{{ currentRecord.recovery.aldrete }}；交接：{{ currentRecord.recovery.handoverNurse }} -> {{ currentRecord.recovery.receiver }}</p>
                </div>
                <div>
                  <h3>签名区</h3>
                  <p>麻醉医师：{{ currentRecord.signatures.anesthesiologist || '未签' }}</p>
                  <p>巡回护士：{{ currentRecord.signatures.nurse || '未签' }}</p>
                  <p>复核人：{{ currentRecord.signatures.reviewer || '未签' }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="section-card">
            <h2>评审能力映射 <span class="input-badge">自动生成</span></h2>
            <div class="capability-grid">
              <article v-for="capability in capabilityMap" :key="capability.name" class="capability-card">
                <strong>{{ capability.name }}</strong>
                <span :class="capabilityClass(capability.status)">{{ capability.status }}</span>
                <small>{{ capability.location }}</small>
              </article>
            </div>
          </div>
        </section>
      </main>

      <aside class="qc-panel">
        <div class="qc-sticky">
          <section v-if="currentRecord.rescue.active" class="qc-card rescue-card">
            <h3>抢救模式</h3>
            <strong>记录频率已调整为 {{ currentRecord.vitalFrequency }} 分钟</strong>
            <p>抢救开始：{{ currentRecord.rescue.startTime }}</p>
            <button class="btn danger small" @click="openRescueExit">结束抢救模式</button>
          </section>

          <section class="qc-card">
            <h3>记录状态</h3>
            <div class="status-lines">
              <span>记录：<b :class="statusClass(currentRecord.status)">{{ currentRecord.status }}</b></span>
              <span>采集：<b :class="collectClass(currentRecord.device.collectStatus)">{{ currentRecord.device.collectStatus }}</b></span>
              <span>频率：{{ currentRecord.vitalFrequency }}分钟/次</span>
              <span>来源：{{ currentRecord.dataSource }}</span>
            </div>
          </section>

          <section class="qc-card device-mini">
            <h3>设备采集状态</h3>
            <p><i :class="deviceLamp(currentRecord.device.monitor)"></i>监护仪：{{ currentRecord.device.monitor }}</p>
            <p><i :class="deviceLamp(currentRecord.device.anesthesiaMachine)"></i>麻醉机：{{ currentRecord.device.anesthesiaMachine }}</p>
            <p><i :class="deviceLamp(currentRecord.device.infusionPump)"></i>输注泵：{{ currentRecord.device.infusionPump }}</p>
            <p>最近采集：{{ currentRecord.device.lastCollectTime || '-' }}</p>
            <button class="link-btn" @click="showDeviceLogs = true">查看采集日志</button>
          </section>

          <section class="qc-card">
            <h3>关键时间节点</h3>
            <div class="check-list">
              <span v-for="field in keyNodeFields" :key="field.key" :class="{ done: currentRecord.anesthesia[field.key] }">{{ field.label }}</span>
            </div>
          </section>

          <section class="qc-card" :class="{ elevated: currentRecord.rescue.active }">
            <h3>异常生命体征</h3>
            <div v-if="abnormalVitals.length === 0" class="empty-state small">暂无异常</div>
            <article v-for="item in abnormalVitals.slice(0, 5)" :key="item.id" class="mini-abnormal">
              <strong>{{ item.time }} {{ item.metric }} {{ item.value }}</strong>
              <span>{{ item.handled ? '已闭环' : '未处理' }}</span>
            </article>
          </section>

          <section class="qc-card">
            <h3>完整性检查</h3>
            <div class="quality-mini">
              <span>通过 {{ qualitySummary.pass }}</span>
              <span>警告 {{ qualitySummary.warn }}</span>
              <span>未通过 {{ qualitySummary.fail }}</span>
              <strong>{{ recordCompleteness }}%</strong>
            </div>
            <button class="btn small primary" @click="runQualityCheck">立即检查</button>
          </section>

          <section class="qc-card">
            <h3>6级评审能力映射</h3>
            <div class="capability-mini">
              <span v-for="capability in capabilityMap.slice(0, 8)" :key="capability.name">
                {{ capability.name }} <b :class="capabilityClass(capability.status)">{{ capability.status }}</b>
              </span>
            </div>
          </section>

          <section class="qc-card">
            <h3>最近操作留痕</h3>
            <div class="operation-list">
              <p v-for="log in currentRecord.operationLogs.slice(-6).reverse()" :key="log.time + log.action">
                <time>{{ log.time }}</time>{{ log.action }}<small>{{ log.source }}</small>
              </p>
            </div>
          </section>
        </div>
      </aside>
    </div>

    <footer class="bottom-status">
      <span>最后保存时间：{{ lastSavedAt || '尚未保存' }}</span>
      <span>当前记录人：{{ currentOperator }}</span>
      <span>当前患者：{{ currentPatient.name }}</span>
      <span>数据来源：{{ currentRecord.dataSource }}</span>
      <span>本页面为前端原型，不连接真实设备</span>
    </footer>

    <div v-if="fieldMenu.visible" class="field-menu" :style="{ left: fieldMenu.x + 'px', top: fieldMenu.y + 'px' }" @click.stop>
      <button v-for="action in dictionaries.fieldActions" :key="action" @click="handleFieldAction(action)">{{ action }}</button>
    </div>

    <div class="toast-stack">
      <div v-for="toast in toasts" :key="toast.id" :class="['toast', toast.type]">{{ toast.message }}</div>
    </div>

    <ModalShell v-if="showRescueSummary" title="结束抢救模式 - 抢救小结" @close="showRescueSummary = false">
      <div class="form-grid two">
        <label>抢救结束时间<input v-model="rescueForm.endTime" type="time" /></label>
        <label>记录人<input v-model="rescueForm.recorder" /></label>
        <label class="full">抢救经过<textarea v-model="rescueForm.course"></textarea></label>
        <label class="full">用药处理<textarea v-model="rescueForm.medication"></textarea></label>
        <label class="full">气道处理<textarea v-model="rescueForm.airway"></textarea></label>
        <label class="full">循环支持<textarea v-model="rescueForm.circulation"></textarea></label>
        <label class="full">抢救结果<textarea v-model="rescueForm.result"></textarea></label>
      </div>
      <template #footer>
        <button class="btn" @click="showRescueSummary = false">取消</button>
        <button class="btn primary" @click="saveRescueSummary">保存抢救小结</button>
      </template>
    </ModalShell>

    <ModalShell v-if="showUnlockModal" title="解锁修改申请" @close="showUnlockModal = false">
      <div class="form-grid two">
        <label>修改原因<input v-model="unlockForm.reason" /></label>
        <label>申请人<input v-model="unlockForm.operator" /></label>
        <label>修改范围<input v-model="unlockForm.scope" /></label>
        <label class="full">备注<textarea v-model="unlockForm.remark"></textarea></label>
      </div>
      <template #footer>
        <button class="btn" @click="showUnlockModal = false">取消</button>
        <button class="btn warning" @click="saveUnlockRequest">提交申请</button>
      </template>
    </ModalShell>

    <ModalShell v-if="showJsonModal" title="当前患者结构化 JSON" wide @close="showJsonModal = false">
      <pre class="json-preview">{{ jsonPreview }}</pre>
      <template #footer>
        <button class="btn primary" @click="showJsonModal = false">关闭</button>
      </template>
    </ModalShell>

    <ModalShell v-if="showDeviceLogs" title="设备采集日志" @close="showDeviceLogs = false">
      <div class="log-list">
        <p v-for="log in currentRecord.device.logs" :key="log.time + log.content"><time>{{ log.time }}</time>{{ log.content }}</p>
      </div>
      <template #footer>
        <button class="btn primary" @click="showDeviceLogs = false">关闭</button>
      </template>
    </ModalShell>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, reactive, ref } from 'vue';
import AnesthesiaLiveSheet from './AnesthesiaLiveSheet.vue';
import {
  abnormalRules,
  calculateBMI,
  calculateFluidBalance,
  detectAbnormalVitals,
  formatMinutes,
  runQualityRules,
  sortByTime,
  validateTimeline,
} from './anesthesiaRecordHelpers.js';
import { capabilityMap, currentOperator, dictionaries, initialPatients } from './anesthesiaRecordData.js';

const ModalShell = defineComponent({
  props: { title: String, wide: Boolean },
  emits: ['close'],
  setup(props, { slots, emit }) {
    return () =>
      h('div', { class: 'modal-backdrop' }, [
        h('div', { class: ['modal-card', props.wide ? 'wide' : ''] }, [
          h('div', { class: 'modal-head' }, [h('h3', props.title), h('button', { onClick: () => emit('close') }, '×')]),
          h('div', { class: 'modal-body' }, slots.default?.()),
          h('div', { class: 'modal-footer' }, slots.footer?.()),
        ]),
      ]);
  },
});

const DeviceStatusCard = defineComponent({
  props: { device: Object, readOnly: Boolean },
  emits: ['start', 'pause', 'resume', 'manual', 'logs'],
  setup(props, { emit }) {
    const statusClass = (value) => `device-dot ${String(value).replace(/\s+/g, '-')}`;
    return () =>
      h('div', { class: 'section-card device-card' }, [
        h('div', { class: 'card-title-row' }, [h('h2', ['设备采集状态 ', h('span', { class: 'input-badge' }, '设备采集占位')])]),
        h('div', { class: 'device-status-grid' }, [
          h('p', [h('i', { class: statusClass(props.device.monitor) }), `监护仪：${props.device.monitor}`]),
          h('p', [h('i', { class: statusClass(props.device.anesthesiaMachine) }), `麻醉机：${props.device.anesthesiaMachine}`]),
          h('p', [h('i', { class: statusClass(props.device.infusionPump) }), `输注泵：${props.device.infusionPump}`]),
          h('p', `数据来源：${props.device.dataSource}`),
          h('p', `最近采集：${props.device.lastCollectTime || '-'}`),
          h('p', `采集频率：${props.device.collectFrequency}`),
          h('p', `数据接收：${props.device.receiveStatus}`),
          h('p', `异常说明：${props.device.abnormalNote || '-'}`),
        ]),
        h('div', { class: 'row-actions' }, [
          h('button', { class: 'btn small primary', disabled: props.readOnly, onClick: () => emit('start') }, '启动采集'),
          h('button', { class: 'btn small', disabled: props.readOnly, onClick: () => emit('pause') }, '暂停采集'),
          h('button', { class: 'btn small', disabled: props.readOnly, onClick: () => emit('resume') }, '恢复采集'),
          h('button', { class: 'btn small', disabled: props.readOnly, onClick: () => emit('manual') }, '手工补录'),
          h('button', { class: 'btn small', onClick: () => emit('logs') }, '查看采集日志'),
        ]),
      ]);
  },
});

const EditableMedicationTable = defineComponent({
  props: { rows: Array, readOnly: Boolean },
  emits: ['copy', 'remove', 'event'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'table-scroll' }, [
        h('table', { class: 'editable-table' }, [
          h('thead', [h('tr', ['时间', '药品名称', '剂量', '单位', '途径', '给药原因', '执行人', '核对人', '高警示', '备注', '操作'].map((head) => h('th', head)))]),
          h(
            'tbody',
            props.rows.map((row) =>
              h('tr', { key: row.id, class: row.highAlert ? 'high-alert-row' : '' }, [
                h('td', [h('input', { type: 'time', value: row.time, disabled: props.readOnly, onInput: (e) => (row.time = e.target.value) })]),
                h('td', [h('input', { value: row.name, disabled: props.readOnly, onInput: (e) => (row.name = e.target.value) })]),
                h('td', [h('input', { type: 'number', value: row.dose, disabled: props.readOnly, onInput: (e) => (row.dose = e.target.value) })]),
                h('td', [h('input', { value: row.unit, disabled: props.readOnly, onInput: (e) => (row.unit = e.target.value) })]),
                h('td', [h('input', { value: row.route, disabled: props.readOnly, onInput: (e) => (row.route = e.target.value) })]),
                h('td', [h('input', { value: row.reason, disabled: props.readOnly, onInput: (e) => (row.reason = e.target.value) })]),
                h('td', [h('input', { value: row.executor, disabled: props.readOnly, onInput: (e) => (row.executor = e.target.value) })]),
                h('td', [h('input', { value: row.checker, disabled: props.readOnly, onInput: (e) => (row.checker = e.target.value) })]),
                h('td', [h('input', { type: 'checkbox', checked: row.highAlert, disabled: props.readOnly, onChange: (e) => (row.highAlert = e.target.checked) })]),
                h('td', [h('input', { value: row.remark, disabled: props.readOnly, onInput: (e) => (row.remark = e.target.value) })]),
                h('td', { class: 'table-actions' }, [
                  h('button', { disabled: props.readOnly, onClick: () => emit('copy', row) }, '复制'),
                  h('button', { disabled: props.readOnly, onClick: () => emit('event', row) }, '事件'),
                  h('button', { disabled: props.readOnly, onClick: () => emit('remove', row.id) }, '删除'),
                ]),
              ]),
            ),
          ),
        ]),
      ]);
  },
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const patients = ref(clone(initialPatients));
const selectedPatientId = ref(patients.value[0].id);
const activeFilter = ref('全部');
const activeTab = ref('live');
const lastSavedAt = ref('');
const showRescueSummary = ref(false);
const showUnlockModal = ref(false);
const showJsonModal = ref(false);
const showDeviceLogs = ref(false);
const jsonPreview = ref('');
const toasts = ref([]);
const abnormalMeasureDraft = reactive({});
const generationForm = reactive({ start: '08:00', end: '10:00', interval: 5 });
const fieldMenu = reactive({ visible: false, x: 0, y: 0, target: null, field: '' });
const rescueForm = reactive({
  endTime: '',
  course: '',
  medication: '',
  airway: '',
  circulation: '',
  result: '',
  recorder: currentOperator,
});
const unlockForm = reactive({
  reason: '病历签名后补充完善记录',
  operator: currentOperator,
  scope: '麻醉记录单内容',
  remark: '',
});

const patientFilters = ['全部', '记录中', '待签名', '已签名', '抢救中', '采集中'];
const tabs = [
  { key: 'live', label: '实时记录单', mode: '实时显示 + 持续录入' },
  { key: 'patient', label: '患者信息', mode: '一次性输入' },
  { key: 'anesthesia', label: '麻醉记录', mode: '一次性输入 + 事件触发' },
  { key: 'vitals', label: '生命体征', mode: '持续输入 + 设备采集占位' },
  { key: 'medication', label: '用药出入量', mode: '持续输入 + 自动计算' },
  { key: 'airway', label: '气道与事件', mode: '一次性输入 + 事件触发' },
  { key: 'recovery', label: '复苏离室', mode: '一次性输入 + PACU 持续输入' },
  { key: 'quality', label: '质控签名', mode: '自动检查 + 一次性确认' },
  { key: 'archive', label: '预览归档', mode: '自动生成 + 前端占位' },
];
const timeFields = [
  { key: 'inRoomTime', label: '患者入室时间', eventType: '入室' },
  { key: 'recordStart', label: '启动记录时间', eventType: '启动记录' },
  { key: 'anesthesiaStart', label: '麻醉开始时间', eventType: '麻醉开始' },
  { key: 'inductionStart', label: '麻醉诱导开始时间', eventType: '诱导' },
  { key: 'intubationTime', label: '插管时间', eventType: '插管' },
  { key: 'punctureTime', label: '穿刺时间', eventType: '穿刺' },
  { key: 'blockFinishTime', label: '阻滞完成时间', eventType: '穿刺' },
  { key: 'surgeryStart', label: '手术开始时间', eventType: '手术开始' },
  { key: 'surgeryEnd', label: '手术结束时间', eventType: '手术结束' },
  { key: 'extubationTime', label: '拔管时间', eventType: '拔管' },
  { key: 'anesthesiaEnd', label: '麻醉结束时间', eventType: '其他' },
  { key: 'outRoomTime', label: '患者出室时间', eventType: '出室' },
  { key: 'pacuInTime', label: '入 PACU 时间', eventType: '其他' },
  { key: 'pacuOutTime', label: '出 PACU 时间', eventType: '其他' },
];
const keyNodeFields = timeFields.filter((field) => ['recordStart', 'anesthesiaStart', 'surgeryStart', 'surgeryEnd', 'anesthesiaEnd', 'outRoomTime'].includes(field.key));
const highAlertDrugs = new Set(['舒芬太尼', '瑞芬太尼', '去甲肾上腺素', '多巴胺', '肾上腺素']);

const currentPatient = computed(() => patients.value.find((patient) => patient.id === selectedPatientId.value) || patients.value[0]);
const currentRecord = computed(() => currentPatient.value.record);
const activeTabMeta = computed(() => tabs.find((tab) => tab.key === activeTab.value) || tabs[0]);
const activeTabLabel = computed(() => activeTabMeta.value.label);
const patientBMI = computed(() => calculateBMI(currentPatient.value.height, currentPatient.value.weight));
const isReadOnly = computed(() => ['已签名', '已归档'].includes(currentRecord.value.status));
const isHighAsa = computed(() => ['III级', 'IV级', 'V级'].includes(currentPatient.value.asa));
const hasAllergy = computed(() => currentPatient.value.allergy && currentPatient.value.allergy !== '无');
const filteredPatients = computed(() => {
  if (activeFilter.value === '全部') return patients.value;
  if (activeFilter.value === '抢救中') return patients.value.filter((patient) => patient.record.rescue.active || patient.record.status === '抢救中');
  if (activeFilter.value === '采集中') return patients.value.filter((patient) => patient.record.device.collectStatus === '采集中');
  return patients.value.filter((patient) => patient.record.status === activeFilter.value);
});
const groupedPatients = computed(() =>
  filteredPatients.value.reduce((groups, patient) => {
    groups[patient.room] = groups[patient.room] || [];
    groups[patient.room].push(patient);
    return groups;
  }, {}),
);
const timelineIssues = computed(() => validateTimeline(currentRecord.value.anesthesia));
const timelineIssueFields = computed(() => timelineIssues.value.map((issue) => issue.field));
const filledTimeline = computed(() => timeFields.filter((field) => currentRecord.value.anesthesia[field.key]));
const latestVitalTime = computed(() => sortByTime(currentRecord.value.vitals).at(-1)?.time || '');
const nextVitalTime = computed(() => addMinutes(latestVitalTime.value || nowTime(), currentRecord.value.vitalFrequency));
const abnormalVitals = computed(() => detectAbnormalVitals(currentRecord.value.vitals));
const unhandledAbnormalCount = computed(() => abnormalVitals.value.filter((item) => !item.handled).length);
const fluidBalance = computed(() => calculateFluidBalance(currentRecord.value));
const orderedEvents = computed(() => sortByTime(currentRecord.value.events));
const displayQualityResults = computed(() => (currentRecord.value.qualityResults.length ? currentRecord.value.qualityResults : runQualityRules({ patient: currentPatient.value, record: currentRecord.value })));
const qualitySummary = computed(() => {
  const results = displayQualityResults.value;
  return {
    pass: results.filter((item) => item.status === '通过').length,
    warn: results.filter((item) => item.status === '警告').length,
    fail: results.filter((item) => item.status === '未通过').length,
  };
});
const recordCompleteness = computed(() => {
  const total = displayQualityResults.value.length || 1;
  return Math.round(((qualitySummary.value.pass + qualitySummary.value.warn * 0.5) / total) * 100);
});
const chartRows = computed(() => currentRecord.value.vitals.filter((row) => row.time).slice(-12));

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

function addMinutes(time, minutes) {
  if (!time) return '';
  const [hour, minute] = time.split(':').map(Number);
  if (![hour, minute].every(Number.isFinite)) return '';
  const date = new Date(2026, 0, 1, hour, minute + Number(minutes || 0));
  return date.toTimeString().slice(0, 5);
}

function notify(message, type = 'info') {
  const toast = { id: uniqueId('toast'), message, type };
  toasts.value.push(toast);
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((item) => item.id !== toast.id);
  }, 3200);
}

function addOperationLog(action, source = '系统生成') {
  currentRecord.value.operationLogs.push({ time: nowTime(), operator: currentOperator, action, source });
}

function addEvent({ time = nowTime(), type = '其他', content, measure = '', recorder = currentOperator, source = '系统生成', remark = '' }, silent = false) {
  currentRecord.value.events.push({ id: uniqueId('event'), time, type, content, measure, recorder, source, remark });
  addOperationLog(`${type}：${content}`, source);
  if (!silent) notify(`已写入事件时间线：${type}`);
}

function selectPatient(id) {
  selectedPatientId.value = id;
  activeTab.value = 'live';
}

function statusClass(status) {
  const map = {
    草稿: 'status-draft',
    记录中: 'status-running',
    待签名: 'status-pending',
    已签名: 'status-signed',
    待归档: 'status-archive',
    已归档: 'status-archived',
    抢救中: 'status-rescue',
    修改中: 'status-editing',
  };
  return map[status] || 'status-draft';
}

function collectClass(status) {
  const map = {
    未连接: 'collect-off',
    待启动: 'collect-wait',
    采集中: 'collect-on',
    采集暂停: 'collect-pause',
    采集异常: 'collect-error',
    已结束: 'collect-end',
  };
  return map[status] || 'collect-off';
}

function qualityClass(status) {
  return { 通过: 'quality-pass', 警告: 'quality-warn', 未通过: 'quality-fail' }[status] || 'quality-warn';
}

function capabilityClass(status) {
  return { 已具备: 'cap-done', 部分具备: 'cap-partial', 前端占位: 'cap-placeholder' }[status] || 'cap-placeholder';
}

function deviceLamp(status) {
  return `device-dot ${collectClass(status)}`;
}

function startRecord() {
  if (isReadOnly.value) return notify('已签名或已归档记录需先解锁修改。', 'warn');
  const time = nowTime();
  currentRecord.value.status = '记录中';
  currentRecord.value.startedAt = time;
  currentRecord.value.anesthesia.recordStart = time;
  currentRecord.value.device.collectStatus = '待启动';
  currentRecord.value.dataSource = '手工录入 + 设备采集占位';
  addVitalRow(time, true);
  addEvent({
    time,
    type: '启动记录',
    content: '启动麻醉记录',
    measure: '开始记录术中生命体征、用药及麻醉事件',
  });
}

// 设备采集占位：仅修改前端状态，不连接真实监护仪、麻醉机或输注泵。
function startDeviceCollect() {
  if (isReadOnly.value) return notify('已签名或已归档记录不能启动采集。', 'warn');
  const record = currentRecord.value;
  const time = nowTime();
  Object.assign(record.device, {
    collectStatus: '采集中',
    monitor: '采集中',
    anesthesiaMachine: '采集中',
    infusionPump: '已连接',
    dataSource: '手工录入 + 设备采集占位',
    lastCollectTime: time,
    collectFrequency: `${record.vitalFrequency}分钟/次`,
    receiveStatus: '接收正常',
  });
  record.dataSource = '手工录入 + 设备采集占位';
  record.device.logs.push({ time, content: '启动设备采集模拟' }, { time, content: '接收监护仪数据' }, { time, content: '接收麻醉机数据' });
  addEvent({ time, type: '设备采集', content: '启动设备采集，占位模拟', measure: '后续可对接监护仪、麻醉机、输注泵等设备', source: '设备采集占位' });
  notify('已启动设备采集模拟。当前为前端原型，后续可对接监护仪、麻醉机、输注泵等设备。', 'success');
}

function pauseDeviceCollect() {
  currentRecord.value.device.collectStatus = '采集暂停';
  currentRecord.value.device.receiveStatus = '暂停接收';
  currentRecord.value.device.logs.push({ time: nowTime(), content: '暂停采集' });
  addOperationLog('暂停设备采集', '事件触发');
  notify('已暂停设备采集模拟。');
}

function resumeDeviceCollect() {
  currentRecord.value.device.collectStatus = '采集中';
  currentRecord.value.device.receiveStatus = '接收正常';
  currentRecord.value.device.lastCollectTime = nowTime();
  currentRecord.value.device.logs.push({ time: nowTime(), content: '恢复采集' });
  addOperationLog('恢复设备采集', '事件触发');
  notify('已恢复设备采集模拟。');
}

function manualDeviceRecord() {
  addVitalRow(nowTime(), false, '手工补录');
  currentRecord.value.dataSource = '手工录入 + 手工修正';
  addOperationLog('手工补录设备数据', '手工补录');
}

// 抢救模式频率调整：保存原频率，进入抢救后自动提升到 1 分钟。
function enterRescueMode() {
  if (isReadOnly.value) return notify('已签名或已归档记录需先解锁修改。', 'warn');
  if (!window.confirm('确认进入抢救模式？系统将提高生命体征记录频率，并标记抢救事件。')) return;
  const record = currentRecord.value;
  const time = nowTime();
  record.previousFrequency = record.vitalFrequency;
  record.vitalFrequency = 1;
  record.status = '抢救中';
  record.rescue.active = true;
  record.rescue.startTime = time;
  record.device.logs.push({ time, content: '抢救模式提高采集频率' });
  addVitalRow(time, true, '设备采集占位', true);
  addEvent({
    time,
    type: '抢救',
    content: '启动抢救模式',
    measure: '提高生命体征记录频率，持续观察患者循环、呼吸及血氧情况',
  });
}

function openRescueExit() {
  rescueForm.endTime = nowTime();
  rescueForm.recorder = currentOperator;
  showRescueSummary.value = true;
}

function saveRescueSummary() {
  if (!rescueForm.course || !rescueForm.result) return notify('请填写抢救经过和抢救结果。', 'warn');
  const record = currentRecord.value;
  record.rescue.active = false;
  record.rescue.endTime = rescueForm.endTime || nowTime();
  record.rescue.summary = clone(rescueForm);
  record.status = '记录中';
  record.vitalFrequency = record.previousFrequency || 5;
  addEvent({
    time: record.rescue.endTime,
    type: '抢救结束',
    content: '结束抢救模式',
    measure: '记录抢救小结并恢复常规记录频率',
  });
  showRescueSummary.value = false;
}

function addVitalRow(time = nowTime(), silent = false, source = '手工录入', rescue = currentRecord.value.rescue.active) {
  currentRecord.value.vitals.push({
    id: uniqueId('vital'),
    time,
    sbp: '',
    dbp: '',
    hr: '',
    rr: '',
    spo2: '',
    etco2: '',
    temp: '',
    bis: '',
    source,
    rescue,
    remark: rescue ? '抢救模式' : '',
    abnormalHandled: {},
  });
  if (!silent) addOperationLog('新增生命体征记录', source);
}

function removeVitalRow(id) {
  if (!window.confirm('确认删除该生命体征记录？')) return;
  currentRecord.value.vitals = currentRecord.value.vitals.filter((row) => row.id !== id);
  addOperationLog('删除生命体征记录', '手工操作');
}

function copyVitalRow(row) {
  currentRecord.value.vitals.push({ ...clone(row), id: uniqueId('vital'), time: nowTime(), source: '手工修正' });
}

function duplicateLastVital() {
  const last = currentRecord.value.vitals.at(-1);
  if (!last) return addVitalRow();
  copyVitalRow(last);
}

function parseMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function formatTimeFromMinutes(total) {
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function generateVitalTimePoints() {
  if (!generationForm.start || !generationForm.end) return notify('请填写起始和结束时间。', 'warn');
  const start = parseMinutes(generationForm.start);
  const end = parseMinutes(generationForm.end);
  if (end < start) return notify('结束时间不能早于起始时间。', 'warn');
  const existing = new Set(currentRecord.value.vitals.map((row) => row.time));
  for (let minute = start; minute <= end; minute += Number(generationForm.interval || 5)) {
    const time = formatTimeFromMinutes(minute);
    if (!existing.has(time)) addVitalRow(time, true);
  }
  addOperationLog('批量生成生命体征时间点', '手工操作');
}

function clearEmptyVitals() {
  currentRecord.value.vitals = currentRecord.value.vitals.filter((row) => ['sbp', 'dbp', 'hr', 'rr', 'spo2', 'etco2', 'temp', 'bis'].some((field) => row[field] !== '' && row[field] !== null));
  addOperationLog('清空空白生命体征时间点', '手工操作');
}

function importDeviceVitals() {
  const previous = currentRecord.value.vitals.at(-1) || {};
  currentRecord.value.device.lastCollectTime = nowTime();
  addVitalRow(nowTime(), true, '设备采集占位');
  const row = currentRecord.value.vitals.at(-1);
  Object.assign(row, {
    sbp: Number(previous.sbp) || 122,
    dbp: Number(previous.dbp) || 72,
    hr: Number(previous.hr) || 78,
    rr: Number(previous.rr) || 12,
    spo2: Number(previous.spo2) || 99,
    etco2: Number(previous.etco2) || 38,
    temp: Number(previous.temp) || 36.3,
    bis: Number(previous.bis) || 48,
  });
  addOperationLog('从设备采集占位带入生命体征', '设备采集占位');
}

function markLastVitalAbnormal() {
  if (!currentRecord.value.vitals.length) addVitalRow();
  Object.assign(currentRecord.value.vitals.at(-1), { sbp: 82, dbp: 48, hr: 126, spo2: 91, etco2: 48, remark: '手工标记异常' });
  addEvent({ type: '异常生命体征', content: '手工标记异常生命体征', measure: '待补充处置措施', source: '手工补录' });
}

function isAbnormal(row, field) {
  const rule = abnormalRules.find((item) => item.field === field);
  const value = Number(row[field]);
  if (!rule || !Number.isFinite(value)) return false;
  return (rule.low !== null && value < rule.low) || (rule.high !== null && value > rule.high);
}

function saveAbnormalMeasure(item) {
  const row = currentRecord.value.vitals.find((vital) => vital.id === item.rowId);
  if (!row) return;
  row.abnormalHandled = row.abnormalHandled || {};
  row.abnormalHandled[item.field] = abnormalMeasureDraft[item.id] || item.measure || '已处理并持续观察';
  addOperationLog(`闭环异常生命体征 ${item.metric}`, '手工操作');
}

function generateAbnormalEvent(item) {
  addEvent({
    time: item.time,
    type: '异常生命体征',
    content: `${item.metric} ${item.value} 异常`,
    measure: abnormalMeasureDraft[item.id] || item.measure || item.suggestion,
    source: '事件触发',
  });
  saveAbnormalMeasure(item);
}

function addMedication(name = '') {
  currentRecord.value.medications.push({
    id: uniqueId('med'),
    time: nowTime(),
    name,
    dose: '',
    unit: name === '瑞芬太尼' ? 'ug/kg/min' : 'mg',
    route: '静脉',
    reason: '',
    executor: currentRecord.value.anesthesia.anesthesiologist || '',
    checker: currentRecord.value.anesthesia.circulatingNurse || '',
    highAlert: highAlertDrugs.has(name),
    remark: '',
  });
  if (name) generateMedicationEvent(currentRecord.value.medications.at(-1));
}

function quickAddMedication(name) {
  addMedication(name);
}

function removeMedication(id) {
  if (!window.confirm('确认删除该用药记录？')) return;
  currentRecord.value.medications = currentRecord.value.medications.filter((row) => row.id !== id);
}

function copyMedication(row) {
  currentRecord.value.medications.push({ ...clone(row), id: uniqueId('med'), time: nowTime() });
}

function generateMedicationEvent(row) {
  addEvent({
    time: row.time || nowTime(),
    type: '用药',
    content: `${row.name || '未命名药品'} ${row.dose || ''}${row.unit || ''}`,
    measure: row.reason || '记录术中给药',
    source: row.highAlert ? '事件触发' : '手工补录',
  });
}

function addInfusion() {
  currentRecord.value.infusions.push({ id: uniqueId('infusion'), time: nowTime(), name: '乳酸钠林格液', spec: '500ml', volume: 500, executor: currentRecord.value.anesthesia.circulatingNurse });
  addEvent({ type: '输液', content: '新增输液记录', measure: '记录输入量并纳入液体平衡', source: '事件触发' });
}

function addTransfusion() {
  currentRecord.value.transfusions.push({ id: uniqueId('transfusion'), time: nowTime(), product: '悬浮红细胞', bagNo: '', bloodType: '', volume: 200, doubleCheck: false, reaction: '无' });
  addEvent({ type: '输血', content: '新增输血记录', measure: '请完成血袋号、血型与双人核对', source: '事件触发' });
}

function addOutput() {
  currentRecord.value.outputs.push({ id: uniqueId('output'), time: nowTime(), urine: 0, bloodLoss: 0, drainage: 0, other: 0, remark: '' });
}

function removeRow(rows, id) {
  if (!window.confirm('确认删除该记录？')) return;
  const index = rows.findIndex((row) => row.id === id);
  if (index >= 0) rows.splice(index, 1);
}

function setTimeNow(field) {
  currentRecord.value.anesthesia[field.key] = nowTime();
  handleTimeChange(field);
}

function handleTimeChange(field) {
  if (!currentRecord.value.anesthesia[field.key]) return;
  if (field.key === 'intubationTime') currentRecord.value.airway.intubationTime = currentRecord.value.anesthesia[field.key];
  if (field.key === 'extubationTime') currentRecord.value.airway.extubationTime = currentRecord.value.anesthesia[field.key];
  addEvent({
    time: currentRecord.value.anesthesia[field.key],
    type: field.eventType,
    content: `填写${field.label}`,
    measure: '关键时间节点已记录并纳入时间轴追溯',
    source: '事件触发',
  });
}

function fillCommonTimeline() {
  const start = currentRecord.value.anesthesia.inRoomTime || nowTime();
  const values = {
    inRoomTime: start,
    recordStart: addMinutes(start, 2),
    anesthesiaStart: addMinutes(start, 5),
    inductionStart: addMinutes(start, 8),
    intubationTime: addMinutes(start, 14),
    surgeryStart: addMinutes(start, 30),
    surgeryEnd: addMinutes(start, 95),
    extubationTime: addMinutes(start, 105),
    anesthesiaEnd: addMinutes(start, 110),
    outRoomTime: addMinutes(start, 116),
    pacuInTime: addMinutes(start, 120),
  };
  Object.assign(currentRecord.value.anesthesia, values);
  Object.assign(currentRecord.value.airway, { intubationTime: values.intubationTime, extubationTime: values.extubationTime });
  addOperationLog('填入常用关键时间顺序', '右键菜单生成');
}

function setAirwayTime(field) {
  currentRecord.value.airway[field] = nowTime();
  if (field === 'intubationTime') handleAirwayIntubation();
  if (field === 'extubationTime') syncExtubationTime();
}

function handleAirwayIntubation() {
  currentRecord.value.airway.airwayMethod = '气管插管';
  currentRecord.value.anesthesia.intubationTime = currentRecord.value.airway.intubationTime;
  addEvent({ time: currentRecord.value.airway.intubationTime || nowTime(), type: '插管', content: '填写插管时间', measure: '气道方式自动建议为气管插管', source: '事件触发' });
}

function syncExtubationTime() {
  currentRecord.value.anesthesia.extubationTime = currentRecord.value.airway.extubationTime;
  addEvent({ time: currentRecord.value.airway.extubationTime || nowTime(), type: '拔管', content: '填写拔管时间', measure: '记录拔管情况及拔管后 SpO2', source: '事件触发' });
}

function addEventRow() {
  currentRecord.value.events.push({ id: uniqueId('event'), time: nowTime(), type: '其他', content: '', measure: '', recorder: currentOperator, source: '手工补录', remark: '' });
}

function sortEvents() {
  currentRecord.value.events = sortByTime(currentRecord.value.events);
}

function addPacuObservation() {
  currentRecord.value.recovery.pacuObservations.push({ id: uniqueId('pacu'), time: nowTime(), consciousness: '', respiration: '', circulation: '', painScore: 2, measure: '' });
}

function runQualityCheck() {
  currentRecord.value.qualityResults = runQualityRules({ patient: currentPatient.value, record: currentRecord.value });
  notify('完整性检查已生成。', currentRecord.value.qualityResults.some((item) => item.status === '未通过') ? 'warn' : 'success');
  activeTab.value = 'quality';
}

function submitSignature() {
  const results = runQualityRules({ patient: currentPatient.value, record: currentRecord.value });
  currentRecord.value.qualityResults = results;
  if (results.some((item) => item.status === '未通过')) {
    activeTab.value = 'quality';
    return notify('存在未通过项，已阻止提交签名。', 'error');
  }
  currentRecord.value.status = '已签名';
  currentRecord.value.signatures.status = '已签名';
  currentRecord.value.signatures.signedAt = currentRecord.value.signatures.signedAt || nowTime();
  addEvent({ type: '签名', content: '提交电子签名', measure: '记录单签名后进入只读状态', source: '系统生成' });
  notify('签名成功，记录单已进入只读状态。', 'success');
}

function openUnlock() {
  unlockForm.reason = '病历签名后补充完善记录';
  unlockForm.operator = currentOperator;
  unlockForm.scope = '麻醉记录单内容';
  unlockForm.remark = '';
  showUnlockModal.value = true;
}

function saveUnlockRequest() {
  if (!unlockForm.reason || !unlockForm.operator) return notify('请填写修改原因和申请人。', 'warn');
  const before = currentRecord.value.status;
  currentRecord.value.status = '修改中';
  currentRecord.value.signatures.status = '修改中';
  currentRecord.value.modificationLogs.push({
    id: uniqueId('modify'),
    time: nowTime(),
    operator: unlockForm.operator,
    reason: unlockForm.reason,
    scope: unlockForm.scope,
    before: `${before}版本`,
    after: '修改中版本',
    status: '已记录',
  });
  addEvent({ type: '修改', content: '提交解锁修改申请', measure: unlockForm.reason, recorder: unlockForm.operator, source: '事件触发' });
  showUnlockModal.value = false;
}

function saveDraft() {
  lastSavedAt.value = nowTime();
  if (currentRecord.value.status === '修改中') {
    currentRecord.value.modificationLogs.push({
      id: uniqueId('modify'),
      time: lastSavedAt.value,
      operator: currentOperator,
      reason: '保存修改中记录',
      scope: '麻醉记录单内容',
      before: '修改中版本',
      after: '已保存草稿版本',
      status: '已记录',
    });
  }
  addOperationLog('保存草稿', '手工操作');
  notify('草稿已保存到前端本地 state。', 'success');
}

function goPreview() {
  activeTab.value = 'archive';
  notify('已生成当前前端 state 的记录单预览。');
}

function printPreview() {
  activeTab.value = 'archive';
  window.setTimeout(() => window.print(), 80);
}

function openJsonPreview() {
  jsonPreview.value = JSON.stringify(currentPatient.value, null, 2);
  showJsonModal.value = true;
}

function placeholderAction(action) {
  notify(`${action} 为前端原型占位，后续可对接后端归档、PDF/OFD 服务或共享调阅平台。`);
}

function locateQuality(target) {
  const map = { patient: 'patient', anesthesia: 'anesthesia', vitals: 'vitals', medication: 'medication', airway: 'airway', recovery: 'recovery', signature: 'quality', device: 'anesthesia', events: 'airway' };
  activeTab.value = map[target] || 'quality';
}

function openFieldMenu(event, target, field) {
  fieldMenu.visible = true;
  fieldMenu.x = event.clientX;
  fieldMenu.y = event.clientY;
  fieldMenu.target = target;
  fieldMenu.field = field;
}

function hideFieldMenu() {
  fieldMenu.visible = false;
}

async function handleFieldAction(action) {
  const target = fieldMenu.target;
  const field = fieldMenu.field;
  if (!target || !field) return;
  if (action === '填入当前时间') target[field] = nowTime();
  if (action === '复制字段') {
    await navigator.clipboard?.writeText?.(String(target[field] || ''));
    notify('字段内容已复制。');
  }
  if (action === '清空字段') target[field] = '';
  if (action === '使用常用值') target[field] = target[field] || '无';
  if (action === '定位质控问题') runQualityCheck();
  addOperationLog(`右键菜单：${action}`, '右键菜单生成');
  hideFieldMenu();
}

function chartX(index) {
  const total = Math.max(chartRows.value.length - 1, 1);
  return 40 + (index / total) * 660;
}

function seriesPoints(field, min, max, height = 210) {
  if (!chartRows.value.length) return '';
  const yBottom = height;
  const yTop = 24;
  return chartRows.value
    .map((row, index) => {
      const value = Number(row[field]);
      const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
      const y = yBottom - normalized * (yBottom - yTop);
      return `${chartX(index).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function formatDuration(start, end) {
  return formatMinutes(start, end) || '-';
}

defineExpose({ formatDuration });
</script>
