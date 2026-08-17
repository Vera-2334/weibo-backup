"use server";

import { ensureDb, createAccount, getAccounts, getAccountById, updateAccount, deleteAccount } from "@/lib/db";
import { fetchProfile, normalizeCookie } from "@/lib/weibo-fetcher";
import { revalidatePath } from "next/cache";

export interface AccountData {
  id: number;
  uid: string;
  nickname: string | null;
  avatar_url: string | null;
  cookie_sub: string;
  sync_enabled: number;
  last_sync_at: string | null;
  created_at: string;
}

export async function loadAccounts(): Promise<AccountData[]> {
  await ensureDb();
  return getAccounts();
}

export async function addAccount(formData: FormData): Promise<{ ok: boolean; error?: string; account?: AccountData }> {
  await ensureDb();
  const uid = String(formData.get("uid") || "").trim();
  const cookie_sub_raw = String(formData.get("cookie_sub") || "").trim();
  const cookie_subp = String(formData.get("cookie_subp") || "").trim();
  const nickname = String(formData.get("nickname") || "").trim();
  const avatar_url = String(formData.get("avatar_url") || "").trim();
  const sync_original_only = formData.get("sync_original_only") === "1" ? 1 : 0;

  if (!uid) return { ok: false, error: "请输入微博 UID" };
  if (!cookie_sub_raw) return { ok: false, error: "请输入 SUB Cookie" };

  const cookie_sub = normalizeCookie(cookie_sub_raw, cookie_subp);

  try {
    const account = await createAccount({
      uid,
      cookie_sub,
      nickname: nickname || undefined,
      avatar_url: avatar_url || undefined,
      sync_original_only,
    });
    revalidatePath("/accounts");
    revalidatePath("/sync");
    return { ok: true, account };
  } catch (err: any) {
    if (err.message?.includes("UNIQUE")) {
      return { ok: false, error: "该 UID 已添加，请勿重复添加" };
    }
    return { ok: false, error: err.message || "添加失败" };
  }
}

export async function testConnection(formData: FormData): Promise<{ ok: boolean; nickname?: string; avatar_url?: string; error?: string }> {
  const uid = String(formData.get("uid") || "").trim();
  const cookie_sub_raw = String(formData.get("cookie_sub") || "").trim();
  const cookie_subp = String(formData.get("cookie_subp") || "").trim();

  if (!uid || !cookie_sub_raw) {
    return { ok: false, error: "请填写 UID 和 Cookie" };
  }

  const cookie_sub = normalizeCookie(cookie_sub_raw, cookie_subp);

  try {
    const profile = await fetchProfile(uid, { cookieString: cookie_sub });
    return { ok: true, nickname: profile.nickname, avatar_url: profile.avatar_url };
  } catch (err: any) {
    return { ok: false, error: err.message || "连接失败" };
  }
}

export async function editAccount(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await ensureDb();
  const id = Number(formData.get("id"));
  const nickname = String(formData.get("nickname") || "").trim();
  const cookie_sub_raw = String(formData.get("cookie_sub") || "").trim();
  const cookie_subp = String(formData.get("cookie_subp") || "").trim();

  if (!id) return { ok: false, error: "无效的账号 ID" };

  const data: { nickname?: string; cookie_sub?: string; last_since_id?: null } = {};
  if (nickname) data.nickname = nickname;
  if (cookie_sub_raw) {
    data.cookie_sub = normalizeCookie(cookie_sub_raw, cookie_subp);
    data.last_since_id = null; // Reset since_id when cookie changes → force full sync
  }

  try {
    await updateAccount(id, data);
    revalidatePath("/accounts");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "更新失败" };
  }
}

export async function refreshProfile(id: number): Promise<{ ok: boolean; nickname?: string; avatar_url?: string; error?: string }> {
  await ensureDb();
  const account = await getAccountById(id);
  if (!account) return { ok: false, error: "账号不存在" };
  if (!account.cookie_sub) return { ok: false, error: "未配置 Cookie" };

  try {
    const { fetchProfile } = await import("@/lib/weibo-fetcher");
    const profile = await fetchProfile(account.uid, { cookieString: account.cookie_sub });
    await updateAccount(id, { nickname: profile.nickname, avatar_url: profile.avatar_url });
    revalidatePath("/accounts");
    revalidatePath("/posts");
    revalidatePath("/shuffle");
    return { ok: true, nickname: profile.nickname, avatar_url: profile.avatar_url };
  } catch (err: any) {
    return { ok: false, error: err.message || "获取失败" };
  }
}

export async function removeAccount(id: number): Promise<{ ok: boolean; error?: string; deletedCount?: number }> {
  await ensureDb();
  try {
    const account = await getAccountById(id);
    if (!account) return { ok: false, error: "账号不存在" };

    // Count posts before deleting
    const { getPostCount } = await import("@/lib/db");
    const count = await getPostCount({ uid: account.uid });

    await deleteAccount(id);
    revalidatePath("/accounts");
    revalidatePath("/posts");
    revalidatePath("/sync");
    return { ok: true, deletedCount: count };
  } catch (err: any) {
    return { ok: false, error: err.message || "删除失败" };
  }
}