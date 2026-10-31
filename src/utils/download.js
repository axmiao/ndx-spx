export function getSvgString(svgEl) {
  const clone = svgEl.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return new XMLSerializer().serializeToString(clone)
}

export function downloadSvg(svgEl, filename = 'monitor.svg') {
  const blob = new Blob([getSvgString(svgEl)], {
    type: 'image/svg+xml;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadPng(svgEl, filename = 'monitor.png', width = 800, height = 1728, scale = 2) {
  const blob = new Blob([getSvgString(svgEl)], {
    type: 'image/svg+xml;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = function () {
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)
    URL.revokeObjectURL(url)
    canvas.toBlob((pngBlob) => {
      const pngUrl = URL.createObjectURL(pngBlob)
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(pngUrl)
    }, 'image/png')
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    alert('PNG 导出失败，请改用 SVG。')
  }
  img.src = url
}