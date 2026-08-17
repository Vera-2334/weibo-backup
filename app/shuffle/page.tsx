"use client";
import { proxyImageUrl } from "@/lib/image-url";

import { useState, useEffect, useCallback, useRef } from "react";
import Nav from "@/app/nav";
import { loadRandomPosts } from "./actions";
import type { WeiboPost } from "@/lib/db";
import { Shuffle, Repeat, FileText, Heart, ChevronDown, ImageIcon, X } from "lucide-react";
import DatePicker from "@/app/components/date-picker";

type ShufflePost = WeiboPost & { account_nickname?: string | null };

const BATCH_SIZE = 20;

export default function ShufflePage() {
  const [posts, setPosts] = useState<ShufflePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [seenCount, setSeenCount] = useState(0);

  const [filterUid, setFilterUid] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterType, setFilterType] = useState<"all" | "original" | "repost">("all");
  const [accountOptions, setAccountOptions] = useState<{ uid: string; label: string }[]>([]);
  const [detail, setDetail] = useState<ShufflePost | null>(null);

  useEffect(() => {
    import("@/app/accounts/actions").then(({ loadAccounts }) => {
      loadAccounts().then((accs) => {
        setAccountOptions(accs.map((a) => ({ uid: a.uid, label: a.nickname || a.uid })));
      });
    });
  }, []);

  // 打开详情弹窗时锁定背景滚动，让滚动聚焦在弹窗内容上
  useEffect(() => {
    if (!detail) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [detail]);

  const fetchPosts = useCallback(async (append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    const result = await loadRandomPosts({
      uid: filterUid || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
      isOriginal: filterType === "original" ? 1 : filterType === "repost" ? 0 : undefined,
      count: BATCH_SIZE,
    });
    if (append) {
      setPosts((prev) => [...prev, ...result.posts]);
    } else {
      setPosts(result.posts);
      setSeenCount(0);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [filterUid, filterDateFrom, filterDateTo, filterType]);

  useEffect(() => { fetchPosts(false); }, [fetchPosts]);

  function shuffle() { setSeenCount((c) => c + posts.length); fetchPosts(false); }
  function loadMore() { fetchPosts(true); }

  const leftPosts = posts.filter((_, i) => i % 2 === 0);
  const rightPosts = posts.filter((_, i) => i % 2 === 1);

  return (
    <div className="page-container">
      <Nav />

      {/* Filter bar — unified with posts */}
      <div style={{ background: "var(--card)", borderRadius: "var(--r-lg)", padding: "18px 22px", boxShadow: "var(--sh-card)", marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <CustomSelect
            value={filterUid}
            onChange={setFilterUid}
            options={[{ value: "", label: "全部账号" }, ...accountOptions.map((a) => ({ value: a.uid, label: a.label }))]}
          />
          <SegmentedControl
            value={filterType}
            onChange={setFilterType}
            options={[
              { value: "all", label: "全部", icon: FileText },
              { value: "original", label: "原创", icon: PenIcon },
              { value: "repost", label: "转发", icon: Repeat },
            ]}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <DatePicker value={filterDateFrom} onChange={setFilterDateFrom} placeholder="开始日期" />
          <span style={{ fontSize: "0.84rem", color: "var(--muted)" }}>至</span>
          <DatePicker value={filterDateTo} onChange={setFilterDateTo} placeholder="结束日期" />
          <button style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-body)", fontSize: "0.84rem", fontWeight: 500, padding: "6px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--gold)", color: "#fff", cursor: "pointer" }} onClick={shuffle} disabled={loading}>
            <Shuffle size={15} />换一批
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--muted)", padding: "0 4px", marginBottom: 14 }}>
        <span>随机浏览中 · 已看 {seenCount + posts.length} 条</span>
      </div>

      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[1, 2, 3, 4].map((i) => (<div key={i} className="skeleton" style={{ height: i % 2 === 0 ? 180 : 220, borderRadius: "var(--r-sm)" }} />))}
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--muted)" }}>
          <ImageIcon size={48} style={{ margin: "0 auto 16px", opacity: 0.5 }} />
          <p style={{ fontSize: "0.95rem" }}>还没有内容可以随机浏览</p>
          <p style={{ fontSize: "0.84rem", marginTop: 4 }}>同步微博后即可在这里随机翻阅</p>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {leftPosts.map((post, idx) => (<ShuffleCard key={`${post.uid}-${post.weibo_id}`} post={post} onClick={() => setDetail(post)} delay={idx * 0.05} />))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rightPosts.map((post, idx) => (<ShuffleCard key={`${post.uid}-${post.weibo_id}`} post={post} onClick={() => setDetail(post)} delay={idx * 0.05 + 0.03} />))}
            </div>
          </div>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <button style={{ fontFamily: "var(--font-body)", fontSize: "0.84rem", fontWeight: 500, padding: "8px 28px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--card)", color: "var(--ink-soft)", cursor: "pointer" }} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "加载中..." : "加载更多"}
            </button>
          </div>
        </>
      )}

      {detail && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: "var(--card)", borderRadius: "var(--r-lg)", maxWidth: 540, width: "100%", maxHeight: "85vh", overflow: "auto", padding: 22, boxShadow: "var(--sh-over)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: "0.84rem", color: "var(--muted)" }}>{postDate(detail.created_at)} · {detail.account_nickname || detail.uid}</span>
              <button style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }} onClick={() => setDetail(null)}><X size={20} /></button>
            </div>
            <div style={{ fontSize: "0.95rem", lineHeight: 1.8, color: "var(--ink-soft)", whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 14 }}>{detail.content}</div>
            {(() => {
              const images = detail.images_json ? JSON.parse(detail.images_json) as string[] : [];
              if (images.length === 0) return null;
              return <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>{images.map((url, i) => (<img referrerPolicy="no-referrer" key={i} src={proxyImageUrl(url)} alt={`图片 ${i + 1}`} style={{ width: "100%", borderRadius: "var(--r-sm)" }} />))}</div>;
            })()}
            <div style={{ display: "flex", gap: 14, fontSize: "0.82rem", color: "var(--muted)", paddingTop: 10, borderTop: "1px solid var(--hairl)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><RepeatIcon /> {detail.reposts_count}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MsgIcon /> {detail.comments_count}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}><Heart size={14} /> {detail.likes_count}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== Sub-components =====================

function ShuffleCard({ post, onClick, delay }: { post: ShufflePost; onClick: () => void; delay: number }) {
  const images = post.images_json ? JSON.parse(post.images_json) as string[] : [];
  const hasImage = images.length > 0;
  const isRepost = !post.is_original;
  return (
    <article style={{ background: hasImage ? "var(--card)" : cardBg(), borderRadius: "var(--r-sm)", boxShadow: hasImage ? "var(--sh-card)" : "none", overflow: "hidden", cursor: "pointer", transition: "box-shadow 250ms var(--ease-out)", animation: "fadeUp 0.4s var(--ease-out) both", animationDelay: `${delay}s` }} onClick={onClick}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--sh-over)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = hasImage ? "var(--sh-card)" : "none"; }}>
      {hasImage && (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", overflow: "hidden", background: "var(--hairl)" }}>
          <img referrerPolicy="no-referrer" src={proxyImageUrl(images[0])} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", top: 6, left: 6, display: "flex", gap: 4 }}>
            {isRepost && <span style={{ background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: "0.68rem", padding: "2px 6px", borderRadius: 99, backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: 2 }}><Repeat size={10} />转发</span>}
            {post.is_long_text === 1 && <span style={{ background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: "0.68rem", padding: "2px 6px", borderRadius: 99, backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: 2 }}><FileText size={10} />长文</span>}
          </div>
          {images.length > 1 && <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: "0.68rem", padding: "2px 6px", borderRadius: 99, backdropFilter: "blur(4px)" }}>1/{images.length}</span>}
        </div>
      )}
      <div style={{ padding: hasImage ? "10px 12px" : "14px 16px" }}>
        <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
          {(post as any).account_avatar_url ? (
            <img referrerPolicy="no-referrer" src={proxyImageUrl((post as any).account_avatar_url || "")} alt="" style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover", display: "inline-flex" }} />
          ) : (
            <span style={{ width: 16, height: 16, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: !isRepost ? "var(--gold-lt)" : "var(--slate)", color: "#fff", fontSize: "0.6rem", fontWeight: 600, fontFamily: "var(--font-sans)" }}>{(post.account_nickname || post.uid)[0]}</span>
          )}
          {post.account_nickname || post.uid}
        </div>
        <p style={{ fontSize: hasImage ? "0.82rem" : "0.9rem", lineHeight: hasImage ? 1.5 : 1.65, color: hasImage ? "var(--ink-soft)" : "var(--ink)", display: "-webkit-box", WebkitLineClamp: hasImage ? 3 : 5, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word", marginBottom: hasImage ? 4 : 6 }}>{post.content}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.7rem", color: "var(--muted)" }}>
          <span>{postDate(post.created_at)}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: "auto" }}><Heart size={11} />{post.likes_count}</span>
        </div>
      </div>
    </article>
  );
}

function SegmentedControl({ value, onChange, options }: { value: string; onChange: (v: any) => void; options: { value: string; label: string; icon: React.ComponentType<any> }[] }) {
  return (
    <div style={{ display: "flex", gap: 1, background: "var(--hairl)", borderRadius: "var(--r-xs)", padding: 2 }}>
      {options.map((opt) => { const Icon = opt.icon; const active = value === opt.value;
        return <button key={opt.value} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: "calc(var(--r-xs) - 1px)", border: "none", background: active ? "var(--card)" : "transparent", color: active ? "var(--ink)" : "var(--muted)", fontSize: "0.84rem", fontFamily: "var(--font-body)", cursor: "pointer", boxShadow: active ? "var(--sh-card)" : "none", transition: "color 150ms, background 150ms, box-shadow 150ms", whiteSpace: "nowrap" }} onClick={() => onChange(opt.value)}><Icon size={14} />{opt.label}</button>;
      })}
    </div>
  );
}

function CustomSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={ref} style={{ position: "relative", minWidth: 130 }}>
      <button style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", fontFamily: "var(--font-body)", fontSize: "0.875rem", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-xs)", background: "var(--canvas)", color: "var(--ink)", cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label || value}</span>
        <ChevronDown size={14} style={{ color: "var(--muted)", flexShrink: 0, transition: "transform 200ms", transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "var(--card)", borderRadius: "var(--r-sm)", boxShadow: "var(--sh-over)", border: "1px solid var(--border)", minWidth: "100%", zIndex: 30, maxHeight: 240, overflow: "auto" }}>
          {options.map((o) => (
            <button key={o.value} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: o.value === value ? "var(--hairl)" : "transparent", fontFamily: "var(--font-body)", fontSize: "0.84rem", color: o.value === value ? "var(--ink)" : "var(--ink-soft)", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => { onChange(o.value); setOpen(false); }}
              onMouseEnter={(e) => { if (o.value !== value) (e.target as HTMLElement).style.background = "var(--hairl)"; }}
              onMouseLeave={(e) => { if (o.value !== value) (e.target as HTMLElement).style.background = "transparent"; }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PenIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>; }
function RepeatIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>; }
function MsgIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }

function cardBg(): string { const colors = ["#fdf8f2", "#f5f6f8", "#f8f5f0", "#f6f7f5"]; return colors[Math.floor(Math.random() * 4)]; }
function postDate(dateStr: string): string { try { const d = new Date(dateStr); if (isNaN(d.getTime())) return dateStr.slice(0, 16); const hh = String(d.getHours()).padStart(2, "0"); const mm = String(d.getMinutes()).padStart(2, "0"); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${hh}:${mm}`; } catch { return dateStr.slice(0, 16); } }