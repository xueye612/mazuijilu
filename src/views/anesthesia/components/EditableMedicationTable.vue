<template>
  <div class="table-scroll">
    <table class="editable-table">
      <thead>
        <tr>
          <th v-for="head in headers" :key="head">{{ head }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" :class="{ 'high-alert-row': row.highAlert }">
          <td><input v-model="row.time" type="time" :disabled="readOnly" v-bind="auditBindings(row, 'time')" /></td>
          <td><input v-model="row.name" :disabled="readOnly" v-bind="auditBindings(row, 'name')" /></td>
          <td><input v-model="row.dose" type="number" :disabled="readOnly" v-bind="auditBindings(row, 'dose')" /></td>
          <td><input v-model="row.unit" :disabled="readOnly" v-bind="auditBindings(row, 'unit')" /></td>
          <td><input v-model="row.route" :disabled="readOnly" v-bind="auditBindings(row, 'route')" /></td>
          <td><input v-model="row.reason" :disabled="readOnly" /></td>
          <td><input v-model="row.executor" :disabled="readOnly" v-bind="auditBindings(row, 'executor')" /></td>
          <td><input v-model="row.checker" :disabled="readOnly" v-bind="auditBindings(row, 'checker')" /></td>
          <td><input v-model="row.highAlert" type="checkbox" :disabled="readOnly" @change="emitBooleanChange(row, 'highAlert')" /></td>
          <td><input v-model="row.remark" :disabled="readOnly" /></td>
          <td class="table-actions">
            <button :disabled="readOnly" @click="$emit('copy', row)">复制</button>
            <button :disabled="readOnly" @click="$emit('event', row)">事件</button>
            <button :disabled="readOnly" @click="$emit('remove', row.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  rows: { type: Array, default: () => [] },
  readOnly: Boolean,
});

const emit = defineEmits(['copy', 'remove', 'event', 'field-focus', 'field-change']);
const headers = ['时间', '药品名称', '剂量', '单位', '途径', '给药原因', '执行人', '核对人', '高警示', '备注', '操作'];

function auditBindings(row, field) {
  return {
    onFocus: (event) => emit('field-focus', { rowId: row.id, field, value: event.target.value }),
    onChange: (event) => emit('field-change', { rowId: row.id, field, value: event.target.value }),
  };
}

function emitBooleanChange(row, field) {
  emit('field-change', { rowId: row.id, field, value: row[field] ? '是' : '否' });
}
</script>
