<script setup>
import { fmtNum } from '../utils/format'

defineProps({
  events: { type: Array, default: () => [] }
})
</script>

<template>
  <div class="w-full max-w-[800px] bg-navy-card/40 border border-gold/30 rounded-xl p-3">
    <div class="text-gold text-sm font-bold mb-2">历史回撤事件（≥5%）</div>
    <div v-if="!events.length" class="text-gold/50 text-xs">近5年无 ≥5% 的回撤事件</div>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-xs text-gold/80">
        <thead>
          <tr class="text-gold/60 border-b border-gold/20">
            <th class="text-left py-1 pr-2">峰值</th>
            <th class="text-left py-1 pr-2">谷底</th>
            <th class="text-right py-1 pr-2">深度</th>
            <th class="text-right py-1 pr-2">修复天数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in events" :key="i" class="border-b border-gold/10">
            <td class="py-1 pr-2 whitespace-nowrap">{{ e.peakDate }}</td>
            <td class="py-1 pr-2 whitespace-nowrap">{{ e.troughDate }}</td>
            <td class="py-1 pr-2 text-right text-red-300">{{ e.depth.toFixed(2) }}%</td>
            <td class="py-1 pr-2 text-right">
              <span v-if="e.recovered">{{ e.recoveryDays }} 天</span>
              <span v-else class="text-yellow-300">未修复</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>