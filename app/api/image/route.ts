import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("missing url", { status: 400 });

  if (!url.includes("sinaimg.cn")) {
    return new NextResponse("only sinaimg.cn allowed", { status: 403 });
  }

  // Check local cache first
  try {
    const db = (await import("@/lib/db")).getDb();
    const result = await db.execute({
      sql: "SELECT local_path FROM weibo_images WHERE original_url=? AND fetched=1 LIMIT 1",
      args: [url],
    });
    if (result.rows[0]?.local_path) {
      const localPath = path.join(process.cwd(), "public", String(result.rows[0].local_path));
      if (fs.existsSync(localPath)) {
        const ext = path.extname(localPath).toLowerCase();
        const mime = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : ext === ".webp" ? "image/webp" : "image/jpeg";
        const buffer = fs.readFileSync(localPath);
        return new NextResponse(buffer, {
          headers: { "Content-Type": mime, "Cache-Control": "public, max-age=86400, immutable" },
        });
      }
    }
  } catch {}

  // Fallback: fetch from CDN
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "WeiboBackup/1.0", Accept: "image/*" },
    });
    if (!resp.ok) return new NextResponse("fetch failed", { status: resp.status });
    const buffer = await resp.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": resp.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("proxy error", { status: 502 });
  }
}