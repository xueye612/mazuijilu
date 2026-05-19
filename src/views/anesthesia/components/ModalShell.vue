<template>
  <div class="modal-backdrop">
    <div :class="['modal-card', { wide }]">
      <div class="modal-head">
        <h3>{{ title }}</h3>
        <button @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
      <div class="modal-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: String,
  wide: Boolean,
});

defineEmits(['close']);
</script>
