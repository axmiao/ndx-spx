import { ref } from 'vue'
import { fmtDate } from '../utils/format'

const WORKER_URL = 'https://ndx-proxy.bugvsdebug.workers.dev'
const RANGE = '5y'
const INTERVAL = '1d'
const CACHE_KEY = 'index_bars_v1'

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]') } catch { return [] }
}
function saveCache(bars) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(bars))
}

function calcYtd(bars) {
  if (!bars || bars.length < 2) return 0
  const last = bars[bars.length - 1]
  const lastYear = new Date(last.t * 1000).getUTCFullYear()
  const firstOfYear = bars.find(b => new Date(b.t * 1000).getUTCFullYear() === lastYear)
  if (!firstOfYear || firstOfYear.c <= 0) return 0
  return ((last.c - firstOfYear.c) / firstOfYear.c) * 100
}
function calcYtdFromCache(bars) {
  if (!bars || bars.length < 2) return 0
  const sorted = bars.slice().sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1]
  const lastYear = new Date(last.date).getUTCFullYear()
  const firstOfYear = sorted.find(b => new Date(b.date).getUTCFullYear() === lastYear)
  if (!firstOfYear || firstOfYear.close <= 0) return 0
  return ((last.close - firstOfYear.close) / firstOfYear.close) * 100
}

// 回撤曲线：每天相对此前历史高点的回撤百分比
function buildDrawdownSeries(bars) {
  let peak = -Infinity
  return bars.map(b => {
    if (b.c > peak) peak = b.c
    return { t: b.t, dd: ((b.c - peak) / peak) * 100 }
  })
}

// 回撤事件：从新高回撤 ≥ threshold 的区间
function detectDrawdownEvents(bars, threshold = 5) {
  const events = []
  let peak = -Infinity, peakBar = null
  let inDrawdown = false
  let trough = Infinity, troughBar = null

  for (const b of bars) {
    if (b.c >= peak) {
      if (inDrawdown && troughBar && peakBar) {
        events.push({
          peakDate: fmtDate(peakBar.t),
          peakClose: peakBar.c,
          troughDate: fmtDate(troughBar.t),
          troughClose: troughBar.c,
          depth: ((trough - peak) / peak) * 100,
          recovered: false,
          recoveryDays: null
        })
      }
      peak = b.c
      peakBar = b
      inDrawdown = false
      trough = Infinity
      troughBar = null
      continue
    }
    const dd = ((b.c - peak) / peak) * 100
    if (!inDrawdown && dd <= -threshold) {
      inDrawdown = true
      trough = b.c
      troughBar = b
    } else if (inDrawdown && b.c < trough) {
      trough = b.c
      troughBar = b
    }
  }
  if (inDrawdown && troughBar && peakBar) {
    const last = bars[bars.length - 1]
    events.push({
      peakDate: fmtDate(peakBar.t),
      peakClose: peakBar.c,
      troughDate: fmtDate(troughBar.t),
      troughClose: troughBar.c,
      depth: ((trough - peak) / peak) * 100,
      recovered: last.c >= peak,
      recoveryDays: last.c >= peak
        ? Math.round((last.t - peakBar.t) / 86400)
        : null
    })
  }
  return events
}

// 均线偏离与波动率
function calcVolatility(bars) {
  if (!bars || bars.length < 2) {
    return { ma20Dev: 0, ma60Dev: 0, ma200Dev: 0, vol20: 0 }
  }
  const closes = bars.map(b => b.c)
  const last = closes[closes.length - 1]
  const ma = (n) => {
    if (closes.length < n) return null
    const slice = closes.slice(-n)
    return slice.reduce((a, b) => a + b, 0) / n
  }
  const dev = (m) => (m && m > 0 ? ((last - m) / m) * 100 : 0)
  const ma20 = ma(20), ma60 = ma(60), ma200 = ma(200)

  // 近20日年化波动率
  let vol20 = 0
  if (closes.length >= 21) {
    const rets = []
    for (let i = closes.length - 20; i < closes.length; i++) {
      rets.push(Math.log(closes[i] / closes[i - 1]))
    }
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)
    vol20 = Math.sqrt(variance) * Math.sqrt(252) * 100
  }
  return { ma20Dev: dev(ma20), ma60Dev: dev(ma60), ma200Dev: dev(ma200), vol20 }
}

export function useIndexData() {
  const metrics = ref({
    highPoint: 0, highDate: '', latestClose: 0, latestDate: '',
    dailyChangePct: 0, drawdown: 0, recovery: 0, durationDays: 0, ytd: 0
  })
  const series = ref([])
  const events = ref([])
  const volatility = ref({ ma20Dev: 0, ma60Dev: 0, ma200Dev: 0, vol20: 0 })
  const compareData = ref([]) // [{ symbol, label, series }]
  const status = ref('')
  const statusError = ref(false)
  const debug = ref('')
  const sourceNote = ref('')
  const isHistorical = ref(false)

  async function fetchBars(symbol, asOfDate) {
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
    const closes = adj && adj.length === timestamps.length
      ? adj : result.indicators?.quote?.[0]?.close || []

    let bars = []
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i]
      if (c == null || !isFinite(c) || c <= 0) continue
      bars.push({ t: timestamps[i], c })
    }
    if (bars.length < 2) throw new Error('有效数据不足')

    if (asOfDate) {
      const endTs = Math.floor(new Date(asOfDate + 'T23:59:59Z').getTime() / 1000)
      bars = bars.filter(b => b.t <= endTs)
      if (bars.length < 2) throw new Error('所选日期之前有效数据不足')
    }
    return { bars, meta, rawCount: timestamps.length }
  }

  function computeAll(bars, meta, asOfDate) {
    let highPoint = -Infinity, highBar = null
    for (const b of bars) if (b.c > highPoint) { highPoint = b.c; highBar = b }

    let highDate = fmtDate(highBar.t)
    if (!asOfDate && meta?.fiftyTwoWeekHigh &&
        Math.abs(highPoint - meta.fiftyTwoWeekHigh) / meta.fiftyTwoWeekHigh > 0.05) {
      highPoint = meta.fiftyTwoWeekHigh
      highDate = '近52周'
    }

    let latestClose = bars[bars.length - 1].c
    let latestDate = fmtDate(bars[bars.length - 1].t)
    if (!asOfDate && meta?.regularMarketPrice &&
        Math.abs(latestClose - meta.regularMarketPrice) / meta.regularMarketPrice > 0.01) {
      latestClose = meta.regularMarketPrice
    }

    const prevClose = bars.length >= 2 ? bars[bars.length - 2].c : latestClose
    const drawdown = ((latestClose - highPoint) / highPoint) * 100
    const recovery = ((highPoint - latestClose) / latestClose) * 100
    const dailyChangePct = ((latestClose - prevClose) / prevClose) * 100
    const highTs = highBar ? highBar.t : bars[bars.length - 1].t
    const latestTs = bars[bars.length - 1].t
    const durationDays = Math.max(0, Math.round((latestTs - highTs) / 86400))
    const ytd = calcYtd(bars)

    return {
      metrics: {
        highPoint, highDate, latestClose, latestDate,
        dailyChangePct, drawdown, recovery, durationDays, ytd
      },
      series: buildDrawdownSeries(bars),
      events: detectDrawdownEvents(bars, 5),
      volatility: calcVolatility(bars)
    }
  }

  async function refresh(symbol, asOfDate = null, compareSymbols = []) {
    statusError.value = false
    isHistorical.value = !!asOfDate
    status.value = asOfDate ? `正在获取截至 ${asOfDate} 的历史数据…` : '正在通过 Worker 获取数据…'
    debug.value = ''

    try {
      const { bars, meta, rawCount } = await fetchBars(symbol, asOfDate)
      const result = computeAll(bars, meta, asOfDate)
      metrics.value = result.metrics
      series.value = result.series
      events.value = result.events
      volatility.value = result.volatility
      sourceNote.value = asOfDate
        ? `数据来源：Yahoo Finance（截至 ${asOfDate} 的历史快照）`
        : '数据来源：Yahoo Finance（近5年日线，经 Worker 代理）'
      status.value = `✅ ${asOfDate ? '历史快照' : '自动更新'}成功，数据截止 ${result.metrics.latestDate}`
      debug.value = `原始 ${rawCount} 条，有效 ${bars.length} 条；回撤事件 ${result.events.length} 个`

      // 多标的对比
      if (compareSymbols.length > 0) {
        const results = await Promise.all(
          compareSymbols.map(async (s) => {
            try {
              const { bars: cb } = await fetchBars(s, asOfDate)
              return { symbol: s, label: s, series: buildDrawdownSeries(cb) }
            } catch {
              return null
            }
          })
        )
        compareData.value = results.filter(Boolean)
      } else {
        compareData.value = []
      }
    } catch (e) {
      console.warn('获取失败：', e.message)
      const bars = loadCache()
      if (bars.length >= 2) {
        const sorted = bars.slice().sort((a, b) => a.date.localeCompare(b.date))
        const mapped = sorted.map(b => ({ t: new Date(b.date).getTime() / 1000, c: b.close }))
        const filtered = asOfDate ? mapped.filter(b => fmtDate(b.t) <= asOfDate) : mapped
        if (filtered.length >= 2) {
          const result = computeAll(filtered, null, asOfDate)
          metrics.value = result.metrics
          series.value = result.series
          events.value = result.events
          volatility.value = result.volatility
          sourceNote.value = '数据来源：本地缓存'
          statusError.value = true
          status.value = `⚠️ 获取失败（${e.message}），已用本地缓存。`
          return
        }
      }
      statusError.value = true
      status.value = `⚠️ 获取失败（${e.message}），无可用缓存。`
    }
  }

  function applyManual({ date, close }) {
    if (!date || !isFinite(close) || close <= 0) { alert('请输入有效日期和收盘价'); return }
    const bars = loadCache().filter(b => b.date !== date)
    bars.push({ date, close })
    bars.sort((a, b) => a.date.localeCompare(b.date))
    saveCache(bars)
    const mapped = bars.map(b => ({ t: new Date(b.date).getTime() / 1000, c: b.close }))
    const result = computeAll(mapped, null, null)
    metrics.value = result.metrics
    series.value = result.series
    events.value = result.events
    volatility.value = result.volatility
    sourceNote.value = '数据来源：手动录入'
    statusError.value = false
    isHistorical.value = false
    status.value = `已录入 ${date} 收盘 ${close}`
  }

  return {
    metrics, series, events, volatility, compareData,
    status, statusError, debug, sourceNote, isHistorical,
    refresh, applyManual
  }
}