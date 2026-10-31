<script setup>
import { ref, computed } from 'vue'
import { fmtNum, fmtPct } from '../utils/format'
import { downloadSvg, downloadPng } from '../utils/download'

const props = defineProps({
  title: { type: String, default: '指数回撤与修复监控' },
  symbolLabel: { type: String, default: '' },
  metrics: { type: Object, required: true },
  sourceNote: { type: String, default: '' },
  maxDrawdownText: { type: String, default: '' }
})

const svgRef = ref(null)

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
  () => '历史最高 ' + fmtNum(props.metrics.highPoint) + '（' + props.metrics.highDate + '）'
)

defineExpose({ svgRef })

function onDownloadSvg() {
  downloadSvg(svgRef.value, 'index_monitor.svg')
}
function onDownloadPng() {
  downloadPng(svgRef.value, 'index_monitor.png')
}
</script>

<template>
  <div class="flex flex-col items-center gap-3 w-full">
    <div class="flex gap-3 flex-wrap justify-center">
      <button class="px-6 py-2.5 border border-gold rounded-lg bg-navy-card text-gold font-bold text-sm hover:bg-gold hover:text-navy-bg transition-colors" @click="onDownloadSvg">下载 SVG</button>
      <button class="px-6 py-2.5 border border-gold rounded-lg bg-navy-card text-gold font-bold text-sm hover:bg-gold hover:text-navy-bg transition-colors" @click="onDownloadPng">下载 PNG</button>
    </div>

    <div class="w-full max-w-[800px] rounded-xl overflow-hidden shadow-2xl">
      <svg ref="svgRef" xmlns="http://www.w3.org/2000/svg" width="800" height="1728" viewBox="0 0 800 1728" class="block w-full h-auto">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0a1628" />
            <stop offset="100%" stop-color="#1a3a6b" />
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.35" />
          </filter>
        </defs>
        <rect width="800" height="1728" fill="url(#bg)" />

        <!-- 标题带 -->
        <text x="400" y="96" text-anchor="middle" font-size="48" font-weight="bold" fill="#FFD700"
              font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">
          {{ title }}
        </text>
        <text x="400" y="144" text-anchor="middle" font-size="22" fill="#FFD700" opacity="0.8"
              font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">
          {{ symbolLabel }} ｜ 数据截止 {{ metrics.latestDate }}
        </text>
        <line x1="160" y1="176" x2="640" y2="176" stroke="#FFD700" stroke-width="2" opacity="0.5" />

        <!-- 卡片 1：当前回撤 -->
        <g filter="url(#shadow)">
          <rect x="50" y="220" width="700" height="240" rx="20" fill="#1a3a6b" fill-opacity="0.55" stroke="#FFD700" stroke-width="1.5" />
          <text x="400" y="296" text-anchor="middle" font-size="28" fill="#FFD700" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">当前回撤比例</text>
          <text x="400" y="404" text-anchor="middle" font-size="72" font-weight="bold" fill="#FFD700" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ drawdownText }}</text>
        </g>

        <!-- 卡片 2：涨回新高所需 -->
        <g filter="url(#shadow)">
          <rect x="50" y="480" width="700" height="240" rx="20" fill="#1a3a6b" fill-opacity="0.55" stroke="#FFD700" stroke-width="1.5" />
          <text x="400" y="556" text-anchor="middle" font-size="28" fill="#FFD700" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">涨回历史新高所需涨幅</text>
          <text x="400" y="664" text-anchor="middle" font-size="72" font-weight="bold" fill="#FFD700" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ recoveryText }}</text>
        </g>

        <!-- 卡片 3：回撤持续天数 -->
        <g filter="url(#shadow)">
          <rect x="50" y="740" width="700" height="240" rx="20" fill="#1a3a6b" fill-opacity="0.55" stroke="#FFD700" stroke-width="1.5" />
          <text x="400" y="816" text-anchor="middle" font-size="28" fill="#FFD700" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">回撤持续天数</text>
          <text x="400" y="924" text-anchor="middle" font-size="72" font-weight="bold" fill="#FFD700" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ durationText }}</text>
        </g>

        <!-- 卡片 4：最新收盘 -->
        <g filter="url(#shadow)">
          <rect x="50" y="1000" width="700" height="240" rx="20" fill="#1a3a6b" fill-opacity="0.55" stroke="#FFD700" stroke-width="1.5" />
          <text x="400" y="1076" text-anchor="middle" font-size="28" fill="#FFD700" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">最新收盘价</text>
          <text x="400" y="1172" text-anchor="middle" font-size="64" font-weight="bold" fill="#FFD700" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ latestText }}</text>
          <text x="400" y="1218" text-anchor="middle" font-size="20" fill="#FFD700" opacity="0.7" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ dailyText }}</text>
        </g>

        <!-- 辅助指标条 -->
        <rect x="50" y="1270" width="700" height="230" rx="16" fill="#1a3a6b" fill-opacity="0.35" stroke="#FFD700" stroke-width="1" stroke-opacity="0.5" />
        <text x="400" y="1322" text-anchor="middle" font-size="22" fill="#FFD700" opacity="0.9" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ highText }}</text>
        <text x="400" y="1372" text-anchor="middle" font-size="22" fill="#FFD700" opacity="0.9" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ maxDrawdownText }}</text>
        <text x="400" y="1422" text-anchor="middle" font-size="22" fill="#FFD700" opacity="0.9" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">YTD：{{ ytdText }}</text>
        <text x="400" y="1470" text-anchor="middle" font-size="18" fill="#FFD700" opacity="0.6" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">{{ sourceNote }}</text>

        <!-- 注脚 -->
        <line x1="120" y1="1540" x2="680" y2="1540" stroke="#FFD700" stroke-width="1" opacity="0.25" />
        <text x="400" y="1580" text-anchor="middle" font-size="17" fill="#FFD700" opacity="0.55" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">口径：历史新高按近5年日收盘价；回撤持续天数按自然日</text>
        <text x="400" y="1616" text-anchor="middle" font-size="17" fill="#FFD700" opacity="0.55" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">自动获取经 Cloudflare Worker 代理 Yahoo Finance，失败时回退手动数据</text>
        <text x="400" y="1672" text-anchor="middle" font-size="15" fill="#FFD700" opacity="0.35" font-family="Microsoft YaHei, Noto Sans CJK SC, Source Han Sans SC, sans-serif">指数指标监控 · 仅供参考，不构成投资建议</text>
      </svg>
    </div>
  </div>
</template>