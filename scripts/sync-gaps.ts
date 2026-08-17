// Gap-filling sync — uses page=N to jump directly, no since_id, no 414
const { getDb, getAccountByUid, upsertPost, insertImage, updateAccount } = require("../lib/db.ts");
const { parseCard, extractImages, enrichLongTexts, delay } = require("../lib/weibo-fetcher.ts");

const uid = process.argv[2];
const startPage = parseInt(process.argv[3] || "1");
const endPage = parseInt(process.argv[4] || "0");

if (!uid) { console.log("Usage: npx tsx scripts/sync-gaps.ts <UID> [startPage] [endPage]"); process.exit(1); }

async function fetchPage(uid: string, cookie: string, page: number) {
  const url = `https://weibo.com/ajax/statuses/mymblog?uid=${uid}&page=${page}&feature=0`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Referer": `https://weibo.com/u/${uid}`,
      "Cookie": cookie,
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (resp.status === 414) return null; // page doesn't exist
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  if (json.ok !== 1) return null;
  return json.data?.list || [];
}

async function main() {
  const db = getDb();
  const account = await getAccountByUid(uid);
  if (!account) { console.log("Account not found:", uid); return; }

  const dbTotal = (await db.execute({ sql: "SELECT COUNT(*) as c FROM weibo_posts WHERE uid=?", args: [uid] })).rows[0].c as number;
  console.log(`Filling gaps for: ${account.nickname || uid}`);
  console.log(`DB has: ${dbTotal} posts`);
  if (startPage > 1) console.log(`Starting from page ${startPage}`);

  let page = startPage;
  let totalNew = 0;
  let emptyStreak = 0;

  while (true) {
    let cards;
    try {
      cards = await fetchPage(uid, account.cookie_sub, page);
    } catch (e: any) {
      if (e.message.includes("Cookie") || e.message.includes("过期")) {
        console.log("\nCookie expired. Stopping."); break;
      }
      console.log(`Page ${page} ERROR: ${e.message}. Cooling 30s...`);
      await delay(30000);
      continue;
    }

    if (!cards || cards.length === 0) {
      emptyStreak++;
      if (emptyStreak >= 3) {
        console.log(`\n${emptyStreak} empty pages. Total can be reached. ${totalNew} new posts.`);
        break;
      }
      page++;
      continue;
    }

    // Check if we've gone past the DB's date range (for faster scanning)
    if (endPage > 0 && page >= endPage) {
      // Process this page, then stop
    }

    emptyStreak = 0;
    let parsed = cards
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
      if (isNew && post.images_json) {
        const urls = JSON.parse(post.images_json);
        for (const url of urls) {
          try { await insertImage({ weibo_id: post.weibo_id, original_url: url }); } catch {}
        }
      }
    }

    totalNew += batchNew;
    const newTotal = (await db.execute({ sql: "SELECT COUNT(*) as c FROM weibo_posts WHERE uid=?", args: [uid] })).rows[0].c as number;

    if (page % 10 === 0 || batchNew > 0) {
      const latestInPage = cards[0]?.created_at?.slice(0, 19) || "?";
      console.log(`Page ${page}: +${batchNew} new | DB: ${newTotal} | ${latestInPage}`);
    }

    if (batchNew > 0) emptyStreak = 0;
    page++;

    if (endPage > 0 && page > endPage) {
      console.log(`Reached end page ${endPage}. ${totalNew} new posts.`);
      break;
    }

    await delay(3000); // 3s between pages — safe for page=N requests
  }

  await updateAccount(account.id, { last_sync_at: new Date().toISOString() });
  const finalTotal = (await db.execute({ sql: "SELECT COUNT(*) as c FROM weibo_posts WHERE uid=?", args: [uid] })).rows[0].c as number;
  console.log(`Done. DB: ${dbTotal} → ${finalTotal} (+${totalNew})`);
}

main().catch(console.error);