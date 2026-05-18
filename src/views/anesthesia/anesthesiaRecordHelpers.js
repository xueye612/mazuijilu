export const abnormalRules = [
  { metric: 'SBP', field: 'sbp', label: '收缩压', low: 90, high: 160, suggestion: '复测血压，评估容量、麻醉深度及循环支持需要' },
  { metric: 'DBP', field: 'dbp', label: '舒张压', low: 50, high: 100, suggestion: '关注循环灌注，必要时调整血管活性药物' },
  { metric: 'HR', field: 'hr', label: '心率', low: 50, high: 120, suggestion: '评估心律、麻醉深度、失血和用药影响' },
  { metric: 'RR', field: 'rr', label: '呼吸', low: 8, high: 25, suggestion: '检查通气参数、气道通畅和自主呼吸状态' },
  { metric: 'SpO2', field: 'spo2', label: '血氧', low: 95, high: null, suggestion: '检查探头、氧源、气道位置和通气氧合情况' },
  { metric: 'EtCO2', field: 'etco2', label: '呼末二氧化碳', low: 30, high: 45, suggestion: '复核通气量、循环状态和呼吸回路' },
  { metric: 'TEMP', field: 'temp', label: '体温', low: 35.5, high: 38.5, suggestion: '评估保温、感染和输液输血温度管理' },
  { metric: 'BIS', field: 'bis', label: '麻醉深度', low: 40, high: 60, suggestion: '结合血流动力学调整镇静镇痛和肌松策略' },
];

export const LIVE_TIME_STEP_MINUTES = 1;
export const LIVE_DEFAULT_SEGMENT_MINUTES = 10;

export const medicationUnitOptions = ['mg', 'ug', 'ml', 'ug/kg·min', 'mg/h', '%', 'ug/h', '克'];

export const bloodProductOptions = [
  { product: '血小板', unit: '治疗量', defaultVolume: 1 },
  { product: '白细胞', unit: '袋', defaultVolume: 1 },
  { product: '红细胞', unit: 'U', defaultVolume: 2 },
  { product: '冷沉淀', unit: 'U', defaultVolume: 10 },
];

const highAlertMedicationNames = ['右美托咪定', '丙泊酚', '瑞芬太尼', '去甲肾上腺素', '肾上腺素', '多巴胺'];

const timeChecks = [
  { start: 'anesthesiaStart', end: 'anesthesiaEnd', field: 'anesthesiaEnd', message: '麻醉结束时间不能早于麻醉开始时间' },
  { start: 'surgeryStart', end: 'surgeryEnd', field: 'surgeryEnd', message: '手术结束时间不能早于手术开始时间' },
  { start: 'inductionStart', end: 'intubationTime', field: 'intubationTime', message: '插管时间不能早于麻醉诱导开始时间' },
  { start: 'surgeryEnd', end: 'extubationTime', field: 'extubationTime', message: '拔管时间不能早于手术结束时间' },
  { start: 'surgeryEnd', end: 'outRoomTime', field: 'outRoomTime', message: '出室时间不能早于手术结束时间' },
  { start: 'anesthesiaStart', end: 'surgeryStart', field: 'surgeryStart', message: '手术开始时间不能早于麻醉开始时间' },
];

export function calculateBMI(height, weight) {
  const h = Number(height);
  const w = Number(weight);
  if (!h || !w) return '';
  return (w / (h / 100) ** 2).toFixed(1);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function addClockMinutes(time, minutes) {
  const start = clockToMinutes(time);
  if (start === null) return '';
  return minutesToClock(start + Number(minutes || 0));
}

export function normalizeMedicationEditorPayload(form = {}) {
  const continuous = Boolean(form.continuous || form.endTime);
  const time = form.time || '';
  const startMinutes = clockToMinutes(time);
  const endMinutes = clockToMinutes(form.endTime);
  const endTime =
    continuous && startMinutes !== null && (endMinutes === null || endMinutes <= startMinutes)
      ? addClockMinutes(time, LIVE_DEFAULT_SEGMENT_MINUTES)
      : continuous
        ? form.endTime
        : '';
  return {
    id: form.id || '',
    name: form.name || '',
    time,
    endTime,
    dose: form.dose ?? form.amount ?? '',
    unit: form.unit || '',
    route: form.route || '',
    reason: form.reason || (continuous ? '持续用药' : '单次用药'),
    highAlert: Boolean(form.highAlert ?? highAlertMedicationNames.includes(form.name)),
  };
}

export function getBloodProductOption(product) {
  return bloodProductOptions.find((item) => item.product === product) || bloodProductOptions[0];
}

export function normalizeTransfusionEditorPayload(form = {}) {
  const option = getBloodProductOption(form.product || form.name);
  return {
    id: form.id || '',
    time: form.time || '',
    endTime: form.endTime || '',
    product: form.product || form.name || option.product,
    bagNo: form.bagNo || '',
    bloodType: form.bloodType || '',
    volume: toNumber(form.volume ?? form.amount ?? option.defaultVolume),
    unit: form.unit || option.unit,
    doubleCheck: Boolean(form.doubleCheck),
    reaction: form.reaction || '无',
  };
}

function compareTime(a, b) {
  if (!a || !b) return 0;
  return String(a).localeCompare(String(b));
}

export function validateTimeline(anesthesia = {}) {
  return timeChecks
    .filter((check) => anesthesia[check.start] && anesthesia[check.end] && compareTime(anesthesia[check.end], anesthesia[check.start]) < 0)
    .map((check) => ({
      field: check.field,
      message: check.message,
      start: anesthesia[check.start],
      end: anesthesia[check.end],
    }));
}

// 生命体征异常识别：评审演示里用于表格高亮、异常闭环和右侧质控提示。
export function detectAbnormalVitals(vitals = []) {
  return vitals.flatMap((row) =>
    abnormalRules
      .filter((rule) => {
        const value = Number(row[rule.field]);
        if (!Number.isFinite(value)) return false;
        if (rule.low !== null && value < rule.low) return true;
        if (rule.high !== null && value > rule.high) return true;
        return false;
      })
      .map((rule) => ({
        id: `${row.id || row.time}-${rule.field}`,
        rowId: row.id,
        time: row.time || '未填时间',
        metric: rule.metric,
        label: rule.label,
        field: rule.field,
        value: row[rule.field],
        suggestion: rule.suggestion,
        handled: Boolean(row.abnormalHandled?.[rule.field]),
        measure: row.abnormalHandled?.[rule.field] || '',
      })),
  );
}

export function calculateFluidBalance(record = {}) {
  const infusionTotal = (record.infusions || []).reduce((sum, item) => sum + toNumber(item.volume), 0);
  const transfusionTotal = (record.transfusions || []).reduce((sum, item) => sum + toNumber(item.volume), 0);
  const outputTotal = (record.outputs || []).reduce(
    (sum, item) => sum + toNumber(item.urine) + toNumber(item.bloodLoss) + toNumber(item.drainage) + toNumber(item.other),
    0,
  );
  const bloodLossTotal = (record.outputs || []).reduce((sum, item) => sum + toNumber(item.bloodLoss), 0);

  return {
    infusionTotal,
    transfusionTotal,
    inputTotal: infusionTotal + transfusionTotal,
    outputTotal,
    fluidBalance: infusionTotal + transfusionTotal - outputTotal,
    bloodLossTotal,
  };
}

function quality(status, item, message, target = '') {
  return { status, item, message, target };
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function missingAny(source, fields) {
  return fields.some((field) => !hasValue(source?.[field]));
}

// 完整性检查：前端原型用本地 state 表达 6 级评审关注的闭环、签名、留痕与归档前质控。
export function runQualityRules({ patient, record }) {
  if (!patient || !record) {
    return [quality('未通过', '是否已选择患者', '未选择患者，无法生成麻醉记录单', 'patient')];
  }

  const results = [];
  const anesthesia = record.anesthesia || {};
  const airway = record.airway || {};
  const recovery = record.recovery || {};
  const signatures = record.signatures || {};
  const abnormalVitals = detectAbnormalVitals(record.vitals || []);
  const unhandledAbnormal = abnormalVitals.filter((item) => !item.handled);
  const timelineIssues = validateTimeline(anesthesia);
  const highAlertMissing = (record.medications || []).filter((med) => med.highAlert && (!med.executor || !med.checker));
  const transfusionMissing = (record.transfusions || []).filter((item) => !item.doubleCheck);

  results.push(
    missingAny(patient, ['name', 'inpatientNo', 'diagnosis', 'plannedSurgery'])
      ? quality('未通过', '患者基本信息是否完整', '姓名、住院号、诊断、拟行手术为必填项', 'patient')
      : quality('通过', '患者基本信息是否完整', '患者身份与手术信息完整', 'patient'),
  );

  results.push(
    record.startedAt
      ? quality('通过', '是否已点击启动记录', `记录启动时间：${record.startedAt}`, 'anesthesia')
      : quality('未通过', '是否已点击启动记录', '请先点击顶部“启动记录”生成记录起点', 'anesthesia'),
  );

  results.push(
    anesthesia.method
      ? quality('通过', '麻醉方式是否填写', anesthesia.method, 'anesthesia')
      : quality('未通过', '麻醉方式是否填写', '请填写麻醉方式', 'anesthesia'),
  );

  results.push(
    anesthesia.anesthesiaStart && anesthesia.anesthesiaEnd
      ? quality('通过', '麻醉开始/结束时间是否完整', `${anesthesia.anesthesiaStart} - ${anesthesia.anesthesiaEnd}`, 'anesthesia')
      : quality('未通过', '麻醉开始/结束时间是否完整', '麻醉开始和结束时间均需填写', 'anesthesia'),
  );

  results.push(
    anesthesia.surgeryStart && anesthesia.surgeryEnd
      ? quality('通过', '手术开始/结束时间是否完整', `${anesthesia.surgeryStart} - ${anesthesia.surgeryEnd}`, 'anesthesia')
      : quality('未通过', '手术开始/结束时间是否完整', '手术开始和结束时间均需填写', 'anesthesia'),
  );

  results.push(
    timelineIssues.length
      ? quality('未通过', '关键时间顺序是否合理', timelineIssues.map((issue) => issue.message).join('；'), 'anesthesia')
      : quality('通过', '关键时间顺序是否合理', '关键时间节点顺序合理', 'anesthesia'),
  );

  if (airway.airwayMethod === '气管插管') {
    results.push(
      missingAny(airway, ['intubationTime', 'tubeModel', 'tubeDepth'])
        ? quality('未通过', '气管插管信息是否完整', '气管插管需填写插管时间、型号和深度', 'airway')
        : quality('通过', '气管插管信息是否完整', '插管时间、型号和深度完整', 'airway'),
    );
  } else {
    results.push(quality('警告', '是否填写插管时间或明确无需插管', '当前未选择气管插管，请确认麻醉方式与气道策略', 'airway'));
  }

  if (airway.extubationStatus === '带管入 PACU/ICU') {
    results.push(
      ['PACU', 'ICU'].includes(recovery.destination) && recovery.handoverNote
        ? quality('通过', '带管离室交接说明是否完整', '已记录带管去向与交接说明', 'recovery')
        : quality('未通过', '带管离室交接说明是否完整', '带管离室需填写 PACU/ICU 去向和交接说明', 'recovery'),
    );
  }

  results.push(
    (record.vitals || []).length
      ? quality('通过', '生命体征是否至少有一条', `已记录 ${(record.vitals || []).length} 条`, 'vitals')
      : quality('未通过', '生命体征是否至少有一条', '请至少新增一条生命体征记录', 'vitals'),
  );

  if (record.rescue?.active || record.rescue?.summary) {
    const rescueVitals = (record.vitals || []).filter((item) => item.rescue);
    results.push(
      rescueVitals.length
        ? quality('通过', '抢救期间是否至少有 1 条生命体征记录', `抢救记录 ${rescueVitals.length} 条`, 'vitals')
        : quality('未通过', '抢救期间是否至少有 1 条生命体征记录', '抢救模式下需至少记录 1 条生命体征', 'vitals'),
    );
    results.push(
      record.rescue?.summary?.course && record.rescue?.summary?.result
        ? quality('通过', '抢救经过和结果是否填写', '已填写抢救小结', 'events')
        : quality('未通过', '抢救经过和结果是否填写', '启动抢救模式后需填写抢救经过和抢救结果', 'events'),
    );
  }

  results.push(
    (record.medications || []).length
      ? quality('通过', '术中用药是否至少有一条', `已记录 ${(record.medications || []).length} 条用药`, 'medication')
      : quality('未通过', '术中用药是否至少有一条', '请至少记录一条术中用药', 'medication'),
  );

  results.push(
    highAlertMissing.length
      ? quality('未通过', '高警示药品是否有执行人和核对人', `有 ${highAlertMissing.length} 条高警示药品缺少双人核对`, 'medication')
      : quality('通过', '高警示药品是否有执行人和核对人', '高警示药品核对完整', 'medication'),
  );

  results.push(
    transfusionMissing.length
      ? quality('未通过', '输血记录是否有双人核对', `有 ${transfusionMissing.length} 条输血记录未双人核对`, 'medication')
      : quality('通过', '输血记录是否有双人核对', '输血记录双人核对完整或暂无输血', 'medication'),
  );

  results.push(
    missingAny(recovery, ['destination', 'handoverNurse', 'receiver'])
      ? quality('未通过', '离室信息是否完整', '离室去向、交接护士、接收人为必填项', 'recovery')
      : quality('通过', '离室信息是否完整', '离室复苏交接信息完整', 'recovery'),
  );

  if (record.device?.collectStatus === '采集异常') {
    results.push(
      record.device?.abnormalNote
        ? quality('通过', '采集异常说明是否填写', record.device.abnormalNote, 'device')
        : quality('未通过', '采集异常说明是否填写', '设备采集异常时需填写异常说明', 'device'),
    );
  }

  results.push(
    signatures.anesthesiologist
      ? quality('通过', '医师签名是否完成', signatures.anesthesiologist, 'signature')
      : quality('未通过', '医师签名是否完成', '请完成麻醉医师签名', 'signature'),
  );
  results.push(
    signatures.nurse
      ? quality('通过', '护士签名是否完成', signatures.nurse, 'signature')
      : quality('未通过', '护士签名是否完成', '请完成巡回护士签名', 'signature'),
  );
  results.push(
    unhandledAbnormal.length
      ? quality('未通过', '是否存在异常生命体征但未记录处理措施', `有 ${unhandledAbnormal.length} 项异常未闭环`, 'vitals')
      : quality('通过', '是否存在异常生命体征但未记录处理措施', '异常生命体征均已闭环或暂无异常', 'vitals'),
  );

  return results;
}

export function sortByTime(rows = []) {
  return [...rows].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
}

export function clockToMinutes(time) {
  if (!time) return null;
  const [hour, minute] = String(time).split(':').map(Number);
  if (![hour, minute].every(Number.isFinite)) return null;
  return hour * 60 + minute;
}

export function minutesToClock(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function calculateLiveSheetEnd(start = '11:00', times = [], minimumMinutes = 210, roundMinutes = 30) {
  const startMinutes = clockToMinutes(start) ?? 660;
  const latestTimes = times
    .flat()
    .map((time) => clockToMinutes(time))
    .filter((value) => value !== null);
  const defaultEnd = startMinutes + Number(minimumMinutes || 210);
  const latest = Math.max(defaultEnd, ...latestTimes);
  const step = Math.max(1, Number(roundMinutes) || 30);
  return minutesToClock(Math.ceil(latest / step) * step);
}

// 实时麻醉记录单使用统一时间轴：上方刻度、用药条、手术状态和生命体征曲线都按同一比例定位。
export function buildLiveTimeScale(start = '11:00', end = '14:30', minorInterval = 5, majorInterval = 30) {
  const startMinutes = clockToMinutes(start) ?? 0;
  const endMinutes = clockToMinutes(end) ?? startMinutes + 210;
  const safeEnd = endMinutes > startMinutes ? endMinutes : startMinutes + 210;
  const totalMinutes = safeEnd - startMinutes;
  const buildTicks = (interval) => {
    const ticks = [];
    for (let minute = startMinutes; minute <= safeEnd; minute += interval) {
      const offset = minute - startMinutes;
      ticks.push({
        time: minutesToClock(minute),
        label: minutesToClock(minute),
        percent: totalMinutes ? Number(((offset / totalMinutes) * 100).toFixed(2)) : 0,
      });
    }
    return ticks;
  };

  return {
    start: minutesToClock(startMinutes),
    end: minutesToClock(safeEnd),
    totalMinutes,
    minorInterval,
    majorInterval,
    minorTicks: buildTicks(minorInterval),
    majorTicks: buildTicks(majorInterval),
  };
}

export function timeToPercent(time, start = '11:00', end = '14:30') {
  const startMinutes = clockToMinutes(start);
  const endMinutes = clockToMinutes(end);
  const valueMinutes = clockToMinutes(time);
  if (startMinutes === null || endMinutes === null || valueMinutes === null || endMinutes <= startMinutes) return 0;
  const percent = ((valueMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
  return Number(Math.max(0, Math.min(100, percent)).toFixed(2));
}

export function percentToTime(percent, start = '11:00', end = '14:30', snapMinutes = 5) {
  const startMinutes = clockToMinutes(start);
  const endMinutes = clockToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return start;
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const raw = startMinutes + (safePercent / 100) * (endMinutes - startMinutes);
  const snap = Math.max(1, Number(snapMinutes) || 1);
  return minutesToClock(Math.round(raw / snap) * snap);
}

export function dragTimeSegment(segment, options) {
  const {
    mode,
    deltaPercent = 0,
    targetPercent = 0,
    sheetStart = '11:00',
    sheetEnd = '14:30',
    snapMinutes = 5,
    minDuration = 5,
  } = options || {};
  const startMinutes = clockToMinutes(segment?.start);
  const endMinutes = clockToMinutes(segment?.end);
  const rangeStart = clockToMinutes(sheetStart);
  const rangeEnd = clockToMinutes(sheetEnd);
  if ([startMinutes, endMinutes, rangeStart, rangeEnd].some((value) => value === null) || rangeEnd <= rangeStart) {
    return { start: segment?.start || sheetStart, end: segment?.end || sheetEnd };
  }

  const range = rangeEnd - rangeStart;
  const snap = Math.max(1, Number(snapMinutes) || 1);
  const minSpan = Math.max(snap, Number(minDuration) || snap);
  const snapMinute = (value) => Math.round(value / snap) * snap;
  let nextStart = startMinutes;
  let nextEnd = Math.max(endMinutes, startMinutes + minSpan);

  if (mode === 'move') {
    const deltaMinutes = snapMinute((Number(deltaPercent) / 100) * range);
    const duration = nextEnd - nextStart;
    nextStart = Math.max(rangeStart, Math.min(rangeEnd - duration, nextStart + deltaMinutes));
    nextEnd = nextStart + duration;
  }

  if (mode === 'start') {
    nextStart = clockToMinutes(percentToTime(targetPercent, sheetStart, sheetEnd, snap)) ?? nextStart;
    nextStart = Math.max(rangeStart, Math.min(nextStart, nextEnd - minSpan));
  }

  if (mode === 'end') {
    nextEnd = clockToMinutes(percentToTime(targetPercent, sheetStart, sheetEnd, snap)) ?? nextEnd;
    nextEnd = Math.min(rangeEnd, Math.max(nextEnd, nextStart + minSpan));
  }

  return {
    start: minutesToClock(snapMinute(nextStart)),
    end: minutesToClock(snapMinute(nextEnd)),
  };
}

export function formatMinutes(start, end) {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return '';
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes >= 0 ? `${minutes} 分钟` : '';
}
