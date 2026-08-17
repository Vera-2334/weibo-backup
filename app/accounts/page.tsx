"use client";
import { proxyImageUrl } from "@/lib/image-url";

import { useState, useEffect, useRef } from "react";
import Nav from "@/app/nav";
import { loadAccounts, addAccount, testConnection, editAccount, removeAccount } from "./actions";
import type { AccountData } from "./actions";
import { Plus, Trash2, Edit3, CheckCircle, XCircle, Eye, EyeOff, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { refreshProfile } from "./actions";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formUid, setFormUid] = useState("");
  const [formCookie, setFormCookie] = useState("");
  const [formSubp, setFormSubp] = useState("");
  const [showCookie, setShowCookie] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; nickname?: string; avatar_url?: string; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formOriginalOnly, setFormOriginalOnly] = useState(false);
  const [formError, setFormError] = useState("");

  // Edit form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editCookie, setEditCookie] = useState("");
  const [editSubp, setEditSubp] = useState("");
  const [editShowCookie, setEditShowCookie] = useState(false);
  const [editShowAdvanced, setEditShowAdvanced] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadAccounts().then(setAccounts).finally(() => setLoading(false));
  }, []);

  // Auto-validate the cookie (debounced) once UID + SUB are both filled
  useEffect(() => {
    if (!formUid || !formCookie) { setAutoChecking(false); return; }
    const timer = setTimeout(async () => {
      setAutoChecking(true);
      const fd = new FormData();
      fd.set("uid", formUid);
      fd.set("cookie_sub", formCookie);
      if (formSubp) fd.set("cookie_subp", formSubp);
      const r = await testConnection(fd);
      setTestResult(r);
      setAutoChecking(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [formUid, formCookie, formSubp]);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const formData = new FormData();
    formData.set("uid", formUid);
    formData.set("cookie_sub", formCookie);
    formData.set("cookie_subp", formSubp);
    const r = await testConnection(formData);
    setTestResult(r);
    setTesting(false);
  }

  async function handleAdd() {
    setSaving(true);
    setFormError("");
    const formData = new FormData();
    formData.set("uid", formUid);
    formData.set("cookie_sub", formCookie);
    formData.set("cookie_subp", formSubp);
    formData.set("sync_original_only", formOriginalOnly ? "1" : "0");
    if (testResult?.nickname) formData.set("nickname", testResult.nickname);
    if (testResult?.avatar_url) formData.set("avatar_url", testResult.avatar_url);
    const r = await addAccount(formData);
    if (r.ok) {
      setAccounts(await loadAccounts());
      setShowAddForm(false);
      setFormUid("");
      setFormCookie("");
      setFormSubp("");
      setShowAdvanced(false);
      setTestResult(null);
    } else {
      setFormError(r.error || "添加失败");
    }
    setSaving(false);
  }

  async function handleEdit(id: number) {
    const formData = new FormData();
    formData.set("id", String(id));
    if (editNickname) formData.set("nickname", editNickname);
    if (editCookie) formData.set("cookie_sub", editCookie);
    if (editCookie && editSubp) formData.set("cookie_subp", editSubp);
    const r = await editAccount(formData);
    if (r.ok) {
      setAccounts(await loadAccounts());
      setEditingId(null);
    }
  }

  async function handleDelete(id: number) {
    const r = await removeAccount(id);
    if (r.ok) {
      setAccounts(await loadAccounts());
    }
    setDeletingId(null);
  }

  const styles = {
    card: {
      background: "var(--card)",
      borderRadius: "var(--r-lg)",
      padding: "20px 22px",
      boxShadow: "var(--sh-card)",
      marginBottom: 14,
    } as React.CSSProperties,
    input: {
      width: "100%",
      fontFamily: "var(--font-body)",
      fontSize: "0.875rem",
      padding: "9px 12px",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-xs)",
      background: "var(--canvas)",
      color: "var(--ink)",
      outline: "none",
    } as React.CSSProperties,
    btn: {
      fontFamily: "var(--font-body)",
      fontSize: "0.875rem",
      fontWeight: 500,
      padding: "9px 22px",
      borderRadius: "var(--r-sm)",
      border: "none",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
    } as React.CSSProperties,
    btnSm: {
      fontFamily: "var(--font-body)",
      fontSize: "0.8rem",
      padding: "5px 12px",
      borderRadius: "var(--r-xs)",
      border: "1px solid var(--border)",
      background: "var(--card)",
      color: "var(--ink-soft)",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
    } as React.CSSProperties,
  };

  return (
    <div className="page-container">
      <Nav />

      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontFamily: "var(--font-sans)", fontSize: "1.1rem", fontWeight: 600, color: "var(--ink)" }}>
          账号管理
        </h2>
        {!showAddForm && (
          <button
            style={{ ...styles.btn, background: "var(--gold)", color: "#fff" }}
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={16} />
            添加账号
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={styles.card}>
          <h3 style={{ fontFamily: "var(--font-sans)", fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>
            添加微博账号
          </h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: "0.84rem", color: "var(--ink-soft)", marginBottom: 4 }}>微博 UID</label>
            <input
              style={styles.input}
              placeholder="你的微博 UID，如 1234567890"
              value={formUid}
              onChange={(e) => setFormUid(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: "0.84rem", color: "var(--ink-soft)", marginBottom: 4 }}>SUB Cookie</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...styles.input, paddingRight: 40 }}
                type={showCookie ? "text" : "password"}
                placeholder="从浏览器 DevTools 复制 SUB Cookie"
                value={formCookie}
                onChange={(e) => setFormCookie(e.target.value)}
              />
              <button
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}
                onClick={() => setShowCookie(!showCookie)}
              >
                {showCookie ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
              只需 SUB 一个值即可。登录 weibo.com → F12 → Application → Cookies → weibo.com → 找到 SUB → 复制 Value
            </p>

            {autoChecking && (
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                正在校验 Cookie…
              </p>
            )}
            {!autoChecking && formCookie.trim().length > 0 && formCookie.trim().length < 20 && (
              <p style={{ fontSize: "0.75rem", color: "var(--amber)", marginTop: 4 }}>SUB 看起来偏短，请确认复制完整</p>
            )}

            {/* Advanced: optional SUBP */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ background: "none", border: "none", padding: 0, margin: "4px 0 0", cursor: "pointer", color: "var(--gold)", fontSize: "0.78rem", fontWeight: 500 }}
            >
              {showAdvanced ? "收起高级选项" : "高级选项 · SUBP 选填"}
            </button>
            {showAdvanced && (
              <div style={{ marginTop: 8 }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--ink-soft)", marginBottom: 4 }}>SUBP Cookie（选填）</label>
                <input
                  style={styles.input}
                  type={showCookie ? "text" : "password"}
                  placeholder="一般无需填写；仅 SUB 无法同步时再补充"
                  value={formSubp}
                  onChange={(e) => setFormSubp(e.target.value)}
                />
              </div>
            )}

            {/* Only sync original */}
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                id="sync-original-only"
                checked={formOriginalOnly}
                onChange={(e) => setFormOriginalOnly(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--gold)" }}
              />
              <label htmlFor="sync-original-only" style={{ fontSize: "0.84rem", color: "var(--ink-soft)", cursor: "pointer" }}>
                仅同步原创微博（不抓取转发）
              </label>
            </div>
          </div>

          {testResult?.ok && (
            <div style={{ padding: "10px 14px", background: "var(--hairl)", borderRadius: "var(--r-xs)", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle size={18} style={{ color: "var(--green)" }} />
              <span style={{ fontSize: "0.875rem", color: "var(--ink-soft)" }}>
                连接成功！检测到：<strong style={{ color: "var(--ink)" }}>@{testResult.nickname}</strong>
              </span>
            </div>
          )}

          {testResult?.ok === false && (
            <div style={{ padding: "10px 14px", background: "var(--hairl)", borderRadius: "var(--r-xs)", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <XCircle size={18} style={{ color: "var(--red)" }} />
              <span style={{ fontSize: "0.875rem", color: "var(--red)" }}>{testResult.error}</span>
            </div>
          )}

          {formError && (
            <div style={{ padding: "10px 14px", background: "var(--hairl)", borderRadius: "var(--r-xs)", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={18} style={{ color: "var(--red)" }} />
              <span style={{ fontSize: "0.875rem", color: "var(--red)" }}>{formError}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={{ ...styles.btn, background: "var(--hairl)", color: "var(--ink-soft)" }}
              onClick={handleTest}
              disabled={testing || !formUid || !formCookie}
            >
              {testing ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
              测试连接
            </button>
            <button
              style={{ ...styles.btn, background: "var(--gold)", color: "#fff", opacity: testResult?.ok ? 1 : 0.5 }}
              onClick={handleAdd}
              disabled={saving || !testResult?.ok}
            >
              {saving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
              保存
            </button>
            <button
              style={{ ...styles.btn, background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" }}
              onClick={() => { setShowAddForm(false); setTestResult(null); setFormError(""); setFormSubp(""); setShowAdvanced(false); }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Account List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
          <Loader2 size={32} style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
          <p>加载中...</p>
        </div>
      ) : accounts.length === 0 && !showAddForm ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--muted)" }}>
          <p style={{ fontSize: "0.95rem", marginBottom: 4 }}>还没有添加微博账号</p>
          <p style={{ fontSize: "0.84rem" }}>点击上方按钮添加你的第一个账号</p>
        </div>
      ) : (
        accounts.map((a) => (
          <div key={a.id} style={styles.card}>
            {editingId === a.id ? (
              /* Edit Mode */
              <div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", fontSize: "0.84rem", color: "var(--ink-soft)", marginBottom: 4 }}>昵称</label>
                  <input
                    style={styles.input}
                    placeholder={a.nickname || "可选"}
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: "0.84rem", color: "var(--ink-soft)", marginBottom: 4 }}>
                    新 SUB Cookie（留空则保持不变，修改后将重置同步游标）
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      style={{ ...styles.input, paddingRight: 40 }}
                      type={editShowCookie ? "text" : "password"}
                      placeholder="留空则不修改"
                      value={editCookie}
                      onChange={(e) => setEditCookie(e.target.value)}
                    />
                    <button
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}
                      onClick={() => setEditShowCookie(!editShowCookie)}
                    >
                      {editShowCookie ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 4 }}>
                    只需 SUB 一个值即可。登录 weibo.com → F12 → Application → Cookies → weibo.com → 找到 SUB → 复制 Value
                  </p>

                  <button
                    type="button"
                    onClick={() => setEditShowAdvanced(!editShowAdvanced)}
                    style={{ background: "none", border: "none", padding: 0, margin: "4px 0 0", cursor: "pointer", color: "var(--gold)", fontSize: "0.78rem", fontWeight: 500 }}
                  >
                    {editShowAdvanced ? "收起高级选项" : "高级选项 · SUBP 选填"}
                  </button>
                  {editShowAdvanced && (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: 2 }}>SUBP Cookie（选填）</label>
                      <input
                        style={styles.input}
                        type={editShowCookie ? "text" : "password"}
                        placeholder="一般无需填写；仅 SUB 无法同步时再补充"
                        value={editSubp}
                        onChange={(e) => setEditSubp(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...styles.btnSm, background: "var(--gold)", color: "#fff", border: "none" }} onClick={() => handleEdit(a.id)}>保存</button>
                  <button style={styles.btnSm} onClick={() => setEditingId(null)}>取消</button>
                </div>
              </div>
            ) : deletingId === a.id ? (
              /* Delete Confirm */
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <AlertTriangle size={20} style={{ color: "var(--red)" }} />
                <span style={{ fontSize: "0.9rem", color: "var(--ink-soft)" }}>
                  确定删除账号 <strong>{a.nickname || a.uid}</strong>？所有关联的帖子、图片、同步日志将被永久删除。
                </span>
                <button
                  style={{ ...styles.btnSm, background: "var(--red)", color: "#fff", border: "none" }}
                  onClick={() => handleDelete(a.id)}
                >
                  确认删除
                </button>
                <button style={styles.btnSm} onClick={() => setDeletingId(null)}>取消</button>
              </div>
            ) : (
              /* Display Mode */
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Avatar */}
                {a.avatar_url ? (
                  <img
                    src={proxyImageUrl(a.avatar_url || "")}
                    alt=""
                    style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                   
                  />
                ) : (
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--gold-lt), var(--gold))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: "1.1rem", fontWeight: 600,
                      fontFamily: "var(--font-sans)", flexShrink: 0,
                    }}
                  >
                    {(a.nickname || a.uid)[0].toUpperCase()}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)" }}>
                    {a.nickname || a.uid}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    UID: {a.uid}
                  </div>
                  {a.last_sync_at && (
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 2 }}>
                      上次同步: {new Date(a.last_sync_at).toLocaleString("zh-CN")}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...styles.btnSm }} onClick={async () => {
                    const r = await refreshProfile(a.id);
                    if (r.ok) setAccounts(await loadAccounts());
                  }}>
                    <RefreshCw size={14} />
                    刷新
                  </button>
                  <button style={styles.btnSm} onClick={() => { setEditingId(a.id); setEditNickname(a.nickname || ""); setEditCookie(""); setEditSubp(""); setEditShowAdvanced(false); }}>
                    <Edit3 size={14} />
                    编辑
                  </button>
                  <button style={{ ...styles.btnSm, color: "var(--red)", borderColor: "var(--red)" }} onClick={() => setDeletingId(a.id)}>
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}