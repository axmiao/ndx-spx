<div align="center">

# 📈 指数回撤与修复监控

**实时追踪指数与个股的回撤深度、修复难度与持续时间**

[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-4.x-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![WindiCSS](https://img.shields.io/badge/WindiCSS-3.x-38bdf8)](https://windicss.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-181717?logo=github&logoColor=white)](https://pages.github.com/)

一键生成深蓝渐变风格的指标卡片图，支持 SVG / PNG 下载

</div>

---

## ✨ 功能特性

- **多标的切换** — 下拉框选择纳斯达克100、标普500 或个股，数据即时刷新
- **四项核心指标** — 当前回撤比例、涨回历史新高所需涨幅、回撤持续天数、最新收盘价
- **自动数据获取** — 经 Cloudflare Worker 代理 Yahoo Finance，绕过浏览器 CORS 限制
- **本地缓存回退** — 接口不可用时自动读取 localStorage，手动录入收盘价即可继续使用
- **数据校验兜底** — 与 Yahoo `meta` 字段交叉比对，异常值时自动修正
- **一键出图** — 竖版 800×1200 指标卡片，支持 SVG（矢量）与 PNG（2 倍分辨率）下载
- **零后端部署** — 纯静态托管于 GitHub Pages，Worker 免费额度足够日常使用

---

## 🖼️ 效果预览

> 深蓝渐变背景 · 黄色指标文字 · 2×2 卡片布局 · 底部数据注脚
