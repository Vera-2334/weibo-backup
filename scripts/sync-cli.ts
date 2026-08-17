// CLI sync script — runs directly without browser, no timeouts
const { getDb, getAccountByUid, upsertPost, insertImage, updateAccount } = require("../lib/db.ts");
const { fetchWeiboPage, parseCard, extractImages, enrichLongTexts, delay } = require("../lib/weibo-fetcher.ts");

const uid = process.argv[2];
if (!uid) { console.log("Usage: npx tsx scripts/sync-cli.ts <UID>"); process.exit(1); }

async function main() {
  const db = getDb();
  const account = await getAccountByUid(uid);
  if (!account) { console.log("Account not found:", uid); return; }

  console.log(`\nSyncing: ${account.nickname || account.uid}`);
  console.log(`DB has: ${(await db.execute({sql:"SELECT COUNT(*) as c FROM weibo_posts WHERE uid=?",args:[uid]})).rows[0].c} posts\n`);

  let sinceId: string | null = null;
  let page = 0;
  let totalNew = 0;
  let emptyStreak = 0;

  while (true) {
    page++;
    let result;

    try {
      result = await fetchWeiboPage(uid, { cookieString: account.cookie_sub }, sinceId);
    } catch (e: any) {
      console.log(`Page ${page} ERROR: ${e.message}`);
      if (e.message.includes("Cookie") || e.message.includes("过期")) {
        console.log("\nCookie expired. Stopping.");
        break;
      }
      // Other error — cool down and retry
      console.log("  Cooling 60s...");
      await delay(60000);
      continue;
    }

    // 414 — page limit reached
    if (result.cards.length === 0) {
      emptyStreak++;
      if (emptyStreak > 3) {
        console.log(`\n${emptyStreak} consecutive empty pages. Likely complete or rate-limited.`);
        console.log(`Total new posts this session: ${totalNew}`);
        // Save checkpoint
        if (sinceId) {
          await updateAccount(account.id, { last_since_id: sinceId });
          console.log("Checkpoint saved. Run again to continue.");
        }
        break;
      }
      console.log(`Page ${page}: empty (${emptyStreak}/3). Cooling 60s...`);
      await delay(60000);
      continue;
    }

    emptyStreak = 0;

    // Parse and enrich
    let parsed = result.cards
      .filter((c: any) => c.mblog || c.id || c.mid)
      .map((c: any) => parseCard(c, uid))
      .filter((p: any) => p.weibo_id);

    if (account.sync_original_only) {
      parsed = parsed.filter((p: any) => p.is_original === 1);
    }

    // Filter out posts from other users (Weibo recommendations)
    parsed = parsed.filter((p: any) => {
      const raw = JSON.parse(p.raw_json);
      const postUid = String(raw.user?.id || raw.uid || "");
      return postUid === uid || postUid === "";
    });

    const enriched = await enrichLongTexts(parsed, { cookieString: account.cookie_sub });

    let batchNew = 0;
    for (const post of enriched) {
      const { isNew } = await upsertPost(post);
      if (isNew) batchNew++;

      const imageUrls = post.images_json ? JSON.parse(post.images_json) : [];
      if (isNew) {
        for (const url of imageUrls) {
          try { await insertImage({ weibo_id: post.weibo_id, original_url: url }); } catch {}
        }
      }
    }

    totalNew += batchNew;
    const total = (await db.execute({sql:"SELECT COUNT(*) as c FROM weibo_posts WHERE uid=?",args:[uid]})).rows[0].c;

    if (page % 5 === 0 || batchNew > 0) {
      console.log(`Page ${page}: +${batchNew} new | total: ${total} | ${result.cards[0]?.created_at?.slice(0,19) || '?'}`);
    }

    // Exit conditions
    if (!result.since_id) {
      console.log(`\nNo more pages. Complete!`);
      console.log(`Total new: ${totalNew} | DB total: ${total}`);
      await updateAccount(account.id, { last_sync_at: new Date().toISOString(), last_since_id: null });
      break;
    }

    // Save checkpoint every 10 pages
    if (page % 10 === 0) {
      await updateAccount(account.id, { last_since_id: result.since_id });
    }

    sinceId = String(result.since_id);
    await delay(5000); // 5s between pages
  }

  console.log("\nDone.");
}

main().catch(console.error);
