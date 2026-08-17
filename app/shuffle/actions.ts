"use server";

import { ensureDb, getRandomPosts, getAccounts, type WeiboPost } from "@/lib/db";

export async function loadRandomPosts(filters: {
  uid?: string;
  dateFrom?: string;
  dateTo?: string;
  isOriginal?: number;
  count?: number;
}): Promise<{ posts: (WeiboPost & { account_nickname?: string | null })[] }> {
  await ensureDb();

  const posts = await getRandomPosts(
    {
      uid: filters.uid || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      isOriginal: filters.isOriginal,
      hasImages: undefined,
    },
    filters.count || 20
  );

  const accounts = await getAccounts();
  const accountMap = new Map(accounts.map((a) => [a.uid, a]));

  const postsWithAccount = posts.map((p) => {
    const acc = accountMap.get(p.uid);
    return {
      ...p,
      account_nickname: acc?.nickname || null,
      account_avatar_url: acc?.avatar_url || null,
    };
  });

  return { posts: postsWithAccount };
}