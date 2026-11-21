<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import IndexSelector from '../components/IndexSelector.vue'
import MonitorSvg from '../components/MonitorSvg.vue'
import ManualInput from '../components/ManualInput.vue'
import DrawdownChart from '../components/DrawdownChart.vue'
import DrawdownEvents from '../components/DrawdownEvents.vue'
import { useIndexList } from '../composables/useIndexList'
import { useIndexData } from '../composables/useIndexData'
import { Icon } from '@iconify/vue'

const { categories, loading: listLoading, load } = useIndexList()
const {
  metrics, series, events, volatility, recentCloses, compareData, vix,
  status, statusError, debug, sourceNote, isHistorical,
  refresh, applyManual
} = useIndexData()

const selectedSymbol = ref('^NDX')
const asOfDate = ref('')
const compareSymbols = ref([])
const customSymbol = ref('')
const customName = ref('')
const customItems = ref([])
const loading = ref(false)
const manualOpen = ref(false)
const theme = ref(localStorage.getItem('monitor_theme') || 'dark')

const allItems = computed(() => [
  ...(categories.value.indices || []),
  ...(categories.value.stocks || []),
  ...customItems.value
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

const compareOptions = computed(() => {
  const groups = []
  const indices = (categories.value.indices || []).filter(i => i.symbol !== selectedSymbol.value)
  const stocks = (categories.value.stocks || []).filter(i => i.symbol !== selectedSymbol.value)
  const customs = customItems.value.filter(i => i.symbol !== selectedSymbol.value)
  if (indices.length) groups.push({ label: '指数', options: indices })
  if (stocks.length) groups.push({ label: '个股', options: stocks })
  if (customs.length) groups.push({ label: '自定义', options: customs })
  return groups
})

const compareLabels = computed(() =>
  compareSymbols.value.map(sym => {
    const found = allItems.value.find(i => i.symbol === sym)
    return { symbol: sym, name: found ? found.name : sym }
  })
)

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('monitor_theme', theme.value)
}

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
  scheduleRefresh()
}

function removeCompare(symbol) {
  compareSymbols.value = compareSymbols.value.filter(s => s !== symbol)
  scheduleRefresh()
}

function clearCompare() {
  compareSymbols.value = []
  compareData.value = []
}

function onAddCustom() {
  const sym = customSymbol.value.trim().toUpperCase()
  const name = customName.value.trim() || sym
  if (!sym) {
    alert('请输入 symbol')
    return
  }
  const existing = allItems.value.find(i => i.symbol === sym)
  if (existing) {
    selectedSymbol.value = sym
  } else {
    customItems.value.push({ symbol: sym, name })
    selectedSymbol.value = sym
  }
  customSymbol.value = ''
  customName.value = ''
  scheduleRefresh()
}

let refreshTimer = null
function scheduleRefresh() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => doRefresh(), 300)
}

async function doRefresh() {
  loading.value = true
  try {
    await refresh(selectedSymbol.value, asOfDate.value || null, compareSymbols.value)
  } finally {
    loading.value = false
  }
}

function onSymbolChange() {
  compareSymbols.value = compareSymbols.value.filter(s => s !== selectedSymbol.value)
  scheduleRefresh()
}

function onViewHistory() {
  scheduleRefresh()
}

function onBackToLatest() {
  asOfDate.value = ''
  scheduleRefresh()
}

function onManualSubmit(payload) {
  applyManual(payload)
}

watch(asOfDate, () => scheduleRefresh())

onMounted(async () => {
  await load()
  const firstIndex = categories.value.indices?.[0]
  if (firstIndex) selectedSymbol.value = firstIndex.symbol
  await doRefresh()
})
</script>

<template>
  <div class="flex flex-col items-center gap-4 px-4 py-8 w-full">
    <!-- 悬浮主题切换 -->
    <button
      class="fixed top-3 right-3 z-40 w-9 h-9 rounded-full border border-gold/30 bg-navy-bg/70 backdrop-blur text-gold/80 flex items-center justify-center shadow-lg hover:bg-gold hover:text-navy-bg hover:border-gold transition-all duration-200"
      :title="theme === 'dark' ? '切换到浅色' : '切换到深色'"
      @click="toggleTheme"
    >
      <Icon :icon="theme === 'dark' ? 'mdi:weather-sunny' : 'mdi:weather-night'" width="16" height="16" />
    </button>

    <IndexSelector
      v-model="selectedSymbol"
      :categories="categories"
      :loading="listLoading"
      @change="onSymbolChange"
    />

    <!-- 历史日期 + 快捷按钮 -->
    <div class="w-full max-w-2xl flex flex-col gap-2">
      <div class="flex flex-wrap gap-2 justify-center items-center">
        <label class="text-gold text-sm">历史日期：</label>
        <input
          v-model="asOfDate"
          type="date"
          :max="new Date().toISOString().slice(0, 10)"
          class="px-3 py-2 rounded-md border border-gold/30 bg-navy-bg text-gold text-sm"
        />
        <button
          v-if="isHistorical"
          class="px-4 py-2 rounded-md border border-gold/50 bg-navy-card/60 text-gold/80 text-sm hover:bg-gold hover:text-navy-bg transition-colors"
          @click="onBackToLatest"
        >
          回到最新
        </button>
        <button
          class="px-4 py-2 rounded-md border border-gold bg-navy-card text-gold text-sm hover:bg-gold hover:text-navy-bg transition-colors"
          @click="onViewHistory"
        >
          刷新
        </button>
      </div>
    </div>

    <!-- 对比标的：chip 标签 -->
    <div class="w-full max-w-2xl bg-navy-card/40 border border-gold/30 rounded-xl p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-gold text-sm font-bold">对比标的（最多3个）</span>
        <button
          v-if="compareSymbols.length"
          class="px-3 py-1 rounded-md border border-gold/50 bg-navy-card/60 text-gold/80 text-xs hover:bg-gold hover:text-navy-bg transition-colors"
          @click="clearCompare"
        >
          清除全部
        </button>
      </div>

      <div v-if="compareLabels.length" class="flex flex-wrap gap-2 mb-2">
        <span
          v-for="c in compareLabels"
          :key="c.symbol"
          class="flex items-center gap-1 px-3 py-1 rounded-full border border-gold bg-gold/15 text-gold text-xs"
        >
          {{ c.name }}
          <button
            class="w-4 h-4 rounded-full hover:bg-gold hover:text-navy-bg transition-colors"
            @click="removeCompare(c.symbol)"
            aria-label="移除"
          >×</button>
        </span>
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
    </div>

    <!-- 自定义标的 + 手动录入：折叠 -->
    <details class="w-full max-w-2xl bg-navy-card/40 border border-gold/30 rounded-xl p-3">
      <summary class="text-gold text-sm font-bold cursor-pointer">高级：自定义标的 / 手动录入</summary>
      <div class="flex flex-col gap-3 mt-3">
        <div class="flex flex-wrap gap-2 justify-center items-center">
          <label class="text-gold text-sm">自定义标的：</label>
          <input
            v-model="customSymbol"
            type="text"
            placeholder="Symbol，如 BABA"
            class="px-3 py-2 rounded-md border border-gold/30 bg-navy-bg text-gold text-sm w-40"
          />
          <input
            v-model="customName"
            type="text"
            placeholder="名称（可选）"
            class="px-3 py-2 rounded-md border border-gold/30 bg-navy-bg text-gold text-sm w-40"
          />
          <button
            class="px-4 py-2 rounded-md border border-gold bg-navy-card text-gold text-sm hover:bg-gold hover:text-navy-bg transition-colors"
            @click="onAddCustom"
          >
            查询
          </button>
        </div>
        <ManualInput @submit="onManualSubmit" />
      </div>
    </details>

    <div class="text-sm text-center min-h-[20px]" :class="statusError ? 'text-red-400' : 'text-gold'">
      {{ status }}
    </div>
    <div class="text-[11px] text-gold/40 text-center max-w-[800px] break-all">
      {{ debug }}
    </div>

    <MonitorSvg
      :title="selectedName + (isHistorical ? ' 历史快照' : ' 回撤与修复监控')"
      :symbol-label="'代码 ' + selectedSymbol"
      :metrics="metrics"
      :volatility="volatility"
      :recent-closes="recentCloses"
      :source-note="sourceNote"
      :max-drawdown-text="maxDrawdownText"
      :theme="theme"
      :vix="vix"
      :loading="loading"
      :events="events"
    />

    <DrawdownChart :series="series" :compare-data="compareData" />
    <DrawdownEvents :events="events" />
  </div>
</template>