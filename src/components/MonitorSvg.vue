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
  theme: { type: String, default: 'dark' }
})

const svgRef = ref(null)
const previewOpen = ref(false)
const previewContainer = ref(null)

// ====== 主题 ======
const palette = computed(() => props.theme === 'light'
  ? {
      bgFrom: '#eef2ff',
      bgTo: '#c7d2fe',
      card: '#ffffff',
      cardOpacity: 0.72,
      border: '#6366f1',
      text: '#312e81',
      textDim: '#4338ca',
      dimOpacity: 0.7,
      grid: '#6366f1',
      accent: '#06b6d4'
    }
  : {
      bgFrom: '#0a1628',
      bgTo: '#1a3a6b',
      card: '#1a3a6b',
      cardOpacity: 0.55,
      border: '#FFD700',
      text: '#FFD700',
      textDim: '#FFD700',
      dimOpacity: 0.7,
      grid: '#FFD700',
      accent: '#FFD700'
    })
// ====== 回撤深度色阶 ======
const drawdownColor = computed(() => {
  const dd = Number(props.metrics.drawdown)
  const light = props.theme === 'light'
  if (dd >= -5) return light ? '#059669' : '#4ade80'
  if (dd >= -10) return light ? '#ca8a04' : '#FFD700'
  if (dd >= -20) return light ? '#ea580c' : '#fb923c'
  return light ? '#dc2626' : '#f87171'
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
const volText = computed(() => {
  const v = props.volatility || {}
  const f = (n) => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%'
  return `20日波动 ${Number(v.vol20 || 0).toFixed(1)}% ｜ 20/60/200日均线偏离 ${f(v.ma20Dev || 0)} / ${f(v.ma60Dev || 0)} / ${f(v.ma200Dev || 0)}`
})

// ====== 迷你走势图路径 ======
const sparkline = computed(() => {
  const data = props.recentCloses || []
  if (data.length < 2) return null
  const w = 220, h = 50
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
  if (v == null) return '回撤分位数：无历史事件'
  return `回撤分位数：${v.toFixed(0)}%（近5年回撤中比 ${v.toFixed(0)}% 更深）`
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

    <div class="w-full max-w-[800px] rounded-xl overflow-hidden shadow-2xl">
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

        <!-- 卡片 1：当前回撤（色阶） -->
        <g filter="url(#shadow)">
          <rect x="70" y="180" width="660" height="150" rx="18" :fill="palette.card" :fill-opacity="palette.cardOpacity" :stroke="palette.border" stroke-width="1.5" />
          <text x="400" y="234" text-anchor="middle" font-size="28" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">当前回撤比例</text>
          <text x="400" y="298" text-anchor="middle" font-size="48" font-weight="bold" :fill="drawdownColor" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ drawdownText }}</text>
        </g>

        <g filter="url(#shadow)">
          <rect x="70" y="356" width="660" height="150" rx="18" :fill="palette.card" :fill-opacity="palette.cardOpacity" :stroke="palette.border" stroke-width="1.5" />
          <text x="400" y="410" text-anchor="middle" font-size="28" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">涨回历史新高所需涨幅</text>
          <text x="400" y="474" text-anchor="middle" font-size="48" font-weight="bold" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ recoveryText }}</text>
        </g>

        <g filter="url(#shadow)">
          <rect x="70" y="532" width="660" height="150" rx="18" :fill="palette.card" :fill-opacity="palette.cardOpacity" :stroke="palette.border" stroke-width="1.5" />
          <text x="400" y="586" text-anchor="middle" font-size="28" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">回撤持续天数</text>
          <text x="400" y="650" text-anchor="middle" font-size="48" font-weight="bold" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ durationText }}</text>
        </g>

        <!-- 卡片 4：最新收盘 + 迷你走势图 -->
        <g filter="url(#shadow)">
          <rect x="70" y="708" width="660" height="190" rx="18" :fill="palette.card" :fill-opacity="palette.cardOpacity" :stroke="palette.border" stroke-width="1.5" />
          <text x="400" y="754" text-anchor="middle" font-size="28" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">最新收盘价</text>
          <text x="400" y="806" text-anchor="middle" font-size="46" font-weight="bold" :fill="palette.text" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ latestText }}</text>
          <text x="400" y="828" text-anchor="middle" font-size="18" :fill="palette.textDim" :opacity="palette.dimOpacity" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ dailyText }}</text>

          <!-- 迷你走势图：完整落在卡片内 -->
          <g v-if="sparkline" :transform="`translate(290, 838)`">
            <path :d="sparkline.d" fill="none" :stroke="palette.accent" stroke-width="1.8" />
            <circle :cx="sparkline.lastX" :cy="sparkline.lastY" r="3" :fill="palette.accent" />
          </g>
        </g>

        <!-- 辅助指标条 -->
         <rect x="70" y="918" width="660" height="200" rx="14" :fill="palette.card" fill-opacity="0.35" :stroke="palette.border" stroke-width="1" stroke-opacity="0.5" />
        <text x="400" y="952" text-anchor="middle" font-size="19" :fill="palette.text" opacity="0.9" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ highText }}</text>
        <text x="400" y="988" text-anchor="middle" font-size="19" :fill="palette.text" opacity="0.9" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ percentileText }}</text>
        <text x="400" y="1024" text-anchor="middle" font-size="19" :fill="palette.text" opacity="0.9" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">YTD：{{ ytdText }}</text>
        <text x="400" y="1060" text-anchor="middle" font-size="17" :fill="palette.text" opacity="0.85" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ recoveryProgressText }} ｜ {{ maStateText }}</text>
        <text x="400" y="1096" text-anchor="middle" font-size="16" :fill="palette.textDim" opacity="0.6" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ sourceNote }}</text>
        
        <line x1="120" y1="1138" x2="680" y2="1138" :stroke="palette.grid" stroke-width="1" opacity="0.25" />
        <text x="400" y="1168" text-anchor="middle" font-size="15" :fill="palette.textDim" opacity="0.55" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">口径：历史新高按近5年日收盘价；回撤持续天数按自然日</text>
        <text x="400" y="1196" text-anchor="middle" font-size="15" :fill="palette.textDim" opacity="0.55" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">经 Cloudflare Worker 代理 Yahoo Finance，失败时回退手动数据</text>
        <text x="400" y="1218" text-anchor="middle" font-size="14" :fill="palette.textDim" opacity="0.35" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">指数指标监控 · 仅供参考，不构成投资建议</text>
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