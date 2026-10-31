import { ref } from 'vue'
import { fmtDate } from '../utils/format'

const WORKER_URL = 'https://ndx-proxy.bugvsdebug.workers.dev'
const RANGE = '5y'
const INTERVAL = '1d'

const CACHE_KEY = 'index_bars_v1'

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveCache(bars) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(bars))
}

export function useIndexData() {
  const metrics = ref({
    highPoint: 0,
    highDate: '',
    latestClose: 0,
    latestDate: '',
    dailyChangePct: 0,
    drawdown: 0,
    recovery: 0,
    durationDays: 0
  })
  const status = ref('')
  const statusError = ref(false)
  const debug = ref('')
  const sourceNote = ref('')

  async function fetchFromWorker(symbol) {
    const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${RANGE}&interval=${INTERVAL}`
    const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(target)}`

    const resp = await fetch(proxyUrl)
    if (!resp.ok) throw new Error('Worker 返回 HTTP ' + resp.status)
    const json = await resp.json()

    const result = json?.chart?.result?.[0]
    if (!result) throw new Error('Yahoo 返回结构异常')

    const meta = result.meta || {}
    const timestamps = result.timestamp || []
    const adj = result.indicators?.adjclose?.[0]?.adjclose
    const closes =
      adj && adj.length === timestamps.length
        ? adj
        : result.indicators?.quote?.[0]?.close || []

    const bars = []
    let dropped = 0
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i]
      if (c == null || !isFinite(c) || c <= 0) {
        dropped++
        continue
      }
      bars.push({ t: timestamps[i], c: c })
    }
    if (bars.length < 2) throw new Error('有效数据不足（过滤后仅 ' + bars.length + ' 条）')

    const sample = bars.slice(0, 3).map((b) => b.c.toFixed(2)).join(', ')
    const tail = bars.slice(-3).map((b) => b.c.toFixed(2)).join(', ')
    debug.value =
      `范围 ${RANGE}/${INTERVAL}，原始 ${timestamps.length} 条，过滤 ${dropped} 条，保留 ${bars.length} 条；` +
      `首3: ${sample}；尾3: ${tail}；meta高点: ${meta.fiftyTwoWeekHigh}，meta最新: ${meta.regularMarketPrice}`

    let highPoint = -Infinity
    let highBar = null
    for (const b of bars) {
      if (b.c > highPoint) {
        highPoint = b.c
        highBar = b
      }
    }

    let highDate = fmtDate(highBar.t)
    if (
      meta.fiftyTwoWeekHigh &&
      Math.abs(highPoint - meta.fiftyTwoWeekHigh) / meta.fiftyTwoWeekHigh > 0.05
    ) {
      highPoint = meta.fiftyTwoWeekHigh
      highDate = '近52周'
    }

    let latestClose = bars[bars.length - 1].c
    let latestDate = fmtDate(bars[bars.length - 1].t)
    if (
      meta.regularMarketPrice &&
      Math.abs(latestClose - meta.regularMarketPrice) / meta.regularMarketPrice > 0.01
    ) {
      latestClose = meta.regularMarketPrice
    }

    const prevClose = bars.length >= 2 ? bars[bars.length - 2].c : latestClose
    const drawdown = ((latestClose - highPoint) / highPoint) * 100
    const recovery = ((highPoint - latestClose) / latestClose) * 100
    const dailyChangePct = ((latestClose - prevClose) / prevClose) * 100

    const highTs = highBar ? highBar.t : bars[bars.length - 1].t
    const latestTs = bars[bars.length - 1].t
    const durationDays = Math.max(0, Math.round((latestTs - highTs) / 86400))

    return {
      highPoint,
      highDate,
      latestClose,
      latestDate,
      dailyChangePct,
      drawdown,
      recovery,
      durationDays
    }
  }

  function computeFromBars(bars) {
    const sorted = bars.slice().sort((a, b) => a.date.localeCompare(b.date))
    const last = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    let highPoint = -Infinity
    let highDate = ''
    for (const b of sorted) {
      if (b.close > highPoint) {
        highPoint = b.close
        highDate = b.date
      }
    }
    const drawdown = ((last.close - highPoint) / highPoint) * 100
    const recovery = ((highPoint - last.close) / last.close) * 100
    const dailyChangePct = ((last.close - prev.close) / prev.close) * 100
    const durationDays = Math.max(
      0,
      Math.round((new Date(last.date) - new Date(highDate)) / 86400000)
    )
    return {
      highPoint,
      highDate,
      latestClose: last.close,
      latestDate: last.date,
      dailyChangePct,
      drawdown,
      recovery,
      durationDays
    }
  }

  async function refresh(symbol) {
    statusError.value = false
    status.value = '正在通过 Worker 获取数据…'
    debug.value = ''

    try {
      const data = await fetchFromWorker(symbol)
      metrics.value = data
      sourceNote.value = '数据来源：Yahoo Finance（近5年日线，经 Worker 代理）'
      status.value = '✅ 自动更新成功，数据截止 ' + data.latestDate
    } catch (e) {
      console.warn('自动获取失败：', e.message)
      const bars = loadCache()
      if (bars.length >= 2) {
        metrics.value = computeFromBars(bars)
        sourceNote.value = '数据来源：本地缓存'
        statusError.value = true
        status.value = '⚠️ 获取失败（' + e.message + '），已用本地缓存数据。'
      } else {
        statusError.value = true
        status.value = '⚠️ 获取失败（' + e.message + '），无本地缓存，请手动录入。'
      }
    }
  }

  function applyManual({ date, close }) {
    if (!date || !isFinite(close) || close <= 0) {
      alert('请输入有效日期和收盘价')
      return
    }
    const bars = loadCache().filter((b) => b.date !== date)
    bars.push({ date, close })
    bars.sort((a, b) => a.date.localeCompare(b.date))
    saveCache(bars)

    metrics.value = computeFromBars(bars)
    sourceNote.value = '数据来源：手动录入'
    statusError.value = false
    status.value = '已录入 ' + date + ' 收盘 ' + close
  }

  return { metrics, status, statusError, debug, sourceNote, refresh, applyManual }
}