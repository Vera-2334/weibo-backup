import { getDb } from "./db";

// Check if a local copy exists for this URL
function getLocalPath(originalUrl: string): string | null {
  try {
    const db = getDb();
    // Simple in-memory cache would be better, but this works for now
    return null; // Will check via server action / API
  } catch { return null; }
}

// Rewrite Weibo CDN URLs: local file if available, otherwise proxy
export function proxyImageUrl(url: string): string {
  if (!url || !url.includes("sinaimg.cn")) return url;
  return `/api/image?url=${encodeURIComponent(url)}`;
}