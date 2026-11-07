import { ref } from 'vue'

// 本地静态列表：不依赖网络，国内直接可用
const STATIC_LIST = {
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
    // 直接使用本地列表，无需请求
    categories.value = {
      indices: [...STATIC_LIST.indices],
      stocks: [...STATIC_LIST.stocks]
    }
    loading.value = false
  }

  return { categories, loading, load }
}