"use client";
import { proxyImageUrl } from "@/lib/image-url";

import { useState, useEffect } from "react";
import Nav from "@/app/nav";
import { loadOnThisDay, loadPostDetail } from "@/app/posts/actions";
import type { PostWithAccount } from "@/app/posts/actions";
import type { WeiboImage, WeiboPost } from "@/lib/db";
import { Pen, Repeat, FileText, Smartphone, Heart, MessageCircle, ChevronDown, X, CalendarDays } from "lucide-react";

export default function OnThisDayPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [day, setDay] = useState(new Date().getDate());
  const [posts, setPosts] = useState<PostWithAccount[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReposts, setExpandedReposts] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<{ post: PostWithAccount; images: WeiboImage[]; repost: WeiboPost | null; comments?: any[] } | null>(null);

  async function fetch(m: number, d: number) {
    setLoading(true);
    const r = await loadOnThisDay(m, d);
    setPosts(r.posts);
    setYears(r.years);
    setLoading(false);
  }

  useEffect(() => { fetch(month, day); }, []);

  // 打开详情弹窗时锁定背景滚动，让滚动聚焦在弹窗内容上
  useEffect(() => {
    if (!detail) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [detail]);

  async function openDetail(id: number) {
    const d = await loadPostDetail(id);
    setDetail(d);
  }

  function toggleRepost(key: string) {
    setExpandedReposts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Group by year
  const yearGroups: { year: string; posts: PostWithAccount[] }[] = [];
  for (const post of posts) {
    const y = post.created_at.slice(0, 4);
    const last = yearGroups[yearGroups.length - 1];
    if (last && last.year === y) last.posts.push(post);
    else yearGroups.push({ year: y, posts: [post] });
  }

  return (
    <div className="page-container">
      <Nav />

      {/* Date picker card */}
      <div style={{ background: "var(--card)", borderRadius: "var(--r-lg)", padding: "14px 22px", boxShadow: "var(--sh-card)", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select value={month} onChange={(e) => { const m = Number(e.target.value); setMonth(m); fetch(m, day); }}
            style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-xs)", background: "var(--canvas)", color: "var(--ink)", outline: "none", cursor: "pointer" }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (<option key={m} value={m}>{m}月</option>))}
          </select>
          <select value={day} onChange={(e) => { const d = Number(e.target.value); setDay(d); fetch(month, d); }}
            style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-xs)", background: "var(--canvas)", color: "var(--ink)", outline: "none", cursor: "pointer" }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (<option key={d} value={d}>{d}日</option>))}
          </select>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && posts.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.84rem", color: "var(--muted)", padding: "0 4px", marginBottom: 22 }}>
          <span>共 <strong style={{ color: "var(--ink-soft)" }}>{posts.length}</strong> 条微博</span>
          <span>来自 <strong style={{ color: "var(--ink-soft)" }}>{new Set(posts.map(p => p.uid)).size}</strong> 个账号</span>
          <span><strong style={{ color: "var(--ink-soft)" }}>{years.length}</strong> 个年份</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (<div key={i} className="skeleton" style={{ height: 160, borderRadius: "var(--r-md)" }} />))}
        </div>
      )}

      {/* Empty */}
      {!loading && posts.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--muted)" }}>
          <CalendarDays size={48} style={{ margin: "0 auto 16px", opacity: 0.5 }} />
          <p style={{ fontSize: "0.95rem" }}>{month}月{day}日还没有微博记录</p>
          <p style={{ fontSize: "0.84rem", marginTop: 4 }}>试试选其他日期</p>
        </div>
      )}

      {/* Timeline */}
      {!loading && posts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {yearGroups.map((group) => (
            <div key={group.year}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0 4px" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{group.year}</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>
              {group.posts.map((post, idx) => {
                const postKey = `${post.uid}-${post.weibo_id}`;
                const isExpanded = expandedReposts.has(postKey);
                const images = post.images_json ? JSON.parse(post.images_json) as string[] : [];
                const accountLabel = post.account_nickname || post.uid;
                return (
                  <article key={postKey} style={{ background: "var(--card)", borderRadius: "var(--r-md)", padding: "20px 24px", boxShadow: "var(--sh-card)", marginBottom: 12, cursor: "pointer", transition: "box-shadow 250ms", animation: "fadeUp 0.4s var(--ease-out) both", animationDelay: `${idx * 0.04}s` }} onClick={() => openDetail(post.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      {post.account_avatar_url ? (
                        <img referrerPolicy="no-referrer" src={proxyImageUrl(post.account_avatar_url || "")} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: post.is_original ? "linear-gradient(135deg, #d4a76a, #c2884a)" : "linear-gradient(135deg, #7b9c8e, #5a7e6e)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.8rem", fontWeight: 600, fontFamily: "var(--font-sans)" }}>{accountLabel[0]}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--ink)", lineHeight: 1.35 }}>{accountLabel}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.35 }}>{formatDate(post.created_at)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {post.is_original ? (
                          <Badge bg="var(--gold-wash)" color="var(--gold-dk)" icon={Pen}>原创</Badge>
                        ) : (
                          <Badge bg="#edf0f4" color="var(--slate)" icon={Repeat}>转发</Badge>
                        )}
                        {post.is_long_text === 1 && <Badge bg="#f5f0e9" color="var(--amber)" icon={FileText}>长文</Badge>}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.95rem", lineHeight: 1.78, color: "var(--ink-soft)", marginBottom: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{post.content}</div>
                    {!post.is_original && post.repost_json && (
                      <div style={{ background: "var(--hairl)", borderRadius: "var(--r-sm)", padding: "14px 18px", marginBottom: 12, borderLeft: "3px solid var(--border)", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); toggleRepost(postKey); }}>
                        <div style={{ fontSize: "0.84rem", color: "var(--muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Repeat size={14} />转发了 <strong style={{ color: "var(--ink-soft)", fontWeight: 600 }}>@{(JSON.parse(post.repost_json).user as any)?.screen_name || "用户"}</strong></div>
                        <div style={{ fontSize: "0.88rem", color: isExpanded ? "var(--ink-soft)" : "var(--muted)", lineHeight: 1.65, display: isExpanded ? "block" : "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{(JSON.parse(post.repost_json) as any).text_raw || (JSON.parse(post.repost_json) as any).text || ""}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--gold)", marginTop: 6, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}><ChevronDown size={12} style={{ transform: isExpanded ? "rotate(180deg)" : undefined, transition: "transform 250ms" }} />{isExpanded ? "收起" : "展开"}</div>
                      </div>
                    )}
                    {images.length > 0 && (
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 12, scrollbarWidth: "none" }}>
                        {images.map((url, i) => (<img referrerPolicy="no-referrer" key={i} src={proxyImageUrl(url)} alt={`图片 ${i + 1}`} loading="lazy" style={{ flexShrink: 0, width: 130, height: 130, borderRadius: "var(--r-sm)", objectFit: "cover", background: "var(--hairl)" }} />))}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: "0.8rem", color: "var(--muted)", paddingTop: 10, borderTop: "1px solid var(--hairl)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, marginRight: "auto" }}><Smartphone size={14} />来自 {post.source || "未知客户端"}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Repeat size={14} /> {post.reposts_count}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MessageCircle size={14} /> {post.comments_count}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Heart size={14} /> {post.likes_count}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: "var(--card)", borderRadius: "var(--r-lg)", maxWidth: 560, width: "100%", maxHeight: "85vh", overflow: "auto", padding: 24, boxShadow: "var(--sh-over)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: "0.84rem", color: "var(--muted)" }}>{formatDate(detail.post.created_at)}</span>
              <button style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }} onClick={() => setDetail(null)}><X size={20} /></button>
            </div>
            <div style={{ fontSize: "0.95rem", lineHeight: 1.78, color: "var(--ink-soft)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{detail.post.content}</div>
            {detail.images.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {detail.images.map((img, i) => (<img referrerPolicy="no-referrer" key={i} src={proxyImageUrl(img.original_url)} alt={`图片 ${i + 1}`} style={{ maxWidth: "100%", borderRadius: "var(--r-sm)" }} />))}
              </div>
            )}
            {detail.comments && detail.comments.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--hairl)" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-soft)", marginBottom: 10 }}>评论 ({detail.comments.length})</div>
                {detail.comments.map((c: any) => (
                  <div key={c.comment_id} style={{ padding: "8px 0", borderBottom: "1px solid var(--hairl)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>{c.commenter_name}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{formatDate(c.created_at)}</span>
                      {c.likes_count > 0 && <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginLeft: "auto" }}><Heart size={11} style={{ verticalAlign: "middle", marginRight: 2 }} />{c.likes_count}</span>}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ bg, color, icon: Icon, children }: { bg: string; color: string; icon: React.ComponentType<any>; children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", padding: "3px 9px", borderRadius: 99, fontWeight: 500, background: bg, color }}><Icon size={11} />{children}</span>;
}

function formatDate(dateStr: string): string {
  try { const d = new Date(dateStr); if (isNaN(d.getTime())) return dateStr; return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
  catch { return dateStr; }
}