<template>
  <div class="section-card device-card">
    <div class="card-title-row">
      <h2>设备采集状态 <span class="input-badge">设备采集占位</span></h2>
    </div>
    <div class="device-status-grid">
      <p><i :class="statusClass(device.monitor)"></i>监护仪：{{ device.monitor }}</p>
      <p><i :class="statusClass(device.anesthesiaMachine)"></i>麻醉机：{{ device.anesthesiaMachine }}</p>
      <p><i :class="statusClass(device.infusionPump)"></i>输注泵：{{ device.infusionPump }}</p>
      <p>数据来源：{{ device.dataSource }}</p>
      <p>最近采集：{{ device.lastCollectTime || '-' }}</p>
      <p>采集频率：{{ device.collectFrequency }}</p>
      <p>数据接收：{{ device.receiveStatus }}</p>
      <p>异常说明：{{ device.abnormalNote || '-' }}</p>
    </div>
    <div class="row-actions">
      <button class="btn small primary" :disabled="readOnly" @click="$emit('start')">启动采集</button>
      <button class="btn small" :disabled="readOnly" @click="$emit('pause')">暂停采集</button>
      <button class="btn small" :disabled="readOnly" @click="$emit('resume')">恢复采集</button>
      <button class="btn small" :disabled="readOnly" @click="$emit('manual')">手工补录</button>
      <button class="btn small" @click="$emit('logs')">查看采集日志</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  device: { type: Object, required: true },
  readOnly: Boolean,
});

defineEmits(['start', 'pause', 'resume', 'manual', 'logs']);

const statusClass = (value) => `device-dot ${String(value).replace(/\s+/g, '-')}`;
</script>
