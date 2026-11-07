<script setup>
import { computed } from 'vue'
import { fmtDate } from '../utils/format'

const props = defineProps({
  series: { type: Array, default: () => [] },
  compareData: { type: Array, default: () => [] },
  width: { type: Number, default: 760 },
  height: { type: Number, default: 240 }
})

const COLORS = ['#FFD700', '#4ade80', '#60a5fa', '#f472b6']

const allSeries = computed(() => {
  const list = [{ label: '主标的', data: props.series, color: COLORS[0] }]
  props.compareData.forEach((c, i) => {
    list.push({ label: c.label, data: c.series, color: COLORS[(i + 1) % COLORS.length] })
  })
  return list.filter(s => s.data.length >= 2)
})

const chart = computed(() => {
  const list = allSeries.value
  if (!list.length) return null
  const all = list.flatMap(s => s.data)
  const minT = Math.min(...all.map(d => d.t))
  const maxT = Math.max(...all.map(d => d.t))
  const minDd = Math.min(...all.map(d => d.dd), -1)
  const maxDd = 0
  const padL = 56, padR = 20, padT = 16, padB = 32
  const w = props.width - padL - padR
  const h = props.height - padT - padB

  const x = (t) => padL + ((t - minT) / (maxT - minT || 1)) * w
  const y = (dd) => padT + ((maxDd - dd) / (maxDd - minDd || 1)) * h

  const paths = list.map(s => {
    const d = s.data.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.dd).toFixed(1)}`).join(' ')
    return { ...s, d }
  })

  const ticks = [0, -10, -20, -30, -40, -50].filter(v => v >= minDd)
  const dateLabels = [minT, (minT + maxT) / 2, maxT].map(t => ({
    x: x(t), label: fmtDate(t).slice(0, 7)
  }))

  return { paths, ticks, dateLabels, padL, padT, w, h, x, y, minDd, maxDd }
})
</script>

<template>
  <div v-if="chart" class="w-full max-w-[800px] bg-navy-card/40 border border-gold/30 rounded-xl p-3">
    <div class="text-gold text-sm font-bold mb-2">历史回撤曲线</div>
    <svg :viewBox="`0 0 ${width} ${height}`" class="w-full h-auto">
      <!-- 网格 -->
      <g v-for="t in chart.ticks" :key="t">
        <line :x1="chart.padL" :x2="chart.padL + chart.w"
              :y1="chart.y(t)" :y2="chart.y(t)"
              stroke="#FFD700" stroke-width="0.5" opacity="0.2" />
        <text :x="chart.padL - 8" :y="chart.y(t) + 4" text-anchor="end"
              font-size="11" fill="#FFD700" opacity="0.6">{{ t }}%</text>
      </g>
      <!-- 曲线 -->
      <path v-for="s in chart.paths" :key="s.label"
            :d="s.d" fill="none" :stroke="s.color" stroke-width="1.6" />
      <!-- 日期 -->
      <text v-for="d in chart.dateLabels" :key="d.label"
            :x="d.x" :y="height - 8" text-anchor="middle"
            font-size="11" fill="#FFD700" opacity="0.55">{{ d.label }}</text>
    </svg>
    <div v-if="compareData.length" class="flex gap-3 flex-wrap mt-2 text-xs">
      <span v-for="(s, i) in chart.paths" :key="s.label" class="flex items-center gap-1">
        <span class="inline-block w-3 h-1 rounded" :style="{ background: s.color }"></span>
        <span class="text-gold/80">{{ s.label }}</span>
      </span>
    </div>
  </div>
</template>