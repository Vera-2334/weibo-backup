"use client";

import { useState, useEffect, useRef } from "react";
import Nav from "@/app/nav";
import { startSync, fetchPage, cancelSync, getSyncStatus, getSyncHistory, startCommentSync, fetchCommentBatch, startImageDownload, fetchImageBatch, repairImageUrls, backupToTurso } from "./actions";
import { loadAccounts } from "@/app/accounts/actions";
import type { AccountData } from "@/app/accounts/actions";
import { RefreshCw, CheckCircle, AlertTriangle, Loader2, Clock } from "lucide-react";

export default function SyncPage() {
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [loading, setLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [stage, setStage] = useState("");
  const [extra, setExtra] = useState("");
  const [backupNote, setBackupNote] = useState("");

  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const abortRef = useRef(false);

  useEffect(() => {
    loadAccounts().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0 && !selectedUid) setSelectedUid(accs[0].uid);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedUid) return;
    getSyncStatus(selectedUid).then(setSyncStatus);
    getSyncHistory(selectedUid).then(setSyncHistory);
  }, [selectedUid]);

  async function handleFullSync() {
    if (syncing) return;
    setSyncing(true); setSyncError(""); setBackupNote(""); abortRef.current = false;

    // Stage 1: Posts
    setStage("帖子"); setExtra("");
    const startResult = await startSync(selectedUid);
    if (!startResult.ok) { setSyncError(startResult.error || ""); setSyncing(false); return; }

    let pageNum = startResult.pageNum || 1, done = false;
    while (!done && !abortRef.current) {
      const r = await fetchPage(startResult.logId!, selectedUid, pageNum, startResult.latestPostDate);
      if (r.error) { setSyncError(r.error); break; }
      if (r.retryAfterMs) await new Promise(r2 => setTimeout(r2, r.retryAfterMs));
      setExtra(`${r.totalSoFar} 条`);
      pageNum = r.pageNum; done = r.done;
    }
    if (abortRef.current || syncError) { setSyncing(false); return; }

    // Stage 2: Comments
    setStage("评论"); setExtra("");
    const cr = await startCommentSync(selectedUid);
    let coff = 0, cdone = false;
    while (!cdone && !abortRef.current) {
      const b = await fetchCommentBatch(selectedUid, coff, 10);
      coff = b.offset; cdone = b.done;
      setExtra(`${b.totalSoFar}/${cr.total}`);
    }

    // Stage 3: Images
    setStage("图片"); setExtra("");
    const ir = await startImageDownload();
    if (ir.total > 0) {
      let idone = false;
      while (!idone && !abortRef.current) {
        const b = await fetchImageBatch(5);
        idone = b.done;
        setExtra(`${b.downloaded + (b.failed || 0)} 张`);
      }
    }

    // Stage 4: Backup to Turso（未配置时自动跳过，失败不影响本地）
    setStage("备份到 Turso"); setExtra("");
    const backup = await backupToTurso();
    if (backup.ok && !backup.skipped) {
      const n = Object.values(backup.tables || {}).reduce((a, b) => a + b, 0);
      setBackupNote(`已备份到 Turso（${n} 行，${Math.round((backup.durationMs || 0) / 1000)} 秒）`);
    } else if (!backup.ok) {
      setBackupNote(`Turso 备份失败：${backup.error || "未知错误"}（本地数据不受影响）`);
    }

    setStage(""); setExtra(""); setSyncing(false);
    setSyncStatus(await getSyncStatus(selectedUid));
    setSyncHistory(await getSyncHistory(selectedUid));
  }

  function handleCancel() { abortRef.current = true; setSyncing(false); }

  const styles = {
    card: { background: "var(--card)", borderRadius: "var(--r-lg)", padding: "20px 22px", boxShadow: "var(--sh-card)", marginBottom: 14 } as React.CSSProperties,
    btn: { fontFamily: "var(--font-body)", fontSize: "0.9rem", fontWeight: 500, padding: "11px 32px", borderRadius: "var(--r-sm)", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  };

  if (loading) return (<div className="page-container"><Nav /><div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}><Loader2 size={32} style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite" }} /><p>加载中...</p></div></div>);

  if (accounts.length === 0) return (<div className="page-container"><Nav /><div style={{ textAlign: "center", padding: "80px 20px", color: "var(--muted)" }}><AlertTriangle size={48} style={{ margin: "0 auto 16px", opacity: 0.5 }} /><h2 style={{ fontFamily: "var(--font-sans)", fontSize: "1.15rem", fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>请先添加微博账号</h2><p style={{ fontSize: "0.9rem", lineHeight: 1.7 }}>前往 <a href="/accounts" style={{ color: "var(--gold)", fontWeight: 500 }}>账号管理</a> 添加账号后即可开始同步</p></div></div>);

  const selectedAccount = accounts.find((a) => a.uid === selectedUid);

  return (
    <div className="page-container">
      <Nav />

      {/* Account + Status */}
      <div style={styles.card}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: "0.84rem", color: "var(--ink-soft)", marginBottom: 6 }}>选择账号</label>
          <CustomSelect value={selectedUid} onChange={setSelectedUid} disabled={syncing} options={accounts.map((a) => ({ value: a.uid, label: a.nickname || a.uid }))} />
        </div>

        {syncStatus && (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: "0.85rem", color: "var(--muted)", marginBottom: 16 }}>
            <span>已备份: <strong style={{ color: "var(--ink-soft)" }}>{syncStatus.totalPosts}</strong> 条</span>
            {syncStatus.stats?.dateRange && (<span>{syncStatus.stats.dateRange.earliest?.slice(0, 7)} — {syncStatus.stats.dateRange.latest?.slice(0, 7)}</span>)}
            {syncStatus.latestLog?.finished_at && !syncing && (<span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={14} />上次: {fmtTime(syncStatus.latestLog.finished_at)}</span>)}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button style={{ ...styles.btn, background: syncing ? "var(--hairl)" : "var(--gold)", color: syncing ? "var(--muted)" : "#fff" }} onClick={handleFullSync} disabled={syncing || !selectedAccount?.cookie_sub}>
            <RefreshCw size={18} style={syncing ? { animation: "spin 1s linear infinite" } : undefined} />
            {syncing ? `同步中 · ${stage} ${extra}` : "一键同步"}
          </button>
          {syncing && (<button style={{ ...styles.btn, background: "transparent", color: "var(--red)", border: "1px solid var(--red)" }} onClick={handleCancel}>取消</button>)}
        </div>
      </div>

      {/* Error */}
      {syncError && (<div style={{ ...styles.card, display: "flex", alignItems: "center", gap: 10 }}><AlertTriangle size={18} style={{ color: "var(--red)" }} /><span style={{ fontSize: "0.875rem", color: "var(--red)" }}>{syncError}</span></div>)}

      {/* Backup note */}
      {backupNote && !syncing && (<div style={{ ...styles.card, display: "flex", alignItems: "center", gap: 10 }}><CheckCircle size={18} style={{ color: backupNote.startsWith("Turso 备份失败") ? "var(--red)" : "var(--green)" }} /><span style={{ fontSize: "0.875rem", color: "var(--ink-soft)" }}>{backupNote}</span></div>)}

      {/* History */}
      <div style={styles.card}>
        <h3 style={{ fontFamily: "var(--font-sans)", fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>同步历史</h3>
        {syncHistory.length === 0 ? (<p style={{ fontSize: "0.875rem", color: "var(--muted)", textAlign: "center", padding: "20px 0" }}>暂无同步记录</p>) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.84rem", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "1px solid var(--hairl)" }}><th style={{ padding: "8px 12px", textAlign: "left", color: "var(--muted)", fontWeight: 500 }}>开始时间</th><th style={{ padding: "8px 12px", textAlign: "right", color: "var(--muted)", fontWeight: 500 }}>抓取数</th><th style={{ padding: "8px 12px", textAlign: "right", color: "var(--muted)", fontWeight: 500 }}>新增</th><th style={{ padding: "8px 12px", textAlign: "center", color: "var(--muted)", fontWeight: 500 }}>状态</th></tr></thead>
              <tbody>{syncHistory.map((log: any) => (<tr key={log.id} style={{ borderBottom: "1px solid var(--hairl)" }}><td style={{ padding: "8px 12px", color: "var(--ink-soft)" }}>{fmtTime(log.started_at)}</td><td style={{ padding: "8px 12px", textAlign: "right", color: "var(--ink-soft)" }}>{log.posts_fetched}</td><td style={{ padding: "8px 12px", textAlign: "right", color: "var(--green)", fontWeight: 600 }}>+{log.posts_new}</td><td style={{ padding: "8px 12px", textAlign: "center" }}><StatusBadge status={log.status} /></td></tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomSelect({ value, onChange, options, disabled }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const selected = options.find((o) => o.value === value);
  return (<div ref={ref} style={{ position: "relative", minWidth: 180 }}>
    <button style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", fontFamily: "var(--font-body)", fontSize: "0.875rem", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-xs)", background: "var(--canvas)", color: "var(--ink)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, outline: "none" }} onClick={() => !disabled && setOpen(!open)}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label || value}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--muted)", transition: "transform 200ms", transform: open ? "rotate(180deg)" : undefined }}><path d="m6 9 6 6 6-6"/></svg>
    </button>
    {open && (<div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "var(--card)", borderRadius: "var(--r-sm)", boxShadow: "var(--sh-over)", border: "1px solid var(--border)", minWidth: "100%", zIndex: 30, maxHeight: 240, overflow: "auto" }}>{options.map((o) => (<button key={o.value} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: o.value === value ? "var(--hairl)" : "transparent", fontFamily: "var(--font-body)", fontSize: "0.84rem", color: o.value === value ? "var(--ink)" : "var(--ink-soft)", cursor: "pointer" }} onClick={() => { onChange(o.value); setOpen(false); }} onMouseEnter={(e) => { if (o.value !== value) (e.target as HTMLElement).style.background = "var(--hairl)"; }} onMouseLeave={(e) => { if (o.value !== value) (e.target as HTMLElement).style.background = "transparent"; }}>{o.label}</button>))}</div>)}
  </div>);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { l: string; c: string; b: string }> = { running: { l: "进行中", c: "var(--gold-dk)", b: "var(--gold-wash)" }, completed: { l: "完成", c: "var(--green)", b: "#eef5ef" }, failed: { l: "失败", c: "var(--red)", b: "#fdf0ee" }, cancelled: { l: "已取消", c: "var(--amber)", b: "#fdf5ed" } };
  const s = map[status] || { l: status, c: "var(--muted)", b: "var(--hairl)" };
  return <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 99, fontWeight: 500, color: s.c, background: s.b }}>{s.l}</span>;
}

function fmtTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "-";
  try {
    // SQLite datetime('now') stores UTC as a naive "YYYY-MM-DD HH:MM:SS" string — treat it as UTC
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(isoStr)
      ? isoStr.replace(" ", "T") + "Z"
      : isoStr;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return isoStr.slice(0, 19);
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  catch { return isoStr.slice(0, 19); }
}
