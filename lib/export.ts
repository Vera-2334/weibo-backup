// ============================================================
// Export utilities — JSON, HTML, Markdown ZIP
// ============================================================

import JSZip from "jszip";
import type { WeiboPost } from "./db";

// ============================================================
// JSON Export
// ============================================================

export function generateJSON(posts: WeiboPost[], uid?: string): string {
  const exported = {
    exported_at: new Date().toISOString(),
    total: posts.length,
    account_uid: uid || null,
    posts: posts.map((p) => ({
      weibo_id: p.weibo_id,
      uid: p.uid,
      content: p.content,
      created_at: p.created_at,
      is_original: p.is_original === 1,
      is_long_text: p.is_long_text === 1,
      images: p.images_json ? JSON.parse(p.images_json) : [],
      source: p.source,
      reposts_count: p.reposts_count,
      comments_count: p.comments_count,
      likes_count: p.likes_count,
      raw_json: JSON.parse(p.raw_json),
      repost_json: p.repost_json ? JSON.parse(p.repost_json) : null,
    })),
  };
  return JSON.stringify(exported, null, 2);
}

// ============================================================
// HTML Export — complete standalone page with Design V2 CSS
// ============================================================

export function generateHTML(posts: WeiboPost[], title?: string): string {
  const postCards = posts.map((p) => {
    const images = p.images_json ? (JSON.parse(p.images_json) as string[]) : [];
    const imageHTML = images.length > 0
      ? `<div style="display:flex;gap:8px;overflow-x:auto;margin-bottom:12px;">${images.map((url) => `<img src="${esc(url)}" style="flex-shrink:0;width:130px;height:130px;border-radius:10px;object-fit:cover;" loading="lazy" />`).join("")}</div>`
      : "";

    return `
    <article style="background:#fcfbf8;border-radius:14px;padding:20px 24px;margin-bottom:14px;box-shadow:0 1px 3px rgba(30,24,16,0.035);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:0.78rem;color:#7a7065;">${esc(dateStr(p.created_at))}</span>
        <span style="font-size:0.72rem;padding:3px 9px;border-radius:99px;font-weight:500;background:#f9f1e2;color:#9a6428;">${p.is_original ? "原创" : "转发"}</span>
        ${p.is_long_text ? `<span style="font-size:0.72rem;padding:3px 9px;border-radius:99px;font-weight:500;background:#f5f0e9;color:#b8863e;">长文</span>` : ""}
      </div>
      <div style="font-size:0.95rem;line-height:1.75;color:#4a4035;white-space:pre-wrap;word-break:break-word;margin-bottom:14px;">${esc(p.content)}</div>
      ${imageHTML}
      <div style="font-size:0.8rem;color:#7a7065;padding-top:10px;border-top:1px solid #f0ede6;display:flex;gap:14px;">
        <span>来自 ${esc(p.source || "未知客户端")}</span>
        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:2px"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ${p.reposts_count}</span>
        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:2px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> ${p.comments_count}</span>
        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:2px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${p.likes_count}</span>
      </div>
    </article>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(title || "Weibo Backup Export")}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=Noto+Sans+SC:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans SC','Outfit',system-ui,sans-serif;background:#f5f3ee;color:#1e1810;line-height:1.7;min-height:100vh;padding:32px 24px}
body::before{content:'';position:fixed;inset:0;pointer-events:none;opacity:0.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.container{max-width:680px;margin:0 auto}
h1{font-family:Outfit,'Noto Sans SC',sans-serif;font-size:1.3rem;font-weight:600;margin-bottom:6px;color:#1e1810}
.header{margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e6e1d8}
.header p{font-size:0.85rem;color:#7a7065}
@media(prefers-color-scheme:dark){body{background:#1a1814;color:#e8e4db}article{background:#24211c!important;box-shadow:0 1px 3px rgba(0,0,0,0.2)!important}h1{color:#e8e4db}.header{border-color:#35312a}}
@media(max-width:640px){body{padding:16px 14px}article{padding:16px 18px!important}}
@media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}article{box-shadow:none!important;border:1px solid #e6e1d8;break-inside:avoid}}
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>${esc(title || "Weibo Backup Export")}</h1>
<p>导出时间: ${new Date().toLocaleString("zh-CN")} · 共 ${posts.length} 条微博</p>
</div>
${postCards}
</div>
</body>
</html>`;
}

// ============================================================
// Markdown ZIP Export — one .md per post, Obsidian-compatible
// ============================================================

export async function generateMarkdownZip(posts: WeiboPost[]): Promise<Buffer> {
  const zip = new JSZip();

  for (const post of posts) {
    const postDate = dateStr(post.created_at);
    const filename = `${postDate.replace(/[:\s]/g, "-")}_${post.weibo_id}.md`;

    const frontmatter = [
      "---",
      `weibo_id: "${post.weibo_id}"`,
      `uid: "${post.uid}"`,
      `date: "${post.created_at}"`,
      `is_original: ${post.is_original === 1}`,
      post.source ? `source: "${post.source}"` : "",
      `reposts: ${post.reposts_count}`,
      `comments: ${post.comments_count}`,
      `likes: ${post.likes_count}`,
      "---",
    ].filter(Boolean).join("\n");

    const images = post.images_json ? (JSON.parse(post.images_json) as string[]) : [];
    const imageMD = images.map((url, i) => `![图片 ${i + 1}](${url})`).join("\n\n");

    const repostMD = post.repost_json
      ? `\n\n> **转发内容：**\n> ${(JSON.parse(post.repost_json) as any).text || ""}`
      : "";

    const content = `${frontmatter}\n\n${post.content}\n\n${imageMD}${repostMD}\n\n---\n来源: ${post.source || "未知"}\n`;

    zip.file(filename, content);
  }

  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

// ============================================================
// Helpers
// ============================================================

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dateStr(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return dateStr; }
}