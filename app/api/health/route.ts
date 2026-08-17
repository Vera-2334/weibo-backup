import { NextResponse } from "next/server";
import { checkHealth } from "@/app/posts/actions";
import { ensureDb, getPosts, getPostCount, getAccounts } from "@/lib/db";
import { fixTimestamps } from "@/app/sync/actions";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const test = url.searchParams.get("test");

  if (test === "posts") {
    try {
      await ensureDb();
      const [posts, total, accounts] = await Promise.all([
        getPosts({ limit: 5, offset: 0 }),
        getPostCount(),
        getAccounts(),
      ]);
      return NextResponse.json({ ok: true, posts: posts.length, total, accounts: accounts.length });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message });
    }
  }

  if (test === "fix-time") {
    const result = await fixTimestamps();
    return NextResponse.json(result);
  }

  return checkHealth().then((r) => NextResponse.json(r));
}