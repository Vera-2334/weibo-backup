// One-way backup: copy local SQLite (data.db) → Turso remote database.
//
// Uses TURSO_BACKUP_URL / TURSO_BACKUP_TOKEN (NOT TURSO_DATABASE_URL /
// TURSO_AUTH_TOKEN) — the latter switches the whole app to the remote DB in
// lib/db.ts, which would stop reading the local data.db entirely.
import { createClient } from "@libsql/client";
import path from "path";

const TABLES = [
  "weibo_accounts",
  "weibo_posts",
  "weibo_images",
  "weibo_comments",
  "weibo_sync_log",
];

export interface BackupResult {
  ok: boolean;
  /** 未配置 Turso，直接跳过 */
  skipped?: boolean;
  error?: string;
  /** 每张表复制到的行数 */
  tables?: Record<string, number>;
  durationMs?: number;
}

export async function pushLocalToTurso(): Promise<BackupResult> {
  const url = process.env.TURSO_BACKUP_URL;
  const token = process.env.TURSO_BACKUP_TOKEN;
  if (!url || !token) {
    return { ok: true, skipped: true };
  }

  const startedAt = Date.now();

  // 可选代理：仅在本函数期间生效，结束后恢复（避免影响 weibo.com 的 fetch）
  let restoreDispatcher: (() => void) | undefined;
  const proxy = process.env.TURSO_BACKUP_PROXY;
  if (proxy) {
    const { ProxyAgent, getGlobalDispatcher, setGlobalDispatcher } = await import("undici");
    const original = getGlobalDispatcher();
    setGlobalDispatcher(new ProxyAgent(proxy));
    restoreDispatcher = () => setGlobalDispatcher(original);
  }

  try {
    const local = createClient({ url: `file:${path.join(process.cwd(), "data.db")}` });
    const remote = createClient({ url, authToken: token });

    // 在远程按本地 schema 建表
    const schema = await local.execute(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND sql IS NOT NULL`
    );
    for (const row of schema.rows) {
      try { await remote.execute(String(row.sql)); } catch {}
    }

    // 安全闸：如果远端已有比本地更新的微博，说明本地是旧数据，绝不能清空覆盖，
    // 否则会删掉远端里本地没有的新微博（历史教训：曾因此丢了 7-8 月的数据）。
    try {
      const [localMax, remoteMax] = await Promise.all([
        local.execute(`SELECT MAX(created_at) AS m FROM weibo_posts`),
        remote.execute(`SELECT MAX(created_at) AS m FROM weibo_posts`),
      ]);
      const lm = String(localMax.rows[0]?.m ?? "");
      const rm = String(remoteMax.rows[0]?.m ?? "");
      if (rm && (!lm || rm > lm)) {
        return {
          ok: false,
          error: `远端已有比本地更新的微博（远端最新 ${rm}，本地最新 ${lm || "无"}），已拒绝覆盖以免丢数据。请先在本地完成同步后再备份。`,
          durationMs: Date.now() - startedAt,
        };
      }
    } catch {
      // 远端 weibo_posts 表可能尚不存在等情况，忽略并继续
    }

    const tables: Record<string, number> = {};
    for (const table of TABLES) {
      // 先清空远程表，保证是本地 data.db 的完整镜像（本地已删的行也会同步移除）。
      // 上面已做「远端更新则拒绝」的保护，只有本地 ≥ 远端时才允许清空覆盖。
      await remote.execute(`DELETE FROM ${table}`);

      const count = await local.execute(`SELECT COUNT(*) as c FROM ${table}`);
      const total = Number(count.rows[0].c);
      if (total === 0) { tables[table] = 0; continue; }

      const cols = await local.execute(`PRAGMA table_info(${table})`);
      const colNames = cols.rows.map((r: any) => String(r.name));
      const placeholders = colNames.map(() => "?").join(",");

      const BATCH = 200;
      let offset = 0;
      while (offset < total) {
        const batch = await local.execute(`SELECT * FROM ${table} LIMIT ${BATCH} OFFSET ${offset}`);
        if (batch.rows.length === 0) break;
        const stmts = batch.rows.map((row: any) => ({
          sql: `INSERT INTO ${table} (${colNames.join(",")}) VALUES (${placeholders})`,
          args: colNames.map((c: string) => row[c]),
        }));
        await remote.batch(stmts, "write");
        offset += BATCH;
      }
      tables[table] = total;
    }

    // 索引
    const indexes = await local.execute(
      `SELECT sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND sql IS NOT NULL`
    );
    for (const row of indexes.rows) {
      try { await remote.execute(String(row.sql)); } catch {}
    }

    return { ok: true, tables, durationMs: Date.now() - startedAt };
  } catch (e: any) {
    return { ok: false, error: e.message || "备份失败", durationMs: Date.now() - startedAt };
  } finally {
    if (restoreDispatcher) restoreDispatcher();
  }
}
