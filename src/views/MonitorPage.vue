<script setup>
import { ref, computed, onMounted } from 'vue'
import IndexSelector from '../components/IndexSelector.vue'
import MonitorSvg from '../components/MonitorSvg.vue'
import ManualInput from '../components/ManualInput.vue'
import { useIndexList } from '../composables/useIndexList'
import { useIndexData } from '../composables/useIndexData'

const { categories, loading: listLoading, load } = useIndexList()
const { metrics, status, statusError, debug, sourceNote, refresh, applyManual } = useIndexData()

const selectedSymbol = ref('^NDX')

const allItems = computed(() => [
  ...(categories.value.indices || []),
  ...(categories.value.stocks || [])
])

const selectedName = computed(() => {
  const found = allItems.value.find((i) => i.symbol === selectedSymbol.value)
  return found ? found.name : selectedSymbol.value
})

const isIndex = computed(() =>
  (categories.value.indices || []).some((i) => i.symbol === selectedSymbol.value)
)

const maxDrawdownText = computed(() => {
  if (isIndex.value) {
    if (selectedSymbol.value === '^GSPC') {
      return '最大回撤 -86.00%（1929-09-16 至 1932-06-01，参考值）'
    }
    return '最大回撤 -83.00%（2000-03-27 至 2002-10-09，参考值）'
  }
  return '个股最大回撤请参考本地缓存计算'
})

async function onSymbolChange() {
  await refresh(selectedSymbol.value)
}

onMounted(async () => {
  await load()
  const firstIndex = categories.value.indices?.[0]
  if (firstIndex) selectedSymbol.value = firstIndex.symbol
  await refresh(selectedSymbol.value)
})
</script>

<template>
  <div class="flex flex-col items-center gap-4 px-4 py-8 w-full">
    <IndexSelector
      v-model="selectedSymbol"
      :categories="categories"
      :loading="listLoading"
      @change="onSymbolChange"
    />

    <div
      class="text-sm text-center min-h-[20px]"
      :class="statusError ? 'text-red-400' : 'text-gold'"
    >
      {{ status }}
    </div>
    <div class="text-[11px] text-gold/40 text-center max-w-[800px] break-all">
      {{ debug }}
    </div>

    <ManualInput @submit="applyManual" />

    <MonitorSvg
      :title="selectedName + ' 回撤与修复监控'"
      :symbol-label="'代码 ' + selectedSymbol"
      :metrics="metrics"
      :source-note="sourceNote"
      :max-drawdown-text="maxDrawdownText"
    />
  </div>
</template>