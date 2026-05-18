import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildLiveTimeScale,
  bloodProductOptions,
  calculateLiveSheetEnd,
  calculateBMI,
  calculateFluidBalance,
  detectAbnormalVitals,
  dragTimeSegment,
  LIVE_TIME_STEP_MINUTES,
  LIVE_DEFAULT_SEGMENT_MINUTES,
  normalizeMedicationEditorPayload,
  normalizeTransfusionEditorPayload,
  percentToTime,
  runQualityRules,
  timeToPercent,
  validateTimeline,
} from './anesthesiaRecordHelpers.js';

describe('麻醉记录单核心规则', () => {
  it('根据身高体重自动计算 BMI', () => {
    assert.equal(calculateBMI(170, 65), '22.5');
    assert.equal(calculateBMI('', 65), '');
  });

  it('识别异常生命体征并给出处置建议', () => {
    const abnormalities = detectAbnormalVitals([
      { time: '09:00', sbp: 82, dbp: 48, hr: 132, rr: 7, spo2: 91, etco2: 52, temp: 34.8, bis: 68 },
      { time: '09:05', sbp: 118, dbp: 70, hr: 78, rr: 14, spo2: 99, etco2: 38, temp: 36.4, bis: 48 },
    ]);

    assert.equal(abnormalities.length, 8);
    assert.equal(abnormalities[0].metric, 'SBP');
    assert.match(abnormalities[0].suggestion, /血压/);
  });

  it('自动计算总入量、总出量和液体平衡', () => {
    const balance = calculateFluidBalance({
      infusions: [{ volume: 500 }, { volume: 250 }],
      transfusions: [{ volume: 300 }],
      outputs: [{ urine: 120, bloodLoss: 80, drainage: 20, other: 0 }],
    });

    assert.deepEqual(balance, {
      infusionTotal: 750,
      transfusionTotal: 300,
      inputTotal: 1050,
      outputTotal: 220,
      fluidBalance: 830,
      bloodLossTotal: 80,
    });
  });

  it('校验关键时间顺序异常', () => {
    const issues = validateTimeline({
      anesthesiaStart: '10:00',
      anesthesiaEnd: '09:50',
      inductionStart: '10:05',
      intubationTime: '10:01',
      surgeryStart: '09:55',
      surgeryEnd: '11:00',
      extubationTime: '10:45',
      outRoomTime: '10:50',
    });

    assert.equal(issues.length, 5);
    assert.ok(issues.some((issue) => issue.field === 'anesthesiaEnd'));
    assert.ok(issues.some((issue) => issue.field === 'surgeryStart'));
  });

  it('签名前完整性检查会阻止关键缺项和未闭环异常', () => {
    const results = runQualityRules({
      patient: { name: '测试患者', inpatientNo: 'ZY001', diagnosis: '测试诊断', plannedSurgery: '测试手术' },
      record: {
        status: '记录中',
        startedAt: '',
        anesthesia: { method: '全身麻醉', anesthesiaStart: '10:00', anesthesiaEnd: '', surgeryStart: '10:20', surgeryEnd: '' },
        airway: { airwayMethod: '气管插管', intubationTime: '', tubeModel: '', tubeDepth: '' },
        vitals: [{ time: '10:25', sbp: 82, dbp: 48, hr: 132, rr: 8, spo2: 92, etco2: 35, temp: 36, bis: 45 }],
        medications: [],
        transfusions: [],
        recovery: { destination: '', handoverNurse: '', receiver: '' },
        signatures: { anesthesiologist: '', nurse: '' },
        rescue: { active: false, summary: null },
        events: [],
      },
    });

    assert.ok(results.some((item) => item.status === '未通过' && item.item.includes('启动记录')));
    assert.ok(results.some((item) => item.status === '未通过' && item.item.includes('术中用药')));
    assert.ok(results.some((item) => item.status === '未通过' && item.item.includes('异常生命体征')));
  });
});

describe('live anesthesia sheet timeline helpers', () => {
  it('builds major and minor ticks for a paper-like realtime sheet', () => {
    const scale = buildLiveTimeScale('11:00', '14:30', 5, 30);

    assert.equal(scale.start, '11:00');
    assert.equal(scale.end, '14:30');
    assert.equal(scale.minorTicks.length, 43);
    assert.deepEqual(
      scale.majorTicks.map((tick) => tick.label),
      ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30'],
    );
  });

  it('maps record times to clamped horizontal percentages', () => {
    assert.equal(timeToPercent('12:45', '11:00', '14:30'), 50);
    assert.equal(timeToPercent('10:30', '11:00', '14:30'), 0);
    assert.equal(timeToPercent('15:00', '11:00', '14:30'), 100);
  });

  it('converts drag percentages back to snapped times', () => {
    assert.equal(percentToTime(50, '11:00', '14:30', 5), '12:45');
    assert.equal(percentToTime(51, '11:00', '14:30', 10), '12:50');
  });

  it('drags a realtime line segment and preserves edits as start/end times', () => {
    assert.deepEqual(
      dragTimeSegment({ start: '11:00', end: '12:00' }, { mode: 'move', deltaPercent: 14.29, sheetStart: '11:00', sheetEnd: '14:30', snapMinutes: 5 }),
      { start: '11:30', end: '12:30' },
    );
    assert.deepEqual(
      dragTimeSegment({ start: '11:00', end: '12:00' }, { mode: 'end', targetPercent: 50, sheetStart: '11:00', sheetEnd: '14:30', snapMinutes: 5 }),
      { start: '11:00', end: '12:45' },
    );
  });

  it('uses one-minute precision for realtime medication and monitor shortcuts', () => {
    assert.equal(LIVE_TIME_STEP_MINUTES, 1);
    assert.equal(LIVE_DEFAULT_SEGMENT_MINUTES, 10);
    assert.equal(percentToTime(50, '11:00', '14:30', LIVE_TIME_STEP_MINUTES), '12:45');
  });

  it('normalizes continuous medication editor data into a drawable segment', () => {
    assert.deepEqual(
      normalizeMedicationEditorPayload({
        id: '',
        name: '右美托咪定',
        time: '12:13',
        endTime: '',
        dose: 100,
        unit: 'ug',
        route: '静脉注射',
        continuous: true,
      }),
      {
        id: '',
        name: '右美托咪定',
        time: '12:13',
        endTime: '12:23',
        dose: 100,
        unit: 'ug',
        route: '静脉注射',
        reason: '持续用药',
        highAlert: true,
      },
    );

    assert.equal(
      normalizeMedicationEditorPayload({
        name: '瑞芬太尼',
        time: '12:30',
        endTime: '12:20',
        dose: 0.1,
        unit: 'ug/kg·min',
        route: '泵入',
        continuous: true,
      }).endTime,
      '12:40',
    );
  });

  it('maps blood products to their clinical units', () => {
    assert.deepEqual(
      bloodProductOptions.map((item) => [item.product, item.unit]),
      [
        ['血小板', '治疗量'],
        ['白细胞', '袋'],
        ['悬浮红细胞', 'U'],
        ['红细胞', 'U'],
        ['冷沉淀', 'U'],
      ],
    );

    assert.deepEqual(
      normalizeTransfusionEditorPayload({ product: '血小板', time: '12:10', volume: 1, bagNo: 'B001', bloodType: 'A+' }),
      {
        id: '',
        time: '12:10',
        endTime: '',
        product: '血小板',
        bagNo: 'B001',
        bloodType: 'A+',
        volume: 1,
        unit: '治疗量',
        anesthesiaConfirm: false,
        circulatingConfirm: false,
        doubleCheck: false,
        reaction: '无',
      },
    );
  });

  it('extends the live sheet beyond the default 3.5 hours when records exceed the range', () => {
    assert.equal(calculateLiveSheetEnd('11:00', ['12:00', '14:20']), '14:30');
    assert.equal(calculateLiveSheetEnd('11:00', ['14:55']), '15:00');
    assert.equal(calculateLiveSheetEnd('11:00', ['15:01']), '15:30');
  });
});
