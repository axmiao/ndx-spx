import { ref } from 'vue'
import { fmtDate } from '../utils/format'

const WORKER_URL = 'https://ndx-proxy.bugvsdebug.workers.dev'
const RANGE = '5y'
const INTERVAL = '1d'
const CACHE_KEY = 'index_bars_v1'
const ARCHIVE_BASE = '/ndx-spx/archive'
const VIX_CACHE_PREFIX = 'vix_cache_v1_'

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]') } catch { return [] }
}
function saveCache(bars) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(bars))
}

function loadVixCache(symbol) {
  try { return JSON.parse(localStorage.getItem(VIX_CACHE_PREFIX + symbol) || 'null') } catch { return null }
}
function saveVixCache(symbol, data) {
  try { localStorage.setItem(VIX_CACHE_PREFIX + symbol, JSON.stringify(data)) } catch {}
}
function clearVixCache(symbol) {
  try { localStorage.removeItem(VIX_CACHE_PREFIX + symbol) } catch {}
}

function calcYtd(bars) {
  if (!bars || bars.length < 2) return 0
  const last = bars[bars.length - 1]
  const lastYear = new Date(last.t * 1000).getUTCFullYear()
  const firstOfYear = bars.find(b => new Date(b.t * 1000).getUTCFullYear() === lastYear)
  if (!firstOfYear || firstOfYear.c <= 0) return 0
  return ((last.c - firstOfYear.c) / firstOfYear.c) * 100
}

function buildDrawdownSeries(bars) {
  let peak = -Infinity
  return bars.map(b => {
    if (b.c > peak) peak = b.c
    return { t: b.t, dd: ((b.c - peak) / peak) * 100 }
  })
}

function detectDrawdownEvents(bars, threshold = 5) {
  const events = []
  let peak = -Infinity
  let peakBar = null
  let inDrawdown = false
  let peakBeforeDrawdown = -Infinity
  let peakBeforeBar = null
  let trough = Infinity
  let troughBar = null

  for (const b of bars) {
    if (b.c >= peak) {
      if (inDrawdown && troughBar && peakBeforeBar) {
        events.push({
          peakDate: fmtDate(peakBeforeBar.t),
          peakClose: peakBeforeDrawdown,
          troughDate: fmtDate(troughBar.t),
          troughClose: trough,
          depth: ((trough - peakBeforeDrawdown) / peakBeforeDrawdown) * 100,
          recovered: true,
          recoveryDays: Math.round((b.t - troughBar.t) / 86400)
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

    if (!inDrawdown) {
      if (dd <= -threshold) {
        inDrawdown = true
        peakBeforeDrawdown = peak
        peakBeforeBar = peakBar
        trough = b.c
        troughBar = b
      }
    } else {
      if (b.c < trough) {
        trough = b.c
        troughBar = b
      }
      if (b.c >= peakBeforeDrawdown) {
        events.push({
          peakDate: fmtDate(peakBeforeBar.t),
          peakClose: peakBeforeDrawdown,
          troughDate: fmtDate(troughBar.t),
          troughClose: trough,
          depth: ((trough - peakBeforeDrawdown) / peakBeforeDrawdown) * 100,
          recovered: true,
          recoveryDays: Math.round((b.t - troughBar.t) / 86400)
        })
        inDrawdown = false
        trough = Infinity
        troughBar = null
        if (b.c >= peak) {
          peak = b.c
          peakBar = b
        }
      }
    }
  }

  if (inDrawdown && troughBar && peakBeforeBar) {
    events.push({
      peakDate: fmtDate(peakBeforeBar.t),
      peakClose: peakBeforeDrawdown,
      troughDate: fmtDate(troughBar.t),
      troughClose: trough,
      depth: ((trough - peakBeforeDrawdown) / peakBeforeDrawdown) * 100,
      recovered: false,
      recoveryDays: null
    })
  }

  return events
}

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

// 回撤分位数：历史已修复回撤中，比当前更深的比例（越大越深）
function calcDrawdownPercentile(currentDrawdown, events) {
  const closed = (events || []).filter(e => e.recovered)
  if (closed.length === 0) return null
  const depths = closed.map(e => Math.abs(e.depth)).sort((a, b) => a - b)
  const cur = Math.abs(currentDrawdown)
  const deeper = depths.filter(d => d > cur).length
  return (deeper / depths.length) * 100
}

// 恢复进度：从谷底反弹的幅度占“谷底到峰值”的比例
function calcRecoveryProgress(bars) {
  if (!bars || bars.length < 2) return null
  let peakIdx = -1, peak = -Infinity
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].c > peak) { peak = bars[i].c; peakIdx = i }
  }
  let trough = Infinity, troughIdx = -1
  for (let i = peakIdx + 1; i < bars.length; i++) {
    if (bars[i].c < trough) { trough = bars[i].c; troughIdx = i }
  }
  if (troughIdx === -1) return null
  const last = bars[bars.length - 1].c
  const denom = peak - trough
  if (denom <= 0) return null
  return ((last - trough) / denom) * 100
}

// 50/200 均线状态
function calcMaState(bars) {
  if (!bars || bars.length < 200) return { ma50: null, ma200: null, state: '数据不足' }
  const closes = bars.map(b => b.c)
  const ma = (n) => closes.slice(-n).reduce((a, b) => a + b, 0) / n
  const ma50 = ma(50), ma200 = ma(200)
  const last = closes[closes.length - 1]
  let state = '震荡'
  if (ma50 > ma200 && last > ma50) state = '多头排列'
  else if (ma50 < ma200 && last < ma50) state = '空头排列'
  else if (ma50 > ma200) state = '多头回调'
  else state = '空头反弹'
  return { ma50, ma200, state }
}

// 波动率指数：纳指100 用 VXN，标普500 用 VIX，其他不显示
function vixSymbolFor(symbol) {
  if (symbol === '^NDX') return { code: '%5EVXN', label: 'VXN' }
  if (symbol === '^GSPC') return { code: '%5EVIX', label: 'VIX' }
  return null
}

async function fetchVix(symbol) {
  const cfg = vixSymbolFor(symbol)
  if (!cfg) return null

  // 1) 归档优先
  try {
    const resp = await fetch(`${ARCHIVE_BASE}/${cfg.label}.json`)
    if (resp.ok) {
      const json = await resp.json()
      if (Array.isArray(json) && json.length >= 2) {
        const last = json[json.length - 1]
        const prev = json[json.length - 2]
        if (last.close > 0 && prev.close > 0) {
          return {
            label: cfg.label,
            value: last.close,
            changePct: ((last.close - prev.close) / prev.close) * 100,
            date: last.date,
            updatedAt: Date.now()
          }
        }
      }
    }
  } catch {}

  // 2) Worker 实时
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${cfg.code}?range=1mo&interval=1d`
  const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(target)}`
  const resp = await fetch(proxyUrl)
  if (!resp.ok) throw new Error('波动率指数 HTTP ' + resp.status)
  const json = await resp.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error('波动率指数结构异常')

  const closes = result.indicators?.quote?.[0]?.close || []
  const valid = []
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i]
    if (c != null && isFinite(c) && c > 0) valid.push({ t: result.timestamp[i], c })
  }
  if (valid.length < 2) throw new Error('波动率指数数据不足')

  const last = valid[valid.length - 1]
  const prev = valid[valid.length - 2]
  return {
    label: cfg.label,
    value: last.c,
    changePct: ((last.c - prev.c) / prev.c) * 100,
    date: fmtDate(last.t),
    updatedAt: Date.now()
  }
}

export function useIndexData() {
  const metrics = ref({
    highPoint: 0, highDate: '', latestClose: 0, latestDate: '',
    dailyChangePct: 0, drawdown: 0, recovery: 0, durationDays: 0, ytd: 0,
    drawdownPercentile: null, recoveryProgress: null, maState: '数据不足',
    ma50: null, ma200: null
  })
  const series = ref([])
  const events = ref([])
  const volatility = ref({ ma20Dev: 0, ma60Dev: 0, ma200Dev: 0, vol20: 0 })
  const compareData = ref([])
  const status = ref('')
  const statusError = ref(false)
  const debug = ref('')
  const sourceNote = ref('')
  const isHistorical = ref(false)
  const recentCloses = ref([])
  const vix = ref(null)

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

  async function fetchFromArchive(symbol) {
    const code = symbol.replace('^', '')
    const resp = await fetch(`${ARCHIVE_BASE}/${code}.json`)
    if (!resp.ok) throw new Error('归档不存在')
    const json = await resp.json()
    if (!Array.isArray(json) || json.length < 2) throw new Error('归档数据不足')
    return json.map(b => ({
      t: Math.floor(new Date(b.date + 'T00:00:00Z').getTime() / 1000),
      c: b.close
    }))
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
    const recent = bars.slice(-60).map(b => ({ t: b.t, c: b.c }))

    const eventsForPercentile = detectDrawdownEvents(bars, 5)
    const lastEvent = eventsForPercentile[eventsForPercentile.length - 1]
    const currentDepth = lastEvent && !lastEvent.recovered
      ? Math.abs(lastEvent.depth)
      : Math.abs(drawdown)
    const drawdownPercentile = calcDrawdownPercentile(currentDepth, eventsForPercentile)
    const recoveryProgress = calcRecoveryProgress(bars)
    const maState = calcMaState(bars)

    return {
      metrics: {
        highPoint, highDate, latestClose, latestDate,
        dailyChangePct, drawdown, recovery, durationDays, ytd,
        drawdownPercentile,
        recoveryProgress,
        maState: maState.state,
        ma50: maState.ma50,
        ma200: maState.ma200
      },
      series: buildDrawdownSeries(bars),
      events: eventsForPercentile,
      volatility: calcVolatility(bars),
      recentCloses: recent
    }
  }

  function applyResult(result) {
    metrics.value = result.metrics
    series.value = result.series
    events.value = result.events
    volatility.value = result.volatility
    recentCloses.value = result.recentCloses
  }

  async function refresh(symbol, asOfDate = null, compareSymbols = []) {
    statusError.value = false
    isHistorical.value = !!asOfDate
    status.value = asOfDate
      ? `正在获取截至 ${asOfDate} 的历史数据…`
      : '正在获取数据…'
    debug.value = ''

    // VIX/VXN 并行获取，不阻塞主流程
    const vixPromise = (async () => {
      try {
        const fresh = await fetchVix(symbol)
        if (fresh) {
          vix.value = fresh
          saveVixCache(symbol, fresh)
        } else {
          vix.value = null
          clearVixCache(symbol)
        }
      } catch {
        const cached = loadVixCache(symbol)
        vix.value = cached || null
      }
    })()

    // 非历史模式：优先读归档
    if (!asOfDate) {
      try {
        const archiveBars = await fetchFromArchive(symbol)
        const result = computeAll(archiveBars, null, null)
        applyResult(result)
        sourceNote.value = '数据来源：每日归档（GitHub Actions 自动快照）'
        status.value = `✅ 已读取归档，数据截止 ${result.metrics.latestDate}`
        debug.value = `归档 ${archiveBars.length} 条`
        await loadCompare(compareSymbols, asOfDate)
        await vixPromise
        return
      } catch (e) {
        console.warn('归档读取失败，回退 Worker：', e.message)
      }
    }

    // Worker 实时（历史模式或归档失败）
    try {
      const { bars, meta, rawCount } = await fetchBars(symbol, asOfDate)
      const result = computeAll(bars, meta, asOfDate)
      applyResult(result)
      sourceNote.value = asOfDate
        ? `数据来源：Yahoo Finance（截至 ${asOfDate} 的历史快照）`
        : '数据来源：Yahoo Finance（近5年日线，经 Worker 代理）'
      status.value = `✅ ${asOfDate ? '历史快照' : '自动更新'}成功，数据截止 ${result.metrics.latestDate}`
      debug.value = `原始 ${rawCount} 条，有效 ${bars.length} 条；回撤事件 ${result.events.length} 个`
      await loadCompare(compareSymbols, asOfDate)
      await vixPromise
    } catch (e) {
      console.warn('获取失败：', e.message)
      const bars = loadCache()
      if (bars.length >= 2) {
        const sorted = bars.slice().sort((a, b) => a.date.localeCompare(b.date))
        const mapped = sorted.map(b => ({ t: new Date(b.date).getTime() / 1000, c: b.close }))
        const filtered = asOfDate ? mapped.filter(b => fmtDate(b.t) <= asOfDate) : mapped
        if (filtered.length >= 2) {
          const result = computeAll(filtered, null, asOfDate)
          applyResult(result)
          sourceNote.value = '数据来源：本地缓存'
          statusError.value = true
          status.value = `⚠️ 获取失败（${e.message}），已用本地缓存。`
          await vixPromise
          return
        }
      }
      statusError.value = true
      status.value = `⚠️ 获取失败（${e.message}），无可用缓存。`
      await vixPromise
    }
  }

  async function loadCompare(compareSymbols, asOfDate) {
    if (!compareSymbols || compareSymbols.length === 0) {
      compareData.value = []
      return
    }
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
  }

  function applyManual({ date, close }) {
    if (!date || !isFinite(close) || close <= 0) { alert('请输入有效日期和收盘价'); return }
    const bars = loadCache().filter(b => b.date !== date)
    bars.push({ date, close })
    bars.sort((a, b) => a.date.localeCompare(b.date))
    saveCache(bars)
    const mapped = bars.map(b => ({ t: new Date(b.date).getTime() / 1000, c: b.close }))
    const result = computeAll(mapped, null, null)
    applyResult(result)
    sourceNote.value = '数据来源：手动录入'
    statusError.value = false
    isHistorical.value = false
    status.value = `已录入 ${date} 收盘 ${close}`
  }

  return {
    metrics, series, events, volatility, recentCloses, compareData, vix,
    status, statusError, debug, sourceNote, isHistorical,
    refresh, applyManual
  }
}