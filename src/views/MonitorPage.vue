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
const compareSymbols = ref([])   // 多选对比标的

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

// 对比可选项：排除主标的
const compareOptions = computed(() => {
  const groups = []
  const indices = (categories.value.indices || []).filter(i => i.symbol !== selectedSymbol.value)
  const stocks = (categories.value.stocks || []).filter(i => i.symbol !== selectedSymbol.value)
  if (indices.length) groups.push({ label: '指数', options: indices })
  if (stocks.length) groups.push({ label: '个股', options: stocks })
  return groups
})

function toggleCompare(symbol) {
  const idx = compareSymbols.value.indexOf(symbol)
  if (idx >= 0) {
    compareSymbols.value.splice(idx, 1)
  } else {
    if (compareSymbols.value.length >= 3) {
      alert('最多选择 3 个对比标的')
      return
    }
    compareSymbols.value.push(symbol)
  }
}

function clearCompare() {
  compareSymbols.value = []
  compareData.value = []
}

async function onSymbolChange() {
  compareSymbols.value = compareSymbols.value.filter(s => s !== selectedSymbol.value)
  await refresh(selectedSymbol.value, asOfDate.value || null, compareSymbols.value)
}

async function onViewHistory() {
  await refresh(selectedSymbol.value, asOfDate.value || null, compareSymbols.value)
}

async function onBackToLatest() {
  asOfDate.value = ''
  await refresh(selectedSymbol.value, null, compareSymbols.value)
}

async function onLoadCompare() {
  await refresh(selectedSymbol.value, asOfDate.value || null, compareSymbols.value)
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
      <input
        v-model="asOfDate"
        type="date"
        class="px-3 py-2 rounded-md border border-gold/30 bg-navy-bg text-gold text-sm"
      />
      <button
        class="px-4 py-2 rounded-md border border-gold bg-navy-card text-gold text-sm hover:bg-gold hover:text-navy-bg transition-colors"
        @click="onViewHistory"
      >
        查看该日
      </button>
      <button
        v-if="isHistorical"
        class="px-4 py-2 rounded-md border border-gold/50 bg-navy-card/60 text-gold/80 text-sm hover:bg-gold hover:text-navy-bg transition-colors"
        @click="onBackToLatest"
      >
        回到最新
      </button>
    </div>

    <!-- 对比标的：checkbox 列表 -->
    <div class="w-full max-w-2xl bg-navy-card/40 border border-gold/30 rounded-xl p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-gold text-sm font-bold">对比标的（最多3个）</span>
        <div class="flex gap-2">
          <button
            class="px-3 py-1 rounded-md border border-gold bg-navy-card text-gold text-xs hover:bg-gold hover:text-navy-bg transition-colors"
            @click="onLoadCompare"
          >
            加载对比
          </button>
          <button
            class="px-3 py-1 rounded-md border border-gold/50 bg-navy-card/60 text-gold/80 text-xs hover:bg-gold hover:text-navy-bg transition-colors"
            :disabled="!compareSymbols.length"
            @click="clearCompare"
          >
            清除对比
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div v-for="g in compareOptions" :key="g.label">
          <div class="text-gold/60 text-xs mb-1">{{ g.label }}</div>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="item in g.options"
              :key="item.symbol"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors"
              :class="compareSymbols.includes(item.symbol)
                ? 'border-gold bg-gold/15 text-gold'
                : 'border-gold/25 bg-navy-bg/60 text-gold/70'"
            >
              <input
                type="checkbox"
                class="accent-yellow-400"
                :checked="compareSymbols.includes(item.symbol)"
                @change="toggleCompare(item.symbol)"
              />
              <span>{{ item.name }}</span>
              <span class="text-gold/40">{{ item.symbol }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="text-gold/60 text-xs mt-2">
        已选：{{ compareSymbols.length ? compareSymbols.join(', ') : '无' }}
      </div>
    </div>

    <div class="text-sm text-center min-h-[20px]" :class="statusError ? 'text-red-400' : 'text-gold'">
      {{ status }}
    </div>
    <div class="text-[11px] text-gold/40 text-center max-w-[800px] break-all">
      {{ debug }}
    </div>

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