export const fmtNum = (n, d = 2) =>
  Number(n).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  })

export const fmtPct = (n) => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%'

export const fmtDate = (ts) => new Date(ts * 1000).toISOString().slice(0, 10)