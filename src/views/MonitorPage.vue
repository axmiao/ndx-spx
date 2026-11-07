<script setup>
import { ref, computed, onMounted } from 'vue'
import IndexSelector from '../components/IndexSelector.vue'
import MonitorSvg from '../components/MonitorSvg.vue'
import ManualInput from '../components/ManualInput.vue'
import DrawdownChart from '../components/DrawdownChart.vue'
import DrawdownEvents from '../components/DrawdownEvents.vue'
import { useIndexList } from '../composables/useIndexList'
import { useIndexData } from '../composables/useIndexData'

const { categories, loading: listLoading, load } = useIndexList()
const {
  metrics, series, events, volatility, compareData,
  status, statusError, debug, sourceNote, isHistorical,
  refresh, applyManual
} = useIndexData()

const selectedSymbol = ref('^NDX')
const asOfDate = ref('')
const compareInput = ref('^GSPC')

const allItems = computed(() => [
  ...(categories.value.indices || []),
  ...(categories.value.stocks || [])
])
const selectedName = computed(() => {
  const found = allItems.value.find(i => i.symbol === selectedSymbol.value)
  return found ? found.name : selectedSymbol.value
})
const isIndex = computed(() =>
  (categories.value.indices || []).some(i => i.symbol === selectedSymbol.value)
)
const maxDrawdownText = computed(() => {
  if (isIndex.value) {
    if (selectedSymbol.value === '^GSPC') return '最大回撤 -86.00%（1929-09-16 至 1932-06-01，参考值）'
    return '最大回撤 -83.00%（2000-03-27 至 2002-10-09，参考值）'
  }
  return '个股最大回撤请参考本地缓存计算'
})

function parseCompare() {
  return compareInput.value
    .split(/[,，\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => s !== selectedSymbol.value)
}

async function onSymbolChange() {
  await refresh(selectedSymbol.value, asOfDate.value || null, parseCompare())
}
async function onViewHistory() {
  await refresh(selectedSymbol.value, asOfDate.value || null, parseCompare())
}
async function onBackToLatest() {
  asOfDate.value = ''
  await refresh(selectedSymbol.value, null, parseCompare())
}

onMounted(async () => {
  await load()
  const firstIndex = categories.value.indices?.[0]
  if (firstIndex) selectedSymbol.value = firstIndex.symbol
  await refresh(selectedSymbol.value, null, [])
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

    <div class="flex flex-wrap gap-2 justify-center items-center w-full max-w-2xl">
      <label class="text-gold text-sm">历史日期：</label>
      <input v-model="asOfDate" type="date" class="px-3 py-2 rounded-md border border-gold/30 bg-navy-bg text-gold text-sm" />
      <button class="px-4 py-2 rounded-md border border-gold bg-navy-card text-gold text-sm hover:bg-gold hover:text-navy-bg transition-colors" @click="onViewHistory">查看该日</button>
      <button v-if="isHistorical" class="px-4 py-2 rounded-md border border-gold/50 bg-navy-card/60 text-gold/80 text-sm hover:bg-gold hover:text-navy-bg transition-colors" @click="onBackToLatest">回到最新</button>
    </div>

    <div class="flex flex-wrap gap-2 justify-center items-center w-full max-w-2xl">
      <label class="text-gold text-sm">对比标的：</label>
      <input v-model="compareInput" type="text" placeholder="如 ^GSPC,AAPL" class="px-3 py-2 rounded-md border border-gold/30 bg-navy-bg text-gold text-sm w-48" />
      <button class="px-4 py-2 rounded-md border border-gold bg-navy-card text-gold text-sm hover:bg-gold hover:text-navy-bg transition-colors" @click="onSymbolChange">加载对比</button>
    </div>

    <div class="text-sm text-center min-h-[20px]" :class="statusError ? 'text-red-400' : 'text-gold'">{{ status }}</div>
    <div class="text-[11px] text-gold/40 text-center max-w-[800px] break-all">{{ debug }}</div>

    <ManualInput @submit="applyManual" />

    <MonitorSvg
      :title="selectedName + (isHistorical ? ' 历史快照' : ' 回撤与修复监控')"
      :symbol-label="'代码 ' + selectedSymbol"
      :metrics="metrics"
      :volatility="volatility"
      :source-note="sourceNote"
      :max-drawdown-text="maxDrawdownText"
    />

    <DrawdownChart :series="series" :compare-data="compareData" />
    <DrawdownEvents :events="events" />
  </div>
</template>