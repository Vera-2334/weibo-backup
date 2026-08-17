"use server";

import {
  getDb,
  ensureDb,
  getAccountByUid,
  updateAccount,
  upsertPost,
  insertImage,
  createSyncLog,
  updateSyncLog,
  getLatestSyncLog,
  getSyncLogs,
  getPostCount,
  getPostStats,
} from "@/lib/db";
import { parseCard, enrichLongTexts, delay, normalizeCookie } from "@/lib/weibo-fetcher";
import { pushLocalToTurso, type BackupResult } from "@/lib/turso-backup";
import { revalidatePath } from "next/cache";

// In-memory state
const cancelFlags = new Map<number, any>();

export async function cancelSync(logId: number): Promise<void> {
  cancelFlags.set(logId, true);
}

// ============================================================
// Start sync
// ============================================================

export async function startSync(uid: string): Promise<{ ok: boolean; logId?: number; error?: string; latestPostDate?: string; pageNum?: number }> {
  await ensureDb();

  const account = await getAccountByUid(uid);
  if (!account) return { ok: false, error: "账号不存在" };
  if (!account.cookie_sub) return { ok: false, error: "未配置 Cookie" };

  // Normalize cookie format (accept bare SUB value or full "SUB=...; SUBP=..." string)
  const normalizedCookie = normalizeCookie(account.cookie_sub);
  if (normalizedCookie !== account.cookie_sub) {
    await updateAccount(account.id, { cookie_sub: normalizedCookie });
    account.cookie_sub = normalizedCookie;
  }

  // Auto-refresh profile
  if (!account.nickname) {
    try {
      const { fetchProfile } = await import("@/lib/weibo-fetcher");
      const profile = await fetchProfile(account.uid, { cookieString: account.cookie_sub });
      await updateAccount(account.id, { nickname: profile.nickname, avatar_url: profile.avatar_url });
    } catch {}
  }

  // Latest post date for incremental sync
  const db = getDb();
  const latest = await db.execute({
    sql: "SELECT MAX(created_at) as latest FROM weibo_posts WHERE uid = ? AND deleted_at IS NULL",
    args: [uid],
  });
  const latestPostDate = latest.rows[0]?.latest ? String(latest.rows[0].latest) : undefined;

  // Check if already syncing
  const latestLog = await getLatestSyncLog(uid);
  if (latestLog && latestLog.status === "running") {
    const startedAt = new Date(latestLog.started_at).getTime();
    if (Date.now() - startedAt > 10 * 60 * 1000) {
      await updateSyncLog(latestLog.id, { status: "cancelled", finished_at: new Date().toISOString() });
    } else {
      return { ok: false, error: "该账号正在同步中，请等待完成或取消" };
    }
  }

  const log = await createSyncLog(uid);
  cancelFlags.set(log.id, false);

  return { ok: true, logId: log.id, latestPostDate, pageNum: 1 };
}

// ============================================================
// Fetch one page — uses page=N (no since_id, no 414 issues)
// ============================================================

export async function fetchPage(
  logId: number,
  uid: string,
  pageNum: number,
  latestPostDate?: string
): Promise<{
  done: boolean;
  pageNum: number;
  batchCount: number;
  newCount: number;
  totalSoFar: number;
  error?: string;
  retryAfterMs?: number;
}> {
  await ensureDb();

  if (cancelFlags.get(logId)) {
    await updateSyncLog(logId, { status: "cancelled", finished_at: new Date().toISOString() });
    cancelFlags.delete(logId);
    return { done: true, pageNum, batchCount: 0, newCount: 0, totalSoFar: 0, error: "已取消" };
  }

  const account = await getAccountByUid(uid);
  if (!account) return { done: true, pageNum, batchCount: 0, newCount: 0, totalSoFar: 0, error: "账号不存在" };

  // Fetch page N directly from weibo.com
  let cards: any[];
  try {
    const url = `https://weibo.com/ajax/statuses/mymblog?uid=${uid}&page=${pageNum}&feature=0`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Referer: `https://weibo.com/u/${uid}`,
        Cookie: account.cookie_sub,
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (resp.status === 414) {
      // Rate limited — tell client to wait
      return { done: false, pageNum, batchCount: 0, newCount: 0, totalSoFar: 0, retryAfterMs: 30000 };
    }

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.ok !== 1) {
      if (json.url && json.url.includes("login")) throw new Error("Cookie 已过期");
      cards = [];
    } else {
      cards = json.data?.list || [];
    }
  } catch (err: any) {
    const msg = err.message || "抓取失败";
    await updateSyncLog(logId, { status: "failed", finished_at: new Date().toISOString(), error_message: msg });
    cancelFlags.delete(logId);
    return { done: true, pageNum, batchCount: 0, newCount: 0, totalSoFar: 0, error: msg };
  }

  // Empty — no more pages
  if (cards.length === 0) {
    await updateSyncLog(logId, { status: "completed", finished_at: new Date().toISOString() });
    await updateAccount(account.id, { last_sync_at: new Date().toISOString() });
    cancelFlags.delete(logId);
    revalidatePath("/posts");
    revalidatePath("/shuffle");
    return { done: true, pageNum, batchCount: 0, newCount: 0, totalSoFar: 0 };
  }

  // Parse
  let parsed = cards
    .filter((c: any) => c.mblog || c.id || c.mid)
    .map((c: any) => parseCard(c, uid))
    .filter((p: any) => p.weibo_id);

  // Filter non-owner posts
  parsed = parsed.filter((p: any) => {
    const raw = JSON.parse(p.raw_json);
    const postUid = String(raw.user?.id || raw.uid || "");
    return postUid === uid || postUid === "";
  });

  if (account.sync_original_only) {
    parsed = parsed.filter((p: any) => p.is_original === 1);
  }

  const enriched = await enrichLongTexts(parsed, { cookieString: account.cookie_sub });

  let newCount = 0;
  for (const post of enriched) {
    const { isNew } = await upsertPost(post);
    if (isNew) newCount++;
    if (isNew && post.images_json) {
      const urls = JSON.parse(post.images_json);
      for (const url of urls) {
        try { await insertImage({ weibo_id: post.weibo_id, original_url: url }); } catch {}
      }
    }
  }

  // Update log
  const existingLog = await getLatestSyncLog(uid);
  const totalSoFar = (existingLog?.posts_fetched || 0) + cards.length;
  const totalNew = (existingLog?.posts_new || 0) + newCount;
  await updateSyncLog(logId, { posts_fetched: totalSoFar, posts_new: totalNew });

  // Incremental stop
  if (latestPostDate && enriched.length > 0) {
    const oldestInBatch = enriched[enriched.length - 1].created_at;
    if (oldestInBatch <= latestPostDate) {
      await updateSyncLog(logId, { status: "completed", finished_at: new Date().toISOString() });
      await updateAccount(account.id, { last_sync_at: new Date().toISOString() });
      cancelFlags.delete(logId);
      revalidatePath("/posts");
      revalidatePath("/shuffle");
      return { done: true, pageNum, batchCount: parsed.length, newCount, totalSoFar };
    }
  }

  return { done: false, pageNum: pageNum + 1, batchCount: parsed.length, newCount, totalSoFar };
}

// ============================================================
// Status & history
// ============================================================

export async function getSyncStatus(uid: string): Promise<{
  isRunning: boolean;
  latestLog: any | null;
  lastSinceId: string | null;
  totalPosts: number;
  stats: any | null;
}> {
  await ensureDb();
  const account = await getAccountByUid(uid);
  const latestLog = await getLatestSyncLog(uid);
  const totalPosts = await getPostCount({ uid });
  const stats = await getPostStats({ uid });
  return {
    isRunning: latestLog?.status === "running",
    latestLog: latestLog || null,
    lastSinceId: account?.last_since_id || null,
    totalPosts,
    stats,
  };
}

export async function getSyncHistory(uid: string, limit: number = 50): Promise<any[]> {
  await ensureDb();
  return getSyncLogs(uid, limit);
}

// ============================================================
// Image download
// ============================================================

export async function getImageDownloadStatus(): Promise<{ total: number; pending: number }> {
  await ensureDb();
  const { getUndownloadedImageCount } = await import("@/lib/db");
  const pending = await getUndownloadedImageCount();
  return { total: pending, pending };
}

// ============================================================
// Repair
// ============================================================

// ============================================================
// Comment sync — batch driven
// ============================================================

export async function startCommentSync(uid: string): Promise<{ ok: boolean; total: number; error?: string }> {
  await ensureDb();
  const db = getDb();
  const r = await db.execute({ sql: "SELECT COUNT(*) as c FROM weibo_posts WHERE uid=? AND comments_count>0 AND deleted_at IS NULL", args: [uid] });
  return { ok: true, total: Number(r.rows[0].c) };
}

export async function fetchCommentBatch(
  uid: string,
  offset: number,
  batchSize: number = 10
): Promise<{ done: boolean; offset: number; newCount: number; totalSoFar: number; error?: string }> {
  await ensureDb();
  const db = getDb();
  const account = await getAccountByUid(uid);
  if (!account) return { done: true, offset, newCount: 0, totalSoFar: 0, error: "账号不存在" };

  const posts = await db.execute({
    sql: `SELECT p.weibo_id, p.comments_count FROM weibo_posts p
          WHERE p.uid=? AND p.comments_count>0 AND p.deleted_at IS NULL
          AND (SELECT COUNT(*) FROM weibo_comments c WHERE c.weibo_id=p.weibo_id) < p.comments_count
          ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    args: [uid, batchSize, offset],
  });

  if (posts.rows.length === 0) return { done: true, offset, newCount: 0, totalSoFar: 0 };

  let newCount = 0;
  for (const post of posts.rows) {
    const weiboId = String(post.weibo_id);
    const expected = Number(post.comments_count);
    const existing = await db.execute({ sql: "SELECT COUNT(*) as c FROM weibo_comments WHERE weibo_id=?", args: [weiboId] });
    if (Number(existing.rows[0].c) >= expected) continue;

    try {
      const url = `https://weibo.com/ajax/statuses/buildComments?is_reload=1&id=${weiboId}&is_show_bulletin=2&is_mix=0&max_id=0&count=20&uid=${uid}`;
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Referer: `https://weibo.com/u/${uid}`,
          Cookie: account.cookie_sub,
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!resp.ok) continue;
      const json = await resp.json();
      if (!json.data) continue;

      const comments = Object.values(json.data).filter((v: any) => v && v.id);
      for (const c of comments as any[]) {
        if (!c.id) continue;
        try {
          await db.execute({
            sql: "INSERT OR IGNORE INTO weibo_comments (comment_id, weibo_id, uid, content, raw_json, commenter_name, commenter_avatar, created_at, likes_count) VALUES (?,?,?,?,?,?,?,?,?)",
            args: [String(c.id), weiboId, uid, c.text_raw || c.text || "", JSON.stringify(c), c.user?.screen_name || "", c.user?.avatar_hd || null, c.created_at || "", c.like_counts || 0],
          });
          newCount++;
        } catch {}
      }
    } catch {}
  }

  return { done: false, offset: offset + posts.rows.length, newCount, totalSoFar: offset + posts.rows.length };
}

// ============================================================
// Image download — batch driven
// ============================================================

export async function startImageDownload(): Promise<{ ok: boolean; total: number }> {
  await ensureDb();
  const { getUndownloadedImageCount } = await import("@/lib/db");
  const total = await getUndownloadedImageCount();
  return { ok: true, total };
}

export async function fetchImageBatch(
  batchSize: number = 5
): Promise<{ done: boolean; completed: number; total: number; downloaded: number; failed: number; error?: string }> {
  await ensureDb();
  const db = getDb();
  const { downloadImage } = await import("@/lib/weibo-image-downloader");

  const r = await db.execute({ sql: "SELECT id, weibo_id, original_url FROM weibo_images WHERE fetched=0 AND deleted_at IS NULL LIMIT ?", args: [batchSize] });
  if (r.rows.length === 0) return { done: true, completed: 0, total: 0, downloaded: 0, failed: 0 };

  let downloaded = 0, failed = 0;
  for (let i = 0; i < r.rows.length; i++) {
    const img = r.rows[i];
    try {
      const result = await downloadImage(String(img.original_url), String(img.weibo_id), i);
      if (result.success) {
        await db.execute({ sql: "UPDATE weibo_images SET local_path=?, file_size=?, fetched=1 WHERE id=?", args: [result.localPath, result.fileSize, Number(img.id)] });
        downloaded++;
      } else {
        await db.execute({ sql: "UPDATE weibo_images SET fetched=-1 WHERE id=?", args: [Number(img.id)] });
        failed++;
      }
    } catch { failed++; }
  }

  return { done: false, completed: 0, total: r.rows.length, downloaded, failed };
}

export async function fixTimestamps(): Promise<{ fixed: number; total: number }> {
  await ensureDb();
  const db = getDb();
  const result = await db.execute("SELECT id, weibo_id, created_at, raw_json FROM weibo_posts WHERE created_at >= '2026-06-01'");
  let fixed = 0;
  for (const row of result.rows) {
    try {
      const raw = JSON.parse(String(row.raw_json));
      if (!raw.created_at) continue;
      const d = new Date(String(raw.created_at));
      if (isNaN(d.getTime())) continue;
      const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      if (local !== String(row.created_at)) {
        await db.execute({ sql: "UPDATE weibo_posts SET created_at=? WHERE id=?", args: [local, Number(row.id)] });
        fixed++;
      }
    } catch {}
  }
  revalidatePath("/posts");
  revalidatePath("/on-this-day");
  return { fixed, total: result.rows.length };
}

export async function repairImageUrls(uid?: string): Promise<{ fixed: number; total: number }> {
  await ensureDb();
  const db = getDb();
  const result = uid
    ? await db.execute({ sql: "SELECT id, weibo_id, uid, images_json, raw_json FROM weibo_posts WHERE images_json IS NOT NULL AND uid = ?", args: [uid] })
    : await db.execute("SELECT id, weibo_id, uid, images_json, raw_json FROM weibo_posts WHERE images_json IS NOT NULL");
  let fixed = 0;
  for (const row of result.rows) {
    const storedImages = JSON.parse(String(row.images_json));
    if (storedImages.length === 0) continue;
    if (storedImages[0].startsWith("http")) continue;
    try {
      const rawData = JSON.parse(String(row.raw_json));
      const { extractImages } = await import("@/lib/weibo-fetcher");
      const correctUrls = extractImages({ mblog: rawData });
      if (correctUrls.length > 0) {
        await db.execute({ sql: "UPDATE weibo_posts SET images_json = ? WHERE id = ?", args: [JSON.stringify(correctUrls), Number(row.id)] });
        for (const url of correctUrls) {
          try { await insertImage({ weibo_id: String(row.weibo_id), original_url: url }); } catch {}
        }
        fixed++;
      }
    } catch {}
  }
  return { fixed, total: result.rows.length };
}

// ============================================================
// Backup to Turso — one-way copy of local data.db (Stage 4)
// ============================================================

export async function backupToTurso(): Promise<BackupResult> {
  return pushLocalToTurso();
}