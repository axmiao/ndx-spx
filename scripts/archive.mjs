// scripts/archive.mjs
import fs from 'node:fs/promises'
import path from 'node:path'

const WORKER_URL = 'https://ndx-proxy.bugvsdebug.workers.dev'
const SYMBOLS = ['^NDX', '^GSPC']
const ARCHIVE_DIR = 'public/archive'

async function fetchBars(symbol) {
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`
  const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(target)}`
  const resp = await fetch(proxyUrl)
  if (!resp.ok) throw new Error(`Worker HTTP ${resp.status} for ${symbol}`)
  const json = await resp.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`Yahoo 结构异常 for ${symbol}`)

  const timestamps = result.timestamp || []
  const adj = result.indicators?.adjclose?.[0]?.adjclose
  const closes = adj && adj.length === timestamps.length
    ? adj
    : result.indicators?.quote?.[0]?.close || []

  const bars = []
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i]
    if (c == null || !isFinite(c) || c <= 0) continue
    bars.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      close: c
    })
  }
  return bars
}

async function main() {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true })

  for (const symbol of SYMBOLS) {
    const file = path.join(ARCHIVE_DIR, `${symbol.replace('^', '')}.json`)
    let existing = []
    try {
      const raw = await fs.readFile(file, 'utf8')
      existing = JSON.parse(raw)
    } catch { /* 文件不存在，首次运行 */ }

    const existingDates = new Set(existing.map(b => b.date))
    const fresh = await fetchBars(symbol)
    const added = fresh.filter(b => !existingDates.has(b.date))

    if (added.length === 0) {
      console.log(`${symbol}: 无新数据，跳过`)
      continue
    }

    const merged = [...existing, ...added].sort((a, b) => a.date.localeCompare(b.date))
    await fs.writeFile(file, JSON.stringify(merged, null, 2) + '\n', 'utf8')
    console.log(`${symbol}: 新增 ${added.length} 条，总计 ${merged.length} 条`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})