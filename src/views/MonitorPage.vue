<script setup>
import { ref, computed, onMounted } from 'vue'
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
  metrics, series, events, volatility, compareData, recentCloses,vix,
  status, statusError, debug, sourceNote, isHistorical,
  refresh, applyManual
} = useIndexData()

const theme = ref(localStorage.getItem('monitor_theme') || 'dark')
function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('monitor_theme', theme.value)
}

const selectedSymbol = ref('^NDX')
const asOfDate = ref('')
const compareSymbols = ref([])

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

// ====== 日期快捷按钮 ======
function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

const shortcuts = [
  {
    label: '昨天',
    getDate: () => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      return toDateStr(d)
    }
  },
  {
    label: '上周',
    getDate: () => {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      return toDateStr(d)
    }
  },
  {
    label: '上月',
    getDate: () => {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      return toDateStr(d)
    }
  },
  {
    label: '年初',
    getDate: () => {
      const y = new Date().getFullYear()
      return `${y}-01-01`
    }
  },
  {
    label: '52周低点',
    getDate: () => {
      // 用当前主标的的 series 找近52周最低点日期；没有 series 时回退为一年前
      const s = series.value
      if (s && s.length) {
        const oneYearAgo = Date.now() / 1000 - 365 * 86400
        const recent = s.filter(p => p.t >= oneYearAgo)
        if (recent.length) {
          let min = recent[0]
          for (const p of recent) if (p.dd < min.dd) min = p
          // series 里存的是回撤，低点对应回撤最深的那天
          // 需要从 bars 拿日期，这里用回撤点的时间戳近似
          return toDateStr(new Date(min.t * 1000))
        }
      }
      const d = new Date()
      d.setDate(d.getDate() - 365)
      return toDateStr(d)
    }
  }
]

async function onShortcut(item) {
  asOfDate.value = item.getDate()
  await refresh(selectedSymbol.value, asOfDate.value, compareSymbols.value)
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
    <!-- 主题切换小图标 -->
    <button
      class="fixed top-3 right-3 z-40 w-9 h-9 rounded-full border border-gold/30 bg-navy-bg/70 backdrop-blur text-gold/80 flex items-center justify-center shadow-lg hover:bg-gold hover:text-navy-bg hover:border-gold transition-all duration-200"
      :title="theme === 'dark' ? '切换到浅色' : '切换到深色'"
      @click="toggleTheme"
    >
      <Icon
        :icon="theme === 'dark' ? 'mdi:weather-sunny' : 'mdi:weather-night'"
        width="16"
        height="16"
      />
    </button>
    <IndexSelector
      v-model="selectedSymbol"
      :categories="categories"
      :loading="listLoading"
      @change="onSymbolChange"
    />

    <!-- 日期选择 + 快捷按钮 -->
    <div class="w-full max-w-2xl flex flex-col gap-2">
      <div class="flex flex-wrap gap-2 justify-center items-center">
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

      <div class="flex flex-wrap gap-2 justify-center">
        <button
          v-for="s in shortcuts"
          :key="s.label"
          class="px-3 py-1.5 rounded-md border border-gold/40 bg-navy-bg/60 text-gold/85 text-xs hover:bg-gold hover:text-navy-bg transition-colors"
          @click="onShortcut(s)"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- 对比标的 -->
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
      :recent-closes="recentCloses"
      :source-note="sourceNote"
      :max-drawdown-text="maxDrawdownText"
      :theme="theme"
      :vix="vix"
    />

    <DrawdownChart :series="series" :compare-data="compareData" />
    <DrawdownEvents :events="events" />
  </div>
</template>