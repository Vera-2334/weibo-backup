#!/bin/bash
# Sync comments for all accounts, keep Mac awake
set -e

# 在下面填入你自己的微博账号 uid 和昵称（此处为占位示例）
ACCOUNTS=("你的uid1" "你的uid2" "你的uid3" "你的uid4")
NAMES=("昵称1" "昵称2" "昵称3" "昵称4")

echo "=== Comment Sync All ==="
echo "Accounts: ${NAMES[*]}"
echo ""

for i in "${!ACCOUNTS[@]}"; do
  ACC_UID="${ACCOUNTS[$i]}"
  ACC_NAME="${NAMES[$i]}"
  echo "=== [$((i+1))/4] $ACC_NAME ($ACC_UID) ==="
  caffeinate -i npx tsx scripts/sync-comments.ts "$ACC_UID"
  echo "Done with $ACC_NAME"
  echo ""
done

echo "=== All done! ==="
echo "Now push to Turso: npx tsx scripts/push-to-turso.ts"