#!/usr/bin/env node
// extract-links.mjs
// 抓取一个网页的 HTML 源码，列出翻译时需要原样保留的全部链接资源：
// 超链接 <a href>、图片 <img src>、其他媒体（video/source/iframe）。
//
// 为什么需要：会"加工"网页的抓取工具（web reader 等）常把链接剥成纯文本、
// 丢掉目标 URL；本脚本直接解析 HTML 源码，拿到一手 href/src。
//
// 用法：
//   node extract-links.mjs <url>
//   node extract-links.mjs <url> --html path/to/saved.html   # 解析本地已保存的 HTML
//
// 依赖：Node 18+（全局 fetch）。无第三方依赖。

import { readFileSync } from 'node:fs';

const url = process.argv[2];
const htmlFlagIdx = process.argv.indexOf('--html');
const htmlFile = htmlFlagIdx !== -1 ? process.argv[htmlFlagIdx + 1] : null;

if (!url) {
  console.error('用法: node extract-links.mjs <url> [--html file.html]');
  process.exit(1);
}

let html;
if (htmlFile) {
  html = readFileSync(htmlFile, 'utf8');
} else {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    console.error(`抓取失败: HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  html = await res.text();
}

// 去掉 script/style，避免提取到 JS 代码里的 URL
const cleaned = html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const decode = (s) =>
  (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();

const skipHref = (href) => /^(#|javascript:|mailto:|tel:)/i.test(href);
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const section = (title, run) => {
  console.log(`\n## ${title}`);
  const count = run();
  if (count === 0) console.log('（无）');
};

// 1) 超链接
let n = 0;
section('超链接 <a>', () => {
  const re = /<a\s([^>]*?)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const attrs = m[1];
    const hrefM = attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i);
    if (!hrefM) continue;
    const href = decode(hrefM[1]);
    if (skipHref(href)) continue;
    n++;
    const text = decode(stripTags(m[2])) || '(无文字)';
    console.log(`${n}. ${text}\n   → ${href}`);
  }
  return n;
});

// 2) 图片
let p = 0;
section('图片 <img>', () => {
  const re = /<img\s([^>]*?)\/?>/gi;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const attrs = m[1];
    const srcM = attrs.match(/src\s*=\s*"([^"]*)"/i) || attrs.match(/src\s*=\s*'([^']*)'/i);
    if (!srcM) continue;
    const src = decode(srcM[1]);
    if (/^data:/i.test(src)) continue; // 跳过内联 base64
    p++;
    const altM = attrs.match(/alt\s*=\s*"([^"]*)"/i) || attrs.match(/alt\s*=\s*'([^']*)'/i);
    const alt = altM ? decode(altM[1]) : '';
    console.log(`${p}. alt="${alt}"\n   → ${src}`);
  }
  return p;
});

// 3) 其他媒体
let q = 0;
section('其他媒体 (video/source/iframe)', () => {
  const re = /<(video|source|iframe)\s([^>]*?)\/?>/gi;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const srcM = attrs.match(/(?:src|data)\s*=\s*"([^"]*)"/i) || attrs.match(/(?:src|data)\s*=\s*'([^']*)'/i);
    if (!srcM) continue;
    q++;
    console.log(`${q}. <${tag}> → ${decode(srcM[1])}`);
  }
  return q;
});

console.log(`\n合计：${n} 个超链接，${p} 张图片，${q} 个其他媒体。`);
