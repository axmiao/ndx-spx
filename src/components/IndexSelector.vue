<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  categories: { type: Object, required: true },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'change'])

const groups = computed(() => [
  { label: '指数', options: props.categories.indices || [] },
  { label: '个股', options: props.categories.stocks || [] }
])

function onChange(e) {
  emit('update:modelValue', e.target.value)
  emit('change', e.target.value)
}
</script>

<template>
  <div class="flex flex-wrap gap-3 justify-center items-center w-full max-w-2xl">
    <label class="text-gold text-sm">选择标的：</label>
    <select
      :value="modelValue"
      :disabled="loading"
      class="px-4 py-2 rounded-lg border border-gold/50 bg-navy-bg text-gold text-sm min-w-[220px]"
      @change="onChange"
    >
      <optgroup v-for="g in groups" :key="g.label" :label="g.label">
        <option v-for="item in g.options" :key="item.symbol" :value="item.symbol">
          {{ item.name }}（{{ item.symbol }}）
        </option>
      </optgroup>
    </select>
    <span v-if="loading" class="text-gold/60 text-xs">加载中…</span>
  </div>
</template>