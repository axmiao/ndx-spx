import { ref } from 'vue'

const WORKER_URL = 'https://ndx-proxy.bugvsdebug.workers.dev'

const FALLBACK = {
  indices: [
    { symbol: '^NDX', name: '纳斯达克100' },
    { symbol: '^GSPC', name: '标普500' }
  ],
  stocks: [
    { symbol: 'AAPL', name: '苹果' },
    { symbol: 'MSFT', name: '微软' },
    { symbol: 'NVDA', name: '英伟达' },
    { symbol: 'AMZN', name: '亚马逊' },
    { symbol: 'GOOGL', name: '谷歌A' },
    { symbol: 'META', name: 'Meta' },
    { symbol: 'TSLA', name: '特斯拉' }
  ]
}

export function useIndexList() {
  const categories = ref({ indices: [], stocks: [] })
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const resp = await fetch(`${WORKER_URL}/list`)
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const data = await resp.json()
      categories.value = {
        indices: data.indices || [],
        stocks: data.stocks || []
      }
    } catch (e) {
      console.warn('列表加载失败，使用回退列表：', e.message)
      categories.value = FALLBACK
    } finally {
      loading.value = false
    }
  }

  return { categories, loading, load }
}