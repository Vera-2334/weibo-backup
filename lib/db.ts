import { createClient, type Client } from "@libsql/client";
import path from "path";

// ============================================================
// Connection
// ============================================================

const DB_PATH = path.join(process.cwd(), "data.db");

declare global {
  var _wbDb: Client | undefined;
}

function createDbClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (url && authToken) {
    return createClient({ url, authToken });
  }
  return createClient({ url: `file:${DB_PATH}` });
}

export function getDb(): Client {
  if (!globalThis._wbDb) {
    globalThis._wbDb = createDbClient();
  }
  return globalThis._wbDb;
}

// ============================================================
// TypeScript Interfaces
// ============================================================

export interface WeiboAccount {
  id: number;
  uid: string;
  nickname: string | null;
  avatar_url: string | null;
  cookie_sub: string;
  sync_enabled: number;
  sync_original_only: number;
  last_sync_at: string | null;
  last_since_id: string | null;
  created_at: string;
}

export interface WeiboPost {
  id: number;
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
  fetched_at: string;
  deleted_at: string | null;
}

export interface WeiboImage {
  id: number;
  weibo_id: string;
  original_url: string;
  local_path: string | null;
  file_size: number;
  fetched: number;
  deleted_at: string | null;
}

export interface WeiboSyncLog {
  id: number;
  uid: string;
  started_at: string;
  finished_at: string | null;
  posts_fetched: number;
  posts_new: number;
  status: string;
  error_message: string | null;
}

export interface WeiboComment {
  id: number;
  comment_id: string;
  weibo_id: string;
  uid: string;
  content: string;
  raw_json: string;
  commenter_name: string;
  commenter_avatar: string | null;
  created_at: string;
  likes_count: number;
  reply_to_comment_id: string | null;
  fetched_at: string;
}

// ============================================================
// Schema
// ============================================================

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS weibo_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL UNIQUE,
    nickname TEXT,
    avatar_url TEXT,
    cookie_sub TEXT NOT NULL,
    sync_enabled INTEGER NOT NULL DEFAULT 1,
    sync_original_only INTEGER NOT NULL DEFAULT 0,
    last_sync_at TEXT,
    last_since_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS weibo_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weibo_id TEXT NOT NULL,
    uid TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    raw_json TEXT NOT NULL DEFAULT '{}',
    repost_json TEXT,
    created_at TEXT NOT NULL,
    is_original INTEGER NOT NULL DEFAULT 1,
    is_long_text INTEGER NOT NULL DEFAULT 0,
    images_json TEXT,
    source TEXT,
    reposts_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    likes_count INTEGER NOT NULL DEFAULT 0,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    UNIQUE(weibo_id, uid)
  )`,
  `CREATE TABLE IF NOT EXISTS weibo_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weibo_id TEXT NOT NULL,
    original_url TEXT NOT NULL,
    local_path TEXT,
    file_size INTEGER NOT NULL DEFAULT 0,
    fetched INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS weibo_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id TEXT NOT NULL,
    weibo_id TEXT NOT NULL,
    uid TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    raw_json TEXT NOT NULL DEFAULT '{}',
    commenter_name TEXT NOT NULL DEFAULT '',
    commenter_avatar TEXT,
    created_at TEXT NOT NULL,
    likes_count INTEGER NOT NULL DEFAULT 0,
    reply_to_comment_id TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(comment_id, weibo_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_wb_comments_weibo_id ON weibo_comments(weibo_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wb_comments_uid ON weibo_comments(uid)`,
  `CREATE TABLE IF NOT EXISTS weibo_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    posts_fetched INTEGER NOT NULL DEFAULT 0,
    posts_new INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running',
    error_message TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_wb_posts_weibo_id ON weibo_posts(weibo_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wb_posts_uid ON weibo_posts(uid)`,
  `CREATE INDEX IF NOT EXISTS idx_wb_posts_created_at ON weibo_posts(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_wb_posts_deleted_at ON weibo_posts(deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_wb_images_weibo_id ON weibo_images(weibo_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wb_images_fetched ON weibo_images(fetched)`,
  `CREATE INDEX IF NOT EXISTS idx_wb_sync_log_started ON weibo_sync_log(started_at)`,
  `CREATE INDEX IF NOT EXISTS idx_wb_sync_log_uid ON weibo_sync_log(uid)`,
];

export async function createTables(): Promise<void> {
  const db = getDb();
  // Run DDL sequentially (batch doesn't work well for DDL in libsql)
  for (const stmt of DDL_STATEMENTS) {
    await db.execute(stmt);
  }
  // Migrations for existing databases
  try { await db.execute(`ALTER TABLE weibo_accounts ADD COLUMN sync_original_only INTEGER NOT NULL DEFAULT 0`); } catch {}
}

// ============================================================
// Weibo Accounts
// ============================================================

export async function getAccounts(): Promise<WeiboAccount[]> {
  const db = getDb();
  const result = await db.execute(
    `SELECT * FROM weibo_accounts ORDER BY created_at DESC`
  );
  return result.rows.map(rowToAccount);
}

export async function getAccountByUid(uid: string): Promise<WeiboAccount | undefined> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM weibo_accounts WHERE uid = ?`,
    args: [uid],
  });
  if (result.rows.length === 0) return undefined;
  return rowToAccount(result.rows[0]);
}

export async function getAccountById(id: number): Promise<WeiboAccount | undefined> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM weibo_accounts WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return undefined;
  return rowToAccount(result.rows[0]);
}

export async function createAccount(data: {
  uid: string;
  nickname?: string;
  avatar_url?: string;
  cookie_sub: string;
  sync_original_only?: number;
}): Promise<WeiboAccount> {
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO weibo_accounts (uid, nickname, avatar_url, cookie_sub, sync_original_only)
          VALUES (?, ?, ?, ?, ?)`,
    args: [data.uid, data.nickname || null, data.avatar_url || null, data.cookie_sub, data.sync_original_only || 0],
  });
  const account = await getAccountById(Number(result.lastInsertRowid));
  return account!;
}

export async function updateAccount(
  id: number,
  data: {
    nickname?: string;
    avatar_url?: string;
    cookie_sub?: string;
    last_sync_at?: string;
    last_since_id?: string | null;
  }
): Promise<WeiboAccount | undefined> {
  const db = getDb();
  const existing = await getAccountById(id);
  if (!existing) return undefined;

  const merged = { ...existing, ...data };
  await db.execute({
    sql: `UPDATE weibo_accounts
          SET nickname = ?, avatar_url = ?, cookie_sub = ?, last_sync_at = ?, last_since_id = ?
          WHERE id = ?`,
    args: [
      merged.nickname,
      merged.avatar_url || null,
      merged.cookie_sub,
      merged.last_sync_at || null,
      merged.last_since_id || null,
      id,
    ],
  });
  return getAccountById(id);
}

export async function deleteAccount(id: number): Promise<void> {
  const db = getDb();
  const account = await getAccountById(id);
  if (!account) return;
  const uid = account.uid;
  // Delete related data
  await db.execute({ sql: `DELETE FROM weibo_images WHERE weibo_id IN (SELECT weibo_id FROM weibo_posts WHERE uid = ?)`, args: [uid] });
  await db.execute({ sql: `DELETE FROM weibo_posts WHERE uid = ?`, args: [uid] });
  await db.execute({ sql: `DELETE FROM weibo_sync_log WHERE uid = ?`, args: [uid] });
  await db.execute({ sql: `DELETE FROM weibo_accounts WHERE id = ?`, args: [id] });
}

// ============================================================
// Weibo Posts
// ============================================================

export interface PostFilters {
  uid?: string;
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  isOriginal?: number; // 1=only original, 0=only reposts, undefined=all
  hasImages?: number;  // 1=only with images, undefined=all
  limit?: number;
  offset?: number;
}

export async function getPosts(filters: PostFilters = {}): Promise<WeiboPost[]> {
  const db = getDb();
  const conditions: string[] = ["deleted_at IS NULL"];
  const args: (string | number)[] = [];

  if (filters.uid) {
    conditions.push("uid = ?");
    args.push(filters.uid);
  }
  if (filters.dateFrom) {
    conditions.push("created_at >= ?");
    args.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push("created_at < date(?, '+1 day')");
    args.push(filters.dateTo);
  }
  if (filters.keyword) {
    conditions.push("content LIKE ?");
    args.push(`%${filters.keyword}%`);
  }
  if (filters.isOriginal !== undefined) {
    conditions.push("is_original = ?");
    args.push(filters.isOriginal);
  }
  if (filters.hasImages === 1) {
    conditions.push("images_json IS NOT NULL AND images_json != '[]'");
  }

  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;

  const result = await db.execute({
    sql: `SELECT * FROM weibo_posts
          WHERE ${conditions.join(" AND ")}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });
  return result.rows.map(rowToPost);
}

export async function getPostCount(filters: PostFilters = {}): Promise<number> {
  const db = getDb();
  const c = buildConditions(filters);
  const result = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM weibo_posts WHERE deleted_at IS NULL ${c.sql}`,
    args: c.args,
  });
  return Number(result.rows[0].cnt);
}

export async function getPostById(id: number): Promise<WeiboPost | undefined> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM weibo_posts WHERE id = ? AND deleted_at IS NULL`,
    args: [id],
  });
  if (result.rows.length === 0) return undefined;
  return rowToPost(result.rows[0]);
}

export async function getPostByWeiboId(weibo_id: string, uid: string): Promise<WeiboPost | undefined> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM weibo_posts WHERE weibo_id = ? AND uid = ? AND deleted_at IS NULL`,
    args: [weibo_id, uid],
  });
  if (result.rows.length === 0) return undefined;
  return rowToPost(result.rows[0]);
}

export async function upsertPost(data: {
  weibo_id: string;
  uid: string;
  content: string;
  raw_json: string;
  repost_json?: string | null;
  created_at: string;
  is_original: number;
  is_long_text: number;
  images_json?: string | null;
  source?: string | null;
  reposts_count: number;
  comments_count: number;
  likes_count: number;
}): Promise<{ post: WeiboPost; isNew: boolean }> {
  const db = getDb();
  const existing = await getPostByWeiboId(data.weibo_id, data.uid);
  const isNew = !existing;

  await db.execute({
    sql: `INSERT INTO weibo_posts (
            weibo_id, uid, content, raw_json, repost_json,
            created_at, is_original, is_long_text, images_json,
            source, reposts_count, comments_count, likes_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(weibo_id, uid) DO UPDATE SET
            content = excluded.content,
            raw_json = excluded.raw_json,
            repost_json = excluded.repost_json,
            reposts_count = excluded.reposts_count,
            comments_count = excluded.comments_count,
            likes_count = excluded.likes_count`,
    args: [
      data.weibo_id, data.uid, data.content, data.raw_json,
      data.repost_json || null, data.created_at, data.is_original,
      data.is_long_text, data.images_json || null,
      data.source || null, data.reposts_count, data.comments_count,
      data.likes_count,
    ],
  });

  const post = await getPostByWeiboId(data.weibo_id, data.uid);
  return { post: post!, isNew };
}

export async function deletePost(id: number): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE weibo_posts SET deleted_at = datetime('now') WHERE id = ?`,
    args: [id],
  });
}

export async function getRandomPosts(filters: PostFilters = {}, count: number = 20): Promise<WeiboPost[]> {
  const db = getDb();
  const conditions: string[] = ["deleted_at IS NULL"];
  const args: (string | number)[] = [];

  if (filters.uid) { conditions.push("uid = ?"); args.push(filters.uid); }
  if (filters.dateFrom) { conditions.push("created_at >= ?"); args.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push("created_at < date(?, '+1 day')"); args.push(filters.dateTo); }
  if (filters.isOriginal !== undefined) { conditions.push("is_original = ?"); args.push(filters.isOriginal); }
  if (filters.hasImages === 1) { conditions.push("images_json IS NOT NULL AND images_json != '[]'"); }

  const result = await db.execute({
    sql: `SELECT * FROM weibo_posts
          WHERE ${conditions.join(" AND ")}
          ORDER BY RANDOM()
          LIMIT ?`,
    args: [...args, count],
  });
  return result.rows.map(rowToPost);
}

export async function getPostStats(filters?: PostFilters): Promise<{
  total: number;
  original: number;
  reposts: number;
  withImages: number;
  uidCount: number;
  dateRange: { earliest: string; latest: string } | null;
}> {
  const db = getDb();
  const conditions = buildConditions(filters);
  const condStr = conditions.sql;
  const condArgs = conditions.args;

  // Single query for all stats — reduces 6 round trips to 1
  const r = await db.execute({
    sql: `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_original=1 THEN 1 ELSE 0 END) as original,
      SUM(CASE WHEN is_original=0 THEN 1 ELSE 0 END) as reposts,
      SUM(CASE WHEN images_json IS NOT NULL AND images_json!='[]' THEN 1 ELSE 0 END) as with_images,
      COUNT(DISTINCT uid) as uid_count,
      MIN(created_at) as earliest,
      MAX(created_at) as latest
    FROM weibo_posts WHERE deleted_at IS NULL ${condStr}`,
    args: condArgs,
  });
  const row = r.rows[0];
  return {
    total: Number(row.total),
    original: Number(row.original),
    reposts: Number(row.reposts),
    withImages: Number(row.with_images),
    uidCount: Number(row.uid_count),
    dateRange: row.earliest ? { earliest: String(row.earliest), latest: String(row.latest) } : null,
  };
}

// Build WHERE conditions from filters
function buildConditions(filters?: PostFilters): { sql: string; args: (string | number)[] } {
  const conditions: string[] = [];  // "deleted_at IS NULL" added by caller
  const args: (string | number)[] = [];

  if (filters?.uid) { conditions.push("uid = ?"); args.push(filters.uid); }
  if (filters?.dateFrom) { conditions.push("created_at >= ?"); args.push(filters.dateFrom); }
  if (filters?.dateTo) { conditions.push("created_at < date(?, '+1 day')"); args.push(filters.dateTo); }
  if (filters?.keyword) { conditions.push("content LIKE ?"); args.push(`%${filters.keyword}%`); }
  if (filters?.isOriginal !== undefined) { conditions.push("is_original = ?"); args.push(filters.isOriginal); }
  if (filters?.hasImages === 1) { conditions.push("images_json IS NOT NULL AND images_json != '[]'"); }

  const sql = conditions.length > 0 ? "AND " + conditions.join(" AND ") : "";
  return { sql, args };
}

// ============================================================
// Weibo Images
// ============================================================

export async function getImages(weibo_id?: string, onlyUndownloaded?: boolean): Promise<WeiboImage[]> {
  const db = getDb();
  const conditions: string[] = ["deleted_at IS NULL"];
  const args: (string | number)[] = [];

  if (weibo_id) { conditions.push("weibo_id = ?"); args.push(weibo_id); }
  if (onlyUndownloaded) { conditions.push("fetched = 0"); args.push(0); }

  const result = await db.execute({
    sql: `SELECT * FROM weibo_images WHERE ${conditions.join(" AND ")}`,
    args,
  });
  return result.rows.map(rowToImage);
}

export async function insertImage(data: {
  weibo_id: string;
  original_url: string;
}): Promise<WeiboImage> {
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO weibo_images (weibo_id, original_url) VALUES (?, ?)`,
    args: [data.weibo_id, data.original_url],
  });
  const rows = await db.execute({
    sql: `SELECT * FROM weibo_images WHERE id = ?`,
    args: [Number(result.lastInsertRowid)],
  });
  return rowToImage(rows.rows[0]);
}

export async function updateImage(
  id: number,
  data: { local_path?: string; file_size?: number; fetched?: number }
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE weibo_images
          SET local_path = COALESCE(?, local_path),
              file_size = COALESCE(?, file_size),
              fetched = COALESCE(?, fetched)
          WHERE id = ?`,
    args: [data.local_path ?? null, data.file_size ?? null, data.fetched ?? null, id],
  });
}

export async function getUndownloadedImageCount(): Promise<number> {
  const db = getDb();
  const result = await db.execute(
    `SELECT COUNT(*) as cnt FROM weibo_images WHERE fetched = 0 AND deleted_at IS NULL`
  );
  return Number(result.rows[0].cnt);
}

// ============================================================
// Sync Log
// ============================================================

export async function createSyncLog(uid: string): Promise<WeiboSyncLog> {
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO weibo_sync_log (uid, status, started_at) VALUES (?, 'running', ?)`,
    args: [uid, new Date().toISOString()],
  });
  const rows = await db.execute({
    sql: `SELECT * FROM weibo_sync_log WHERE id = ?`,
    args: [Number(result.lastInsertRowid)],
  });
  return rowToSyncLog(rows.rows[0]);
}

export async function updateSyncLog(
  id: number,
  data: {
    finished_at?: string;
    posts_fetched?: number;
    posts_new?: number;
    status?: string;
    error_message?: string | null;
  }
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE weibo_sync_log
          SET finished_at = COALESCE(?, finished_at),
              posts_fetched = COALESCE(?, posts_fetched),
              posts_new = COALESCE(?, posts_new),
              status = COALESCE(?, status),
              error_message = COALESCE(?, error_message)
          WHERE id = ?`,
    args: [
      data.finished_at ?? null,
      data.posts_fetched ?? null,
      data.posts_new ?? null,
      data.status ?? null,
      data.error_message ?? null,
      id,
    ],
  });
}

export async function getLatestSyncLog(uid?: string): Promise<WeiboSyncLog | undefined> {
  const db = getDb();
  const sql = uid
    ? `SELECT * FROM weibo_sync_log WHERE uid = ? ORDER BY started_at DESC LIMIT 1`
    : `SELECT * FROM weibo_sync_log ORDER BY started_at DESC LIMIT 1`;
  const args = uid ? [uid] : [];
  const result = await db.execute({ sql, args });
  if (result.rows.length === 0) return undefined;
  return rowToSyncLog(result.rows[0]);
}

export async function getSyncLogs(uid?: string, limit: number = 50): Promise<WeiboSyncLog[]> {
  const db = getDb();
  const sql = uid
    ? `SELECT * FROM weibo_sync_log WHERE uid = ? ORDER BY started_at DESC LIMIT ?`
    : `SELECT * FROM weibo_sync_log ORDER BY started_at DESC LIMIT ?`;
  const args = uid ? [uid, limit] : [limit];
  const result = await db.execute({ sql, args });
  return result.rows.map(rowToSyncLog);
}

// ============================================================
// Row → Type mappers
// ============================================================

function rowToAccount(row: any): WeiboAccount {
  return {
    id: Number(row.id),
    uid: String(row.uid),
    nickname: row.nickname ? String(row.nickname) : null,
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    cookie_sub: String(row.cookie_sub),
    sync_enabled: Number(row.sync_enabled),
    sync_original_only: Number(row.sync_original_only),
    last_sync_at: row.last_sync_at ? String(row.last_sync_at) : null,
    last_since_id: row.last_since_id ? String(row.last_since_id) : null,
    created_at: String(row.created_at),
  };
}

function rowToPost(row: any): WeiboPost {
  return {
    id: Number(row.id),
    weibo_id: String(row.weibo_id),
    uid: String(row.uid),
    content: String(row.content),
    raw_json: String(row.raw_json),
    repost_json: row.repost_json ? String(row.repost_json) : null,
    created_at: String(row.created_at),
    is_original: Number(row.is_original),
    is_long_text: Number(row.is_long_text),
    images_json: row.images_json ? String(row.images_json) : null,
    source: row.source ? String(row.source) : null,
    reposts_count: Number(row.reposts_count),
    comments_count: Number(row.comments_count),
    likes_count: Number(row.likes_count),
    fetched_at: String(row.fetched_at),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  };
}

function rowToImage(row: any): WeiboImage {
  return {
    id: Number(row.id),
    weibo_id: String(row.weibo_id),
    original_url: String(row.original_url),
    local_path: row.local_path ? String(row.local_path) : null,
    file_size: Number(row.file_size),
    fetched: Number(row.fetched),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  };
}

function rowToSyncLog(row: any): WeiboSyncLog {
  return {
    id: Number(row.id),
    uid: String(row.uid),
    started_at: String(row.started_at),
    finished_at: row.finished_at ? String(row.finished_at) : null,
    posts_fetched: Number(row.posts_fetched),
    posts_new: Number(row.posts_new),
    status: String(row.status),
    error_message: row.error_message ? String(row.error_message) : null,
  };
}

// ============================================================
// Initialization — call on first DB access
// ============================================================

// ============================================================
// Weibo Comments
// ============================================================

export async function getCommentCount(weibo_id: string): Promise<number> {
  const db = getDb();
  const r = await db.execute({sql:'SELECT COUNT(*) as c FROM weibo_comments WHERE weibo_id=?', args:[weibo_id]});
  return Number(r.rows[0].c);
}

export async function getComments(weibo_id: string): Promise<WeiboComment[]> {
  const db = getDb();
  const r = await db.execute({sql:'SELECT * FROM weibo_comments WHERE weibo_id=? ORDER BY likes_count DESC, created_at ASC', args:[weibo_id]});
  return r.rows.map(rowToComment);
}

export async function upsertComment(data: { comment_id: string; weibo_id: string; uid: string; content: string; raw_json: string; commenter_name: string; commenter_avatar?: string; created_at: string; likes_count: number; reply_to_comment_id?: string }): Promise<{ comment: WeiboComment; isNew: boolean }> {
  const db = getDb();
  const existing = await db.execute({sql:'SELECT id FROM weibo_comments WHERE comment_id=? AND weibo_id=?', args:[data.comment_id, data.weibo_id]});
  const isNew = existing.rows.length === 0;
  await db.execute({sql:'INSERT OR REPLACE INTO weibo_comments (comment_id, weibo_id, uid, content, raw_json, commenter_name, commenter_avatar, created_at, likes_count, reply_to_comment_id) VALUES (?,?,?,?,?,?,?,?,?,?)', args:[data.comment_id, data.weibo_id, data.uid, data.content, data.raw_json, data.commenter_name, data.commenter_avatar||null, data.created_at, data.likes_count, data.reply_to_comment_id||null]});
  const r = await db.execute({sql:'SELECT * FROM weibo_comments WHERE comment_id=? AND weibo_id=?', args:[data.comment_id, data.weibo_id]});
  return { comment: rowToComment(r.rows[0]), isNew };
}

function rowToComment(row: any): WeiboComment {
  return { id: Number(row.id), comment_id: String(row.comment_id), weibo_id: String(row.weibo_id), uid: String(row.uid), content: String(row.content), raw_json: String(row.raw_json), commenter_name: String(row.commenter_name), commenter_avatar: row.commenter_avatar ? String(row.commenter_avatar) : null, created_at: String(row.created_at), likes_count: Number(row.likes_count), reply_to_comment_id: row.reply_to_comment_id ? String(row.reply_to_comment_id) : null, fetched_at: String(row.fetched_at) };
}

let initialized = false;

export async function ensureDb(): Promise<void> {
  if (initialized) return;
  // On Turso/remote, skip DDL — tables already exist
  if (process.env.TURSO_DATABASE_URL) {
    initialized = true;
    return;
  }
  await createTables();
  initialized = true;
}