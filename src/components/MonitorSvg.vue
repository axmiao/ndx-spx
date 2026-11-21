<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { fmtNum, fmtPct } from '../utils/format'
import { downloadSvg, downloadPng } from '../utils/download'

const props = defineProps({
  title: { type: String, default: '指数回撤与修复监控' },
  symbolLabel: { type: String, default: '' },
  metrics: { type: Object, required: true },
  volatility: { type: Object, default: () => ({}) },
  recentCloses: { type: Array, default: () => [] },
  sourceNote: { type: String, default: '' },
  maxDrawdownText: { type: String, default: '' },
  theme: { type: String, default: 'dark' },
  vix: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  events: { type: Array, default: () => [] }
})

const svgRef = ref(null)
const previewOpen = ref(false)
const previewContainer = ref(null)

const palette = computed(() => props.theme === 'light'
  ? {
      bgFrom: '#eef2ff', bgTo: '#c7d2fe',
      card: '#ffffff', cardOpacity: 0.72,
      border: '#6366f1', text: '#312e81', textDim: '#4338ca',
      dimOpacity: 0.7, grid: '#6366f1', accent: '#06b6d4'
    }
  : {
      bgFrom: '#0a1628', bgTo: '#1a3a6b',
      card: '#1a3a6b', cardOpacity: 0.55,
      border: '#FFD700', text: '#FFD700', textDim: '#FFD700',
      dimOpacity: 0.7, grid: '#FFD700', accent: '#FFD700'
    })

const drawdownColor = computed(() => {
  const dd = Number(props.metrics.drawdown)
  const light = props.theme === 'light'
  if (dd >= -5) return light ? '#059669' : '#4ade80'
  if (dd >= -10) return light ? '#ca8a04' : '#FFD700'
  if (dd >= -20) return light ? '#ea580c' : '#fb923c'
  return light ? '#dc2626' : '#f87171'
})

const maxDd = computed(() => {
  const v = Number(props.metrics.maxDrawdown5y)
  return v > 0 ? v : 40
})

const ddBarWidth = computed(() => {
  const cur = Math.abs(Number(props.metrics.drawdown))
  return Math.min(cur / maxDd.value, 1) * 260
})

const ddTicks = computed(() => {
  const max = maxDd.value
  return [0.25, 0.5, 0.75, 1].map(r => Math.round(max * r))
})

const drawdownText = computed(() => Number(props.metrics.drawdown).toFixed(2) + '%')
const recoveryText = computed(() => Number(props.metrics.recovery).toFixed(2) + '%')
const durationText = computed(() => props.metrics.durationDays + ' 天')
const latestText = computed(() => fmtNum(props.metrics.latestClose))
const dailyText = computed(() => '日涨跌 ' + fmtPct(props.metrics.dailyChangePct))
const ytdText = computed(() => {
  const v = Number(props.metrics.ytd)
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
})
const highText = computed(
  () => '历史收盘最高点 ' + fmtNum(props.metrics.highPoint) + '（' + props.metrics.highDate + '）'
)

const vixText = computed(() => {
  const v = props.vix
  if (!v) return ''
  const sign = v.changePct >= 0 ? '+' : ''
  const label = v.label || 'VIX'
  return `${label}：${v.value.toFixed(2)}（${sign}${v.changePct.toFixed(2)}%）`
})

const sparkline = computed(() => {
  const data = props.recentCloses || []
  if (data.length < 2) return null
  const w = 180, h = 60
  const xs = data.map((_, i) => (i / (data.length - 1)) * w)
  const cs = data.map(d => d.c)
  const min = Math.min(...cs), max = Math.max(...cs)
  const ys = cs.map(c => h - ((c - min) / (max - min || 1)) * h)
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const lastX = xs[xs.length - 1], lastY = ys[ys.length - 1]
  return { d, lastX, lastY, w, h }
})

const percentileText = computed(() => {
  const v = props.metrics.drawdownPercentile
  const total = props.metrics.eventCount ?? 0
  if (v == null || total === 0) return '当日回撤分位数：无历史事件'
  const deeper = Math.round((v / 100) * total)
  return `当日回撤分位数：近5年 ${total} 次回撤中，${deeper} 次比当前更深`
})

const recoveryProgressText = computed(() => {
  const v = props.metrics.recoveryProgress
  if (v == null) return '恢复进度：--'
  return `恢复进度：${v.toFixed(0)}%（从谷底反弹）`
})

const maStateText = computed(() => {
  const s = props.metrics.maState || '数据不足'
  return `趋势：${s}`
})

const recoveryRatio = computed(() => {
  const h = Number(props.metrics.highPoint)
  const c = Number(props.metrics.latestClose)
  if (!h || !c) return 0.5
  return Math.min(c / h, 1)
})

// 本次回撤的修复进度：谷底 → 当前 → 峰值
const recoveryScale = computed(() => {
  const events = props.events || []
  const lastOpen = [...events].reverse().find(e => !e.recovered)
  const h = Number(props.metrics.highPoint)
  const c = Number(props.metrics.latestClose)
  if (!h || !c) return null

  // 如果有未修复事件，用它的 peak/trough；否则用历史高点 + 当前价近似
  const peak = lastOpen ? lastOpen.peakClose : h
  const trough = lastOpen ? lastOpen.troughClose : c
  if (!peak || !trough || peak <= trough) return null

  const range = peak - trough
  const progress = Math.min(Math.max((c - trough) / range, 0), 1) // 0–1
  return { peak, trough, current: c, progress, gapPct: ((peak - c) / c) * 100 }
})

defineExpose({ svgRef })

function onDownloadSvg() {
  downloadSvg(svgRef.value, 'index_monitor.svg')
}
function onDownloadPng() {
  downloadPng(svgRef.value, 'index_monitor.png')
}

function openPreview() {
  previewOpen.value = true
  document.body.style.overflow = 'hidden'
  nextTick(() => {
    if (previewContainer.value && svgRef.value) {
      previewContainer.value.innerHTML = ''
      const clone = svgRef.value.cloneNode(true)
      clone.setAttribute('class', 'block w-full h-auto')
      previewContainer.value.appendChild(clone)
    }
  })
}
function closePreview() {
  previewOpen.value = false
  document.body.style.overflow = ''
  if (previewContainer.value) previewContainer.value.innerHTML = ''
}
function onKeydown(e) {
  if (e.key === 'Escape' && previewOpen.value) closePreview()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="flex flex-col items-center gap-3 w-full">
    <div class="flex gap-3 flex-wrap justify-center">
      <button class="px-6 py-2.5 border border-gold rounded-lg bg-navy-card text-gold font-bold text-sm hover:bg-gold hover:text-navy-bg transition-colors" @click="onDownloadSvg">下载 SVG</button>
      <button class="px-6 py-2.5 border border-gold rounded-lg bg-navy-card text-gold font-bold text-sm hover:bg-gold hover:text-navy-bg transition-colors" @click="onDownloadPng">下载 PNG</button>
      <button class="px-6 py-2.5 border border-gold rounded-lg bg-navy-card text-gold font-bold text-sm hover:bg-gold hover:text-navy-bg transition-colors" @click="openPreview">预览图片</button>
    </div>

    <div class="relative w-full max-w-[800px] rounded-xl overflow-hidden shadow-2xl">
      <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="flex items-center gap-2 text-gold text-sm">
          <span class="inline-block w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin"></span>
          加载中…
        </div>
      </div>

      <svg ref="svgRef" xmlns="http://www.w3.org/2000/svg" width="800" height="1240" viewBox="0 0 800 1240" class="block w-full h-auto">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" :stop-color="palette.bgFrom" />
            <stop offset="100%" :stop-color="palette.bgTo" />
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.35" />
          </filter>
        </defs>
        <rect width="800" height="1240" fill="url(#bg)" />

        <text x="400" y="78" text-anchor="middle" font-size="52" font-weight="bold" :fill="palette.text"
              font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ title }}</text>
        <text x="400" y="122" text-anchor="middle" font-size="22" :fill="palette.textDim" :opacity="palette.dimOpacity"
              font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">
          {{ symbolLabel }} ｜ 数据截止：{{ metrics.latestDate }}
        </text>
        <line x1="120" y1="150" x2="680" y2="150" :stroke="palette.grid" stroke-width="1" opacity="0.35" />

        <!-- 卡片 1：左文右图 -->
        <g filter="url(#shadow)">
          <rect x="70" y="180" width="660" height="190" rx="18" :fill="palette.card" :fill-opacity="palette.cardOpacity" :stroke="palette.border" stroke-width="1.5" />

          <!-- 左侧文字 -->
          <text x="260" y="248" text-anchor="middle" font-size="24" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">当前回撤比例</text>
          <text x="260" y="303" text-anchor="middle" font-size="46" font-weight="bold" :fill="drawdownColor" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ drawdownText }}</text>
          <text x="260" y="340" text-anchor="middle" font-size="12" :fill="palette.textDim" :opacity="palette.dimOpacity" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">
            满量程 = 近5年最大回撤 {{ maxDd.toFixed(1) }}%
          </text>

          <!-- 右侧进度条 -->
          <g :transform="`translate(420, 275)`">
            <rect x="0" y="0" width="260" height="10" rx="5" :fill="palette.grid" opacity="0.15" />
            <rect x="0" y="0" :width="ddBarWidth" height="10" rx="5" :fill="drawdownColor" />
            <g v-for="t in ddTicks" :key="t">
              <line :x1="(t / maxDd) * 260" y1="-4" :x2="(t / maxDd) * 260" y2="14" :stroke="palette.grid" stroke-width="1" opacity="0.4" />
              <text :x="(t / maxDd) * 260" y="28" text-anchor="middle" font-size="11" :fill="palette.textDim" opacity="0.6">{{ t }}%</text>
            </g>
            <text x="0" y="-12" font-size="12" :fill="palette.textDim" opacity="0.7">回撤深度</text>
          </g>
        </g>

        <!-- 卡片 2：左文右图 -->
        <g filter="url(#shadow)">
          <rect x="70" y="396" width="660" height="190" rx="18" :fill="palette.card" :fill-opacity="palette.cardOpacity" :stroke="palette.border" stroke-width="1.5" />

          <!-- 左侧文字 -->
          <text x="260" y="464" text-anchor="middle" font-size="24" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">涨回历史新高所需涨幅</text>
          <text x="260" y="524" text-anchor="middle" font-size="46" font-weight="bold" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ recoveryText }}</text>
          <text v-if="recoveryScale" x="260" y="560" text-anchor="middle" font-size="12" :fill="palette.textDim" :opacity="palette.dimOpacity" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">
            本次回撤：谷底 {{ fmtNum(recoveryScale.trough) }} → 峰值 {{ fmtNum(recoveryScale.peak) }}
          </text>

          <!-- 右侧：本次回撤修复进度（谷底 → 当前 → 峰值） -->
          <g v-if="recoveryScale" :transform="`translate(430, 470)`">
            <!-- 轨道：谷底到峰值 -->
            <line x1="0" y1="0" x2="260" y2="0" :stroke="palette.grid" stroke-width="2" opacity="0.2" />
            <!-- 已修复部分：谷底到当前 -->
            <line x1="0" y1="0" :x2="recoveryScale.progress * 260" y2="0" :stroke="palette.accent" stroke-width="4" />
            <!-- 未修复部分：当前到峰值 -->
            <line :x1="recoveryScale.progress * 260" y1="0" x2="260" y2="0" :stroke="drawdownColor" stroke-width="4" opacity="0.35" />

            <!-- 三个节点 -->
            <circle cx="0" cy="0" r="5" :fill="palette.textDim" />
            <circle :cx="recoveryScale.progress * 260" cy="0" r="6" :fill="drawdownColor" />
            <circle cx="260" cy="0" r="5" :fill="palette.textDim" />

            <!-- 标签 -->
            <text x="0" y="-14" text-anchor="middle" font-size="11" :fill="palette.textDim" opacity="0.7">谷底</text>
            <text x="260" y="-14" text-anchor="end" font-size="11" :fill="palette.textDim" opacity="0.7">峰值</text>

            <!-- 进度文字 -->
            <text :x="recoveryScale.progress * 260" y="26" text-anchor="middle" font-size="12" :fill="palette.text" opacity="0.9">
              当前已修复 {{ (recoveryScale.progress * 100).toFixed(0) }}%
            </text>
            <text x="130" y="46" text-anchor="middle" font-size="11" :fill="palette.textDim" opacity="0.6">
              距峰值还需 {{ recoveryText }}
            </text>
          </g>
        </g>

        <!-- 卡片 3：左文右图 -->
        <g filter="url(#shadow)">
          <rect x="70" y="612" width="660" height="190" rx="18" :fill="palette.card" :fill-opacity="palette.cardOpacity" :stroke="palette.border" stroke-width="1.5" />

          <!-- 左侧文字 -->
          <text x="260" y="680" text-anchor="middle" font-size="24" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">回撤持续天数</text>
          <text x="260" y="750" text-anchor="middle" font-size="46" font-weight="bold" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ durationText }}</text>

          <!-- 右侧时间轴 -->
          <g :transform="`translate(480, 710)`">
            <line x1="0" y1="0" x2="260" y2="0" :stroke="palette.grid" stroke-width="2" opacity="0.25" />
            <line x1="0" y1="0" :x2="durationBarWidth" y2="0" :stroke="drawdownColor" stroke-width="3" />
            <circle cx="0" cy="0" r="5" :fill="palette.text" />
            <circle :cx="durationBarWidth" cy="0" r="5" :fill="drawdownColor" />
            <text x="0" y="-12" text-anchor="middle" font-size="11" :fill="palette.textDim" opacity="0.7">高点</text>
            <text :x="durationBarWidth" y="-12" text-anchor="middle" font-size="11" :fill="palette.textDim" opacity="0.7">至今</text>
            <text x="130" y="22" text-anchor="middle" font-size="11" :fill="palette.textDim" opacity="0.5">按 365 天比例</text>
          </g>
        </g>

        <!-- 卡片 4：左文右图 -->
        <g filter="url(#shadow)">
          <rect x="70" y="828" width="660" height="190" rx="18" :fill="palette.card" :fill-opacity="palette.cardOpacity" :stroke="palette.border" stroke-width="1.5" />

          <!-- 左侧文字 -->
          <text x="260" y="896" text-anchor="middle" font-size="24" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">最新收盘价</text>
          <text x="260" y="958" text-anchor="middle" font-size="42" font-weight="bold" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ latestText }}</text>
          <text x="260" y="990" text-anchor="middle" font-size="16" :fill="palette.textDim" :opacity="palette.dimOpacity" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ dailyText }}</text>

          <!-- 右侧迷你走势图 -->
          <g v-if="sparkline" :transform="`translate(500, 885)`">
            <path :d="sparkline.d" fill="none" :stroke="palette.accent" stroke-width="1.8" />
            <circle :cx="sparkline.lastX" :cy="sparkline.lastY" r="3" :fill="palette.accent" />
            <text x="0" y="80" font-size="11" :fill="palette.textDim" opacity="0.6">近60日</text>
          </g>
        </g>

        <!-- 辅助指标条 -->
        <rect x="70" y="1038" width="660" height="120" rx="14" :fill="palette.card" fill-opacity="0.35" :stroke="palette.border" stroke-width="1" stroke-opacity="0.5" />
        <text x="400" y="1070" text-anchor="middle" font-size="17" :fill="palette.text" opacity="0.9" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ highText }}</text>
        <text x="400" y="1100" text-anchor="middle" font-size="17" :fill="palette.text" opacity="0.9" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ percentileText }}</text>
        <text x="400" y="1130" text-anchor="middle" font-size="17" :fill="palette.text" opacity="0.9" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">
          YTD：{{ ytdText }}<template v-if="vixText"> ｜ {{ vixText }}</template>
        </text>
        <text x="400" y="1156" text-anchor="middle" font-size="15" :fill="palette.textDim" opacity="0.6" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ recoveryProgressText }} ｜ {{ maStateText }} ｜ {{ sourceNote }}</text>

        <line x1="120" y1="1178" x2="680" y2="1178" :stroke="palette.grid" stroke-width="1" opacity="0.25" />
        <text x="400" y="1206" text-anchor="middle" font-size="13" :fill="palette.textDim" opacity="0.5" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">口径：历史新高按近5年日收盘价；回撤持续天数按自然日；仅供参考</text>
      </svg>
    </div>

    <Teleport to="body">
      <div v-if="previewOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" @click.self="closePreview">
        <div class="relative w-full max-w-[min(92vw,720px)] max-h-[92vh] overflow-auto rounded-xl">
          <button class="absolute top-2 right-2 z-10 w-10 h-10 rounded-full bg-black/60 text-gold text-xl leading-none flex items-center justify-center hover:bg-gold hover:text-navy-bg transition-colors" @click="closePreview" aria-label="关闭预览">×</button>
          <div ref="previewContainer" class="w-full"></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>