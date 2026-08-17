"use server";

import {
  ensureDb,
  getPosts,
  getPostCount,
  getPostById,
  getPostStats,
  getAccounts,
  type PostFilters,
  type WeiboPost,
} from "@/lib/db";

export interface PostWithAccount extends WeiboPost {
  account_nickname?: string | null;
  account_avatar_url?: string | null;
}

export async function checkHealth(): Promise<{ ok: boolean; db: string; posts: number }> {
  try {
    await ensureDb();
    const total = await getPostCount();
    return { ok: true, db: "Turso connected", posts: total };
  } catch (e: any) {
    return { ok: false, db: e.message, posts: 0 };
  }
}

export async function loadPosts(filters: {
  uid?: string;
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  isOriginal?: number;
  hasImages?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ posts: PostWithAccount[]; total: number; page: number; totalPages: number }> {
  await ensureDb();

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const dbFilters: PostFilters = {
    uid: filters.uid || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    keyword: filters.keyword || undefined,
    isOriginal: filters.isOriginal,
    hasImages: filters.hasImages,
    limit: pageSize,
    offset,
  };

  const [posts, total, accounts] = await Promise.all([
    getPosts(dbFilters),
    getPostCount(dbFilters),
    getAccounts(),
  ]);

  const accountMap = new Map(accounts.map((a) => [a.uid, a]));
  const postsWithAccount: PostWithAccount[] = posts.map((p) => {
    const acc = accountMap.get(p.uid);
    return { ...p, account_nickname: acc?.nickname || null, account_avatar_url: acc?.avatar_url || null };
  });

  return { posts: postsWithAccount, total, page, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function loadPostDetail(
  id: number
): Promise<{ post: PostWithAccount; images: any[]; repost: WeiboPost | null; comments: any[] } | null> {
  await ensureDb();

  const { getImages } = await import("@/lib/db");
  const post = await getPostById(id);
  if (!post) return null;

  const images = await getImages(post.weibo_id);
  const accounts = await getAccounts();
  const accountMap = new Map(accounts.map((a) => [a.uid, a]));
  const acc = accountMap.get(post.uid);

  // Parse repost if exists
  let repost: WeiboPost | null = null;
  if (post.repost_json) {
    try {
      const repostData = JSON.parse(post.repost_json);
      repost = {
        id: 0,
        weibo_id: String(repostData.id || ""),
        uid: String(repostData.user?.id || ""),
        content: String(repostData.text || repostData.text_raw || ""),
        raw_json: post.repost_json,
        repost_json: null,
        created_at: post.created_at,
        is_original: 1,
        is_long_text: 0,
        images_json: null,
        source: null,
        reposts_count: repostData.reposts_count || 0,
        comments_count: repostData.comments_count || 0,
        likes_count: repostData.attitudes_count || 0,
        fetched_at: post.fetched_at,
        deleted_at: null,
      };
    } catch {
      // ignore parse errors
    }
  }

  // Get comments
  const { getComments } = await import("@/lib/db");
  const comments = await getComments(post.weibo_id);

  return {
    post: {
      ...post,
      account_nickname: acc?.nickname || null,
      account_avatar_url: acc?.avatar_url || null,
    },
    images,
    repost,
    comments,
  };
}

export async function getFilterStats(filters: PostFilters = {}) {
  await ensureDb();
  const stats = await getPostStats(filters);
  return { ...stats };
}

export async function loadOnThisDay(month: number, day: number): Promise<{ posts: PostWithAccount[]; years: string[] }> {
  await ensureDb();
  const db = getDb();
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const result = await db.execute({
    sql: `SELECT * FROM weibo_posts WHERE deleted_at IS NULL AND substr(created_at,6,5) = ? ORDER BY created_at DESC`,
    args: [`${m}-${d}`],
  });
  const accounts = await getAccounts();
  const accountMap = new Map(accounts.map((a) => [a.uid, a]));
  const posts = result.rows.map((r: any) => ({
    ...rowToPost(r),
    account_nickname: accountMap.get(String(r.uid))?.nickname || null,
    account_avatar_url: accountMap.get(String(r.uid))?.avatar_url || null,
  }));
  const years = [...new Set(posts.map((p) => p.created_at.slice(0, 4)))] as string[];
  years.sort((a, b) => b.localeCompare(a));
  return { posts, years };
}

// Import rowToPost from db
import { getDb } from "@/lib/db";

function rowToPost(row: any): any {
  return {
    id: Number(row.id), weibo_id: String(row.weibo_id), uid: String(row.uid),
    content: String(row.content), raw_json: String(row.raw_json),
    repost_json: row.repost_json ? String(row.repost_json) : null,
    created_at: String(row.created_at), is_original: Number(row.is_original),
    is_long_text: Number(row.is_long_text),
    images_json: row.images_json ? String(row.images_json) : null,
    source: row.source ? String(row.source) : null,
    reposts_count: Number(row.reposts_count), comments_count: Number(row.comments_count),
    likes_count: Number(row.likes_count), fetched_at: String(row.fetched_at),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  };
}

// ============================================================
// Export
// ============================================================

export async function exportJSON(filters: {
  uid?: string; dateFrom?: string; dateTo?: string;
  keyword?: string; isOriginal?: number;
}): Promise<string> {
  await ensureDb();
  const { generateJSON } = await import("@/lib/export");
  const posts = await getPosts({
    uid: filters.uid, dateFrom: filters.dateFrom, dateTo: filters.dateTo,
    keyword: filters.keyword, isOriginal: filters.isOriginal,
    limit: 100000, offset: 0,
  });
  return generateJSON(posts, filters.uid);
}

export async function exportHTML(filters: {
  uid?: string; dateFrom?: string; dateTo?: string;
  keyword?: string; isOriginal?: number;
}): Promise<string> {
  await ensureDb();
  const { generateHTML } = await import("@/lib/export");
  const posts = await getPosts({
    uid: filters.uid, dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined,
    keyword: filters.keyword || undefined, isOriginal: filters.isOriginal,
    limit: 100000, offset: 0,
  });
  return generateHTML(posts, "Weibo Backup Export");
}

export async function exportMarkdownZip(filters: {
  uid?: string; dateFrom?: string; dateTo?: string;
  keyword?: string; isOriginal?: number;
}): Promise<string> {
  await ensureDb();
  const { generateMarkdownZip } = await import("@/lib/export");
  const posts = await getPosts({
    uid: filters.uid, dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined,
    keyword: filters.keyword || undefined, isOriginal: filters.isOriginal,
    limit: 100000, offset: 0,
  });
  const buffer = await generateMarkdownZip(posts);
  return buffer.toString("base64");
}

export async function exportPrintHTML(filters: {
  uid?: string; dateFrom?: string; dateTo?: string;
  keyword?: string; isOriginal?: number;
}): Promise<string> {
  await ensureDb();
  const { generateHTML } = await import("@/lib/export");
  const posts = await getPosts({
    uid: filters.uid, dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined,
    keyword: filters.keyword || undefined, isOriginal: filters.isOriginal,
    limit: 100000, offset: 0,
  });
  return generateHTML(posts, "Weibo Backup — 打印");
}