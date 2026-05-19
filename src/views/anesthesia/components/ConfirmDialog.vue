<template>
  <ModalShell :title="title" @close="$emit('cancel')">
    <p class="confirm-message">{{ message }}</p>
    <template #footer>
      <button class="btn" @click="$emit('cancel')">{{ cancelText }}</button>
      <button class="btn danger" @click="$emit('confirm')">{{ confirmText }}</button>
    </template>
  </ModalShell>
</template>

<script setup>
import ModalShell from './ModalShell.vue';

defineProps({
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
});

defineEmits(['confirm', 'cancel']);
</script>
