// 手动把本地 data.db 备份到 Turso（等价于同步流程里的“备份到 Turso”阶段）。
// 运行：npx tsx scripts/push-to-turso.ts
import fs from "fs";
import path from "path";
import { pushLocalToTurso } from "../lib/turso-backup";

// tsx 不会自动加载 .env.local，这里手动读一下（只补不覆盖）
(function loadEnv(file: string) {
  try {
    const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) {
        const k = m[1].trim();
        const v = m[2].trim().replace(/^["']|["']$/g, "");
        if (process.env[k] === undefined) process.env[k] = v;
      }
    }
  } catch {}
})(".env.local");

pushLocalToTurso()
  .then((r) => {
    if (r.skipped) {
      console.log("未配置 Turso（请在 .env.local 设置 TURSO_BACKUP_URL / TURSO_BACKUP_TOKEN）。");
      return;
    }
    if (!r.ok) {
      console.error("备份失败：", r.error);
      process.exit(1);
    }
    console.log("备份完成，耗时", Math.round((r.durationMs || 0) / 1000), "秒：");
    for (const [table, n] of Object.entries(r.tables || {})) {
      console.log(`  ${table}: ${n} 行`);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
