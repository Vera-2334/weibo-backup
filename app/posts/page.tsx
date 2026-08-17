import { ensureDb, getPosts, getPostCount, getAccounts, getPostStats } from "@/lib/db";
import PostsClient from "./client";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  await ensureDb();

  const [posts, total, accounts, stats] = await Promise.all([
    getPosts({ limit: 20, offset: 0 }),
    getPostCount(),
    getAccounts(),
    getPostStats(),
  ]);

  const accountMap = new Map(accounts.map((a) => [a.uid, a]));
  const postsWithAccount = posts.map((p) => ({
    ...p,
    account_nickname: accountMap.get(p.uid)?.nickname || null,
    account_avatar_url: accountMap.get(p.uid)?.avatar_url || null,
  }));

  return (
    <PostsClient
      initialPosts={postsWithAccount}
      initialTotal={total}
      initialStats={stats}
      initialAccountOptions={accounts.map((a) => ({ uid: a.uid, label: a.nickname || a.uid }))}
    />
  );
}