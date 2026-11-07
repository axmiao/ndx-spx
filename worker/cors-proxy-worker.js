const ALLOWED_ORIGINS = [
  "https://axmiao.github.io",   // 替换为你的 GitHub Pages 域名
  // "http://localhost:5173"        // 本地开发可临时加上
];

const ALLOWED_TARGETS = [
  "query1.finance.yahoo.com",
  "query2.finance.yahoo.com",
];

function originAllowed(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith(o));
}

function targetAllowed(targetUrl) {
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    return ALLOWED_TARGETS.some(d => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

const LIST = {
  indices: [
    { symbol: "^NDX", name: "纳斯达克100" },
    { symbol: "^GSPC", name: "标普500" }
  ],
  stocks: [
    { symbol: "AAPL", name: "苹果" },
    { symbol: "MSFT", name: "微软" },
    { symbol: "NVDA", name: "英伟达" },
    { symbol: "AMZN", name: "亚马逊" },
    { symbol: "GOOGL", name: "谷歌A" },
    { symbol: "META", name: "Meta" },
    { symbol: "TSLA", name: "特斯拉" }
  ]
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      if (!originAllowed(origin)) return new Response(null, { status: 403 });
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (!originAllowed(origin)) {
      return new Response("Origin not allowed", { status: 403 });
    }

    if (url.pathname === "/list") {
      return new Response(JSON.stringify(LIST), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": origin,
        },
      });
    }

    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
      return new Response("Missing ?url= parameter", { status: 400 });
    }
    if (!targetAllowed(targetUrl)) {
      return new Response("Target not allowed", { status: 403 });
    }

    try {
      const upstream = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; IndexMonitor/1.0)",
          "Accept": "application/json",
        },
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": origin,
          "Cache-Control": "public, max-age=300",
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": origin,
        },
      });
    }
  },
};