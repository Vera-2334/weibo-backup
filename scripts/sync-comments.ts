// Sync comments for posts that have them
const { getDb, getAccountByUid, upsertComment, getCommentCount } = require("../lib/db.ts");
const { delay } = require("../lib/weibo-fetcher.ts");

const uid = process.argv[2];
if (!uid) { console.log("Usage: npx tsx scripts/sync-comments.ts <UID>"); process.exit(1); }

async function fetchComments(uid: string, cookie: string, weibo_id: string, maxId: string = "0") {
  const url = `https://weibo.com/ajax/statuses/buildComments?is_reload=1&id=${weibo_id}&is_show_bulletin=2&is_mix=0&max_id=${maxId}&count=20&uid=${uid}`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Referer: `https://weibo.com/u/${uid}`,
      Cookie: cookie,
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  return json;
}

async function main() {
  const { createTables } = require("../lib/db.ts");
  await createTables(); // ensure weibo_comments table exists
  const db = getDb();
  const account = await getAccountByUid(uid);
  if (!account) { console.log("Account not found"); return; }

  // Get posts with comments, ordered by most comments first
  const posts = await db.execute({
    sql: "SELECT weibo_id, comments_count, content FROM weibo_posts WHERE uid=? AND comments_count>0 AND deleted_at IS NULL ORDER BY comments_count DESC",
    args: [uid],
  });

  console.log(`Syncing comments for: ${account.nickname || uid}`);
  console.log(`${posts.rows.length} posts with comments\n`);

  let totalNewComments = 0;
  let postsDone = 0;

  for (const post of posts.rows) {
    postsDone++;
    const weiboId = String(post.weibo_id);
    const expectedComments = Number(post.comments_count);
    const existingInDb = await getCommentCount(weiboId);

    if (existingInDb >= expectedComments) {
      if (postsDone % 50 === 0) console.log(`  ${postsDone}/${posts.rows.length} skipped (${existingInDb} already in DB)`);
      continue;
    }

    try {
      // Fetch first page
      const json = await fetchComments(uid, account.cookie_sub, weiboId);
      if (!json.data) { await delay(2000); continue; }

      // Comments are in numeric keys (0, 1, 2, ...)
      const comments = Object.values(json.data).filter((v: any) => v && v.id);
      let pageNew = 0;

      for (const c of comments as any[]) {
        if (!c.id) continue;
        const { isNew } = await upsertComment({
          comment_id: String(c.id),
          weibo_id: weiboId,
          uid,
          content: c.text_raw || c.text || "",
          raw_json: JSON.stringify(c),
          commenter_name: c.user?.screen_name || "",
          commenter_avatar: c.user?.avatar_hd || c.user?.profile_image_url || undefined,
          created_at: c.created_at || "",
          likes_count: c.like_counts || c.like_count || 0,
        });
        if (isNew) pageNew++;
      }

      totalNewComments += pageNew;

      // Simple display
      const preview = (String(post.content) || "").slice(0, 25).replace(/\n/g, " ");
      if (postsDone % 20 === 0 || pageNew > 0) {
        console.log(`  [${postsDone}/${posts.rows.length}] +${pageNew} cmts | total new: ${totalNewComments} | ${preview}...`);
      }

      await delay(2500);
    } catch (e: any) {
      console.log(`  [${postsDone}] ERROR: ${e.message}`);
      if (e.message.includes("Cookie") || e.message.includes("过期")) {
        console.log("Cookie expired. Stopping.");
        break;
      }
      await delay(5000);
    }
  }

  console.log(`\nDone. Total new comments: ${totalNewComments}`);
}

main().catch(console.error);