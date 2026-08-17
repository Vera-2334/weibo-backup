// ============================================================
// Weibo Fetcher — Pure Node.js module (no React dependency)
// Calls m.weibo.cn mobile API to fetch user posts
// ============================================================

const WEIBO_API_BASE = "https://weibo.com/ajax/statuses/mymblog";
const WEIBO_LONGTEXT_API = "https://weibo.com/ajax/statuses/longtext";
const WEIBO_PROFILE_API = "https://weibo.com/ajax/profile/info";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const RATE_LIMIT_DELAY_MS = 6000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 10000;

// ============================================================
// Types
// ============================================================

export interface WeiboCookies {
  cookieString: string;
}

export interface WeiboCard {
  [key: string]: any;
}

export interface WeiboFetchResult {
  cards: WeiboCard[];
  since_id: string | null;
}

export interface ParsedWeiboPost {
  weibo_id: string;
  uid: string;
  content: string;
  raw_json: string;
  repost_json: string | null;
  created_at: string;
  is_original: number;
  is_long_text: number;
  images_json: string | null;
  source: string | null;
  reposts_count: number;
  comments_count: number;
  likes_count: number;
}

export interface WeiboProfile {
  uid: string;
  nickname: string;
  avatar_url: string;
}

// ============================================================
// Helpers
// ============================================================

function apiHeaders(cookies: WeiboCookies, referer?: string): Record<string, string> {
  // Extract XSRF-TOKEN from cookie string if present
  const xsrfMatch = cookies.cookieString.match(/XSRF-TOKEN=([^;]+)/);
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Referer: referer || "https://weibo.com/",
    "X-Requested-With": "XMLHttpRequest",
    Cookie: cookies.cookieString,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
  if (xsrfMatch) {
    headers["X-XSRF-TOKEN"] = xsrfMatch[1];
  }
  return headers;
}

// ============================================================
// Cookie normalization — accept a bare SUB value, "SUB=..." or a
// full "SUB=...; SUBP=...; XSRF-TOKEN=..." string, and normalize
// to "SUB=...; SUBP=...; XSRF-TOKEN=..." (SUBP/XSRF optional)
// ============================================================

export function normalizeCookie(input: string, subp?: string): string {
  const raw = (input || "").trim().replace(/;+\s*$/, "");

  const sub =
    raw.match(/(?:^|;\s*)SUB=([^;]+)/i)?.[1]?.trim() || raw.split(";")[0].trim();
  const subpInInput = raw.match(/(?:^|;\s*)SUBP=([^;]+)/i)?.[1]?.trim() || "";
  const xsrf = raw.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/i)?.[1]?.trim() || "";
  const finalSubp = (subp || "").trim().replace(/^SUBP=/i, "") || subpInInput;

  const parts = [`SUB=${sub}`];
  if (finalSubp) parts.push(`SUBP=${finalSubp}`);
  if (xsrf) parts.push(`XSRF-TOKEN=${xsrf}`);
  return parts.join("; ");
}

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Profile — test connection
// ============================================================

export async function fetchProfile(
  uid: string,
  cookies: WeiboCookies
): Promise<WeiboProfile> {
  // Use weibo.com desktop AJAX API — more tolerant than m.weibo.cn
  const apiUrl = `${WEIBO_API_BASE}?uid=${uid}&page=1&feature=0`;
  const referer = `https://weibo.com/u/${uid}`;
  const resp = await fetch(apiUrl, { headers: apiHeaders(cookies, referer) });

  if (!resp.ok) {
    let body = "";
    try { body = (await resp.text()).slice(0, 300); } catch {}
    if (resp.status === 403 || resp.status === 401) {
      throw new Error("Cookie 已过期或无效 — 请去 weibo.com 登录后从 DevTools Application 取 SUB Cookie");
    }
    throw new Error(`HTTP ${resp.status}: ${body || "无响应"}\n\n提示: 请确保从 weibo.com (不是 m.weibo.cn) 的 Cookies 中获取 SUB`);
  }

  const json = await resp.json();

  // Desktop API format: { ok: 1, data: { list: [...], since_id: "..." } }
  if (json.ok !== 1) {
    if (json.url && json.url.includes("login")) {
      throw new Error("Cookie 已过期，请去 weibo.com 重新登录后获取新的 SUB Cookie");
    }
    if (json.msg) throw new Error(`微博返回: ${json.msg}`);
    const snippet = JSON.stringify(json).slice(0, 200);
    throw new Error(`API 返回 ok=${json.ok}。完整响应: ${snippet}`);
  }

  const list = json.data?.list || [];
  let nickname = "";
  let avatar_url = "";

  // Extract user info from first post
  for (const item of list) {
    const user = item.user;
    if (user) {
      nickname = String(user.screen_name || user.name || "");
      avatar_url = String(user.avatar_hd || user.profile_image_url || "");
      break;
    }
  }

  // Fallback: profile API
  if (!nickname) {
    try {
      const pUrl = `${WEIBO_PROFILE_API}?uid=${uid}`;
      const pResp = await fetch(pUrl, { headers: apiHeaders(cookies, referer) });
      if (pResp.ok) {
        const pJson = await pResp.json();
        if (pJson.data?.user) {
          nickname = String(pJson.data.user.screen_name || "");
          avatar_url = String(pJson.data.user.avatar_hd || "");
        }
      }
    } catch {}
  }

  if (!nickname) {
    // As a last resort, use the profile page
    try {
      const pageUrl = `https://weibo.com/ajax/profile/detail?uid=${uid}`;
      const pageResp = await fetch(pageUrl, { headers: apiHeaders(cookies, referer) });
      if (pageResp.ok) {
        const pageJson = await pageResp.json();
        if (pageJson.data?.user) {
          nickname = String(pageJson.data.user.screen_name || "");
          avatar_url = String(pageJson.data.user.avatar_hd || "");
        }
      }
    } catch {}
  }

  if (!nickname) {
    throw new Error("API 正常但未找到用户。请确认 UID 正确，且 Cookie 来自 weibo.com (不是 m.weibo.cn)");
  }

  return { uid: String(uid), nickname, avatar_url };
}

// ============================================================
// Fetch one page of posts
// ============================================================

export async function fetchWeiboPage(
  uid: string,
  cookies: WeiboCookies,
  since_id?: string | null,
  options?: { dateWindow?: string }
): Promise<WeiboFetchResult> {
  const referer = `https://weibo.com/u/${uid}`;
  let url = `${WEIBO_API_BASE}?uid=${uid}&page=1&feature=0`;
  if (since_id) {
    url += `&since_id=${since_id}`;
  }
  // Date window for deep pagination — avoids since_id growing too long
  if (since_id && since_id.length > 800 && options?.dateWindow) {
    url += `&end_time=${options.dateWindow}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(url, { headers: apiHeaders(cookies, referer) });

      if (resp.status === 403 || resp.status === 401) {
        throw new Error("Cookie 已过期或无效，请从 weibo.com 重新获取 SUB Cookie");
      }

      if (resp.status === 429 || resp.status === 432) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      // HTTP 414: page limit reached. Return empty to trigger restart.
      if (resp.status === 414) {
        return { cards: [], since_id: null };
      }

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const json = await resp.json();
      if (json.ok !== 1) {
        // ok: -100 means not logged in (cookie expired)
        if (json.url && json.url.includes("login")) {
          throw new Error("Cookie 已过期，请去 weibo.com 重新登录后获取新的 SUB Cookie");
        }
        if (json.msg) throw new Error(`微博 API: ${json.msg}`);
        return { cards: [], since_id: null };
      }

      const data = json.data || {};
      // Desktop API uses "list" instead of "cards"
      const list: WeiboCard[] = data.list || data.cards || [];
      const nextSinceId: string | null = data.since_id || null;

      return { cards: list, since_id: nextSinceId };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.message.includes("Cookie")) throw lastError;
      if (attempt < MAX_RETRIES - 1) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError || new Error("抓取失败");
}

// ============================================================
// Fetch long text content
// ============================================================

export async function fetchLongText(
  weibo_id: string,
  cookies: WeiboCookies
): Promise<string> {
  try {
    const url = `${WEIBO_LONGTEXT_API}?id=${weibo_id}`;
    const resp = await fetch(url, { headers: apiHeaders(cookies) });

    if (!resp.ok) return "";

    const json = await resp.json();
    if (json.ok === 1 && json.data?.longTextContent) {
      return String(json.data.longTextContent);
    }
    return "";
  } catch {
    return "";
  }
}

// ============================================================
// Parse a WeiboCard → ParsedWeiboPost
// ============================================================

export function parseCard(item: WeiboCard, uid: string): ParsedWeiboPost {
  // Desktop API returns items directly (no "mblog" wrapper)
  const mblog = item.mblog || item;
  const isRepost = !!(mblog.retweeted_status || mblog.is_repost);

  // if repost, the repost content is in retweeted_status
  const repostRaw = isRepost ? mblog.retweeted_status : null;

  // Extract content text
  const text: string = mblog.text_raw || mblog.text || "";

  // Extract images — handle both desktop and mobile API formats
  const images: string[] = [];

  // Desktop API: pic_ids (string array) + pic_infos (object)
  const picIds = mblog.pic_ids || mblog.pic_num ? (Array.isArray(mblog.pic_ids) ? mblog.pic_ids : []) : [];
  const picInfos = mblog.pic_infos || {};

  if (picIds.length > 0 && Object.keys(picInfos).length > 0) {
    // Desktop format: pic_ids + pic_infos
    for (const pid of picIds) {
      const info = picInfos[pid];
      if (info) {
        const url = info.largest?.url || info.large?.url || info.middle?.url || info.thumbnail?.url;
        if (url) images.push(url);
      } else {
        // Reconstruct URL from pic ID
        images.push(`https://wx1.sinaimg.cn/large/${pid}.jpg`);
      }
    }
  } else if (Array.isArray(mblog.pics)) {
    // Mobile API format: pics array of objects
    for (const pic of mblog.pics) {
      if (typeof pic === "string") {
        images.push(pic);
      } else if (pic.large?.url) {
        images.push(pic.large.url);
      } else if (pic.url) {
        images.push(pic.url);
      }
    }
  }

  // Parse created_at — keep LOCAL time, not UTC
  let createdAt: string;
  if (mblog.created_at) {
    const rawDate = String(mblog.created_at);
    if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      createdAt = rawDate;
    } else {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          createdAt = fmtLocal(d);
        } else {
          createdAt = fmtLocal(new Date());
        }
      } catch {
        createdAt = fmtLocal(new Date());
      }
    }
  } else if (mblog.created_timestamp) {
    const ts = Number(mblog.created_timestamp) * 1000;
    createdAt = fmtLocal(new Date(ts));
  } else {
    createdAt = fmtLocal(new Date());
  }

  // Source client
  const source = mblog.source
    ? String(mblog.source).replace(/<[^>]+>/g, "")
    : null;

  return {
    weibo_id: String(mblog.id || mblog.mid || ""),
    uid,
    content: text,
    raw_json: JSON.stringify(mblog),
    repost_json: repostRaw ? JSON.stringify(repostRaw) : null,
    created_at: createdAt,
    is_original: isRepost ? 0 : 1,
    is_long_text: mblog.isLongText || (text.length > 140 && !isRepost) ? 1 : 0,
    images_json: images.length > 0 ? JSON.stringify(images) : null,
    source,
    reposts_count: mblog.reposts_count || 0,
    comments_count: mblog.comments_count || 0,
    likes_count: mblog.attitudes_count || 0,
  };
}

// ============================================================
// Enrich long text posts — fetch full text for truncated posts
// ============================================================

export async function enrichLongTexts(
  posts: ParsedWeiboPost[],
  cookies: WeiboCookies
): Promise<ParsedWeiboPost[]> {
  const enriched: ParsedWeiboPost[] = [];

  for (const post of posts) {
    if (post.is_long_text) {
      const fullText = await fetchLongText(post.weibo_id, cookies);
      if (fullText) {
        enriched.push({ ...post, content: fullText, is_long_text: 1 });
        await delay(500); // small delay between long text fetches
      } else {
        enriched.push(post);
      }
    } else {
      enriched.push(post);
    }
  }

  return enriched;
}

// ============================================================
// Extract image URLs from a card
// ============================================================

export function extractImages(card: WeiboCard): string[] {
  const mblog = card.mblog || card;
  const images: string[] = [];

  // Desktop API: pic_ids + pic_infos
  const picIds: string[] = Array.isArray(mblog.pic_ids) ? mblog.pic_ids : [];
  const picInfos: Record<string, any> = mblog.pic_infos || {};

  if (picIds.length > 0 && Object.keys(picInfos).length > 0) {
    for (const pid of picIds) {
      const info = picInfos[pid];
      if (info) {
        const url = info.largest?.url || info.large?.url || info.middle?.url || info.thumbnail?.url;
        if (url) images.push(url);
      }
    }
  } else if (picIds.length > 0) {
    // pic_ids without pic_infos — try to reconstruct URLs
    for (const pid of picIds) {
      images.push(`https://wx1.sinaimg.cn/large/${pid}.jpg`);
    }
  }

  // Mobile API: pics array
  if (Array.isArray(mblog.pics)) {
    for (const pic of mblog.pics) {
      if (typeof pic === "string") {
        images.push(pic);
      } else if (pic.large?.url) {
        images.push(pic.large.url);
      } else if (pic.url) {
        images.push(pic.url);
      }
    }
  }

  return images;
}

// ============================================================
// High-level: fetch all posts for a user
// ============================================================

export interface SyncProgressCallback {
  (progress: { page: number; totalFetched: number; newPosts: number }): void;
}

export async function fetchAllPosts(
  uid: string,
  cookies: WeiboCookies,
  sinceId: string | null,
  onProgress: SyncProgressCallback,
  signal?: AbortSignal
): Promise<{ posts: ParsedWeiboPost[]; lastSinceId: string | null }> {
  let currentSinceId: string | null = sinceId;
  let pageNum = 0;
  let totalFetched = 0;
  let newPosts = 0;

  const allPosts: ParsedWeiboPost[] = [];

  while (true) {
    // Check abort signal
    if (signal?.aborted) {
      throw new Error("同步已取消");
    }

    pageNum++;

    // Fetch one page
    let result: WeiboFetchResult;
    try {
      result = await fetchWeiboPage(uid, cookies, currentSinceId);
    } catch (err) {
      // Re-throw for caller to handle
      throw err;
    }

    // No cards returned — we're done
    if (result.cards.length === 0) {
      break;
    }

    // Parse cards
    const parsed = result.cards
      .filter((c) => c.mblog || c.id || c.mid)
      .map((c) => parseCard(c, uid))
      .filter((p) => p.weibo_id);

    // Enrich long texts
    const enriched = await enrichLongTexts(parsed, cookies);

    totalFetched += enriched.length;
    newPosts += enriched.length; // caller will determine actual new count via upsert
    allPosts.push(...enriched);

    onProgress({ page: pageNum, totalFetched, newPosts });

    // If no more since_id, we're done
    if (!result.since_id) {
      break;
    }

    currentSinceId = result.since_id;

    // Rate limit delay
    await delay(RATE_LIMIT_DELAY_MS);
  }

  return { posts: allPosts, lastSinceId: currentSinceId };
}