import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('anesthesia record component quality boundaries', () => {
  it('keeps shared UI components outside the oversized record sheet', () => {
    const component = readSource('./AnesthesiaRecordSheet.vue');

    assert.match(component, /import ModalShell from '\.\/components\/ModalShell\.vue'/);
    assert.match(component, /import ConfirmDialog from '\.\/components\/ConfirmDialog\.vue'/);
    assert.match(component, /import DeviceStatusCard from '\.\/components\/DeviceStatusCard\.vue'/);
    assert.match(component, /import EditableMedicationTable from '\.\/components\/EditableMedicationTable\.vue'/);
    assert.ok(existsSync(new URL('./components/ModalShell.vue', import.meta.url)));
    assert.ok(existsSync(new URL('./components/ConfirmDialog.vue', import.meta.url)));
    assert.ok(existsSync(new URL('./components/DeviceStatusCard.vue', import.meta.url)));
    assert.ok(existsSync(new URL('./components/EditableMedicationTable.vue', import.meta.url)));
    assert.doesNotMatch(component, /const ModalShell = defineComponent/);
    assert.doesNotMatch(component, /const DeviceStatusCard = defineComponent/);
    assert.doesNotMatch(component, /const EditableMedicationTable = defineComponent/);
  });

  it('uses in-app feedback instead of blocking browser dialogs', () => {
    const recordSheet = readSource('./AnesthesiaRecordSheet.vue');
    const liveSheet = readSource('./AnesthesiaLiveSheet.vue');

    assert.doesNotMatch(recordSheet, /window\.confirm/);
    assert.match(recordSheet, /requestConfirm\(/);
    assert.doesNotMatch(liveSheet, /window\.alert/);
    assert.match(liveSheet, /monitorFormError/);
  });

  it('persists draft data locally instead of keeping it only in memory', () => {
    const recordSheet = readSource('./AnesthesiaRecordSheet.vue');

    assert.match(recordSheet, /DRAFT_STORAGE_KEY/);
    assert.match(recordSheet, /localStorage\.setItem/);
    assert.match(recordSheet, /readStoredDraft/);
    assert.match(recordSheet, /watch\(patients/);
  });

  it('cleans up pointer drag listeners when the live sheet unmounts', () => {
    const liveSheet = readSource('./AnesthesiaLiveSheet.vue');

    assert.match(liveSheet, /onUnmounted/);
    assert.match(liveSheet, /registerDragCleanup/);
    assert.match(liveSheet, /cleanupDragListeners/);
  });
});
