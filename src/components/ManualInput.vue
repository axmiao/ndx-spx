<script setup>
import { ref } from 'vue'

const emit = defineEmits(['submit'])
const date = ref(new Date().toISOString().slice(0, 10))
const close = ref('')

function onSubmit() {
  const c = parseFloat(close.value)
  emit('submit', { date: date.value, close: c })
  close.value = ''
}
</script>

<template>
  <div class="flex gap-2 flex-wrap justify-center items-center w-full max-w-2xl">
    <input
      v-model="date"
      type="date"
      class="px-3 py-2 rounded-md border border-gold/30 bg-navy-bg text-gold text-sm"
    />
    <input
      v-model="close"
      type="number"
      step="0.01"
      placeholder="收盘价"
      class="px-3 py-2 rounded-md border border-gold/30 bg-navy-bg text-gold text-sm w-36"
    />
    <button
      class="px-4 py-2 rounded-md border border-gold bg-navy-card text-gold text-sm hover:bg-gold hover:text-navy-bg transition-colors"
      @click="onSubmit"
    >
      录入并更新
    </button>
  </div>
</template>