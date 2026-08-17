"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Nav from "@/app/nav";
import { loadPosts, getFilterStats, loadPostDetail, exportJSON, exportHTML, exportMarkdownZip, exportPrintHTML } from "./actions";
import type { PostWithAccount } from "./actions";
import type { WeiboImage, WeiboPost } from "@/lib/db";
import { FileText, Pen, Repeat, Search, Smartphone, Heart, MessageCircle, ChevronDown, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { proxyImageUrl } from "@/lib/image-url";
import DatePicker from "@/app/components/date-picker";

const PAGE_SIZE = 50;

function pageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

interface PostsClientProps {
  initialPosts: PostWithAccount[];
  initialTotal: number;
  initialStats: any;
  initialAccountOptions: { uid: string; label: string }[];
}

export default function PostsClient({ initialPosts, initialTotal, initialStats, initialAccountOptions }: PostsClientProps) {
  const [posts, setPosts] = useState<PostWithAccount[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotal / PAGE_SIZE));
  const [loading, setLoading] = useState(false);

  const [filterUid, setFilterUid] = useState("");
  const [filterType, setFilterType] = useState<"all" | "original" | "repost">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stats, setStats] = useState<any>(initialStats);
  const [accountOptions, setAccountOptions] = useState<{ uid: string; label: string }[]>(initialAccountOptions);
  const [expandedReposts, setExpandedReposts] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<{ post: PostWithAccount; images: WeiboImage[]; repost: WeiboPost | null; comments?: any[] } | null>(null);

  // Account options come from server-side props — no need to re-fetch

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchKeyword(searchInput);
      setPage(1);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchInput]);

  // 打开详情弹窗时锁定背景滚动，让滚动聚焦在弹窗内容上
  useEffect(() => {
    if (!detail) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [detail]);

  const fetchPosts = useCallback(async (pageNum: number) => {
    setLoading(true);
    const result = await loadPosts({
      uid: filterUid || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
      keyword: searchKeyword || undefined,
      isOriginal: filterType === "original" ? 1 : filterType === "repost" ? 0 : undefined,
      page: pageNum,
      pageSize: PAGE_SIZE,
    });
    setPosts(result.posts);
    setPage(result.page);
    setTotalPages(result.totalPages);
    setLoading(false);
  }, [filterUid, filterDateFrom, filterDateTo, searchKeyword, filterType]);

  useEffect(() => {
    getFilterStats({
      uid: filterUid || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
      keyword: searchKeyword || undefined,
      isOriginal: filterType === "original" ? 1 : filterType === "repost" ? 0 : undefined,
    }).then(setStats);
  }, [filterUid, filterDateFrom, filterDateTo, searchKeyword, filterType]);

  // Skip initial fetch — data comes from server props
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchPosts(page);
  }, [fetchPosts, page]);

  function goToPage(p: number) {
    if (p >= 1 && p <= totalPages) {
      setPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function openDetail(id: number) {
    const d = await loadPostDetail(id);
    setDetail(d);
  }

  function toggleRepost(postKey: string) {
    setExpandedReposts((prev) => {
      const next = new Set(prev);
      if (next.has(postKey)) next.delete(postKey); else next.add(postKey);
      return next;
    });
  }

  // Filters change → reset to page 1
  useEffect(() => { setPage(1); }, [filterUid, filterDateFrom, filterDateTo, searchKeyword, filterType]);

  // Year groups
  const yearGroups: { year: string; posts: PostWithAccount[] }[] = [];
  for (const post of posts) {
    const year = post.created_at.slice(0, 4);
    const last = yearGroups[yearGroups.length - 1];
    if (last && last.year === year) last.posts.push(post);
    else yearGroups.push({ year, posts: [post] });
  }

  const styles = {
    card: {
      background: "var(--card)", borderRadius: "var(--r-md)", padding: "20px 24px",
      boxShadow: "var(--sh-card)", marginBottom: 12,
      transition: "box-shadow 250ms var(--ease-out)", cursor: "pointer",
    } as React.CSSProperties,
  };

  return (
    <div className="page-container">
      <Nav />

      {/* Filter Bar */}
      <div style={{ ...styles.card, marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <CustomSelect
            value={filterUid}
            onChange={(v) => setFilterUid(v)}
            options={[{ value: "", label: "全部账号" }, ...accountOptions.map((a) => ({ value: a.uid, label: a.label }))]}
          />
          <SegmentedControl
            value={filterType}
            onChange={setFilterType}
            options={[
              { value: "all", label: "全部", icon: FileText },
              { value: "original", label: "原创", icon: Pen },
              { value: "repost", label: "转发", icon: Repeat },
            ]}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <DatePicker value={filterDateFrom} onChange={setFilterDateFrom} placeholder="开始日期" />
          <span style={{ fontSize: "0.84rem", color: "var(--muted)" }}>至</span>
          <DatePicker value={filterDateTo} onChange={setFilterDateTo} placeholder="结束日期" />
          <div style={{ position: "relative", flex: 1, minWidth: 160, maxWidth: 260, marginLeft: "auto" }}>
            <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            <CustomInput value={searchInput} onChange={setSearchInput} placeholder="搜索微博内容..." pl={32} />
          </div>
        </div>
      </div>

      {/* Pagination — above stats */}
      {totalPages > 1 && <PageNav page={page} totalPages={totalPages} goToPage={goToPage} />}

      {/* Stats + Export */}
      {stats && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, fontSize: "0.84rem", color: "var(--muted)", padding: "0 4px", marginBottom: 22 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>共 <strong style={{ color: "var(--ink-soft)" }}>{stats.total}</strong> 条微博</span>
            <span>来自 <strong style={{ color: "var(--ink-soft)" }}>{stats.uidCount || 1}</strong> 个账号</span>
            {stats.dateRange && (
              <span><strong style={{ color: "var(--ink-soft)" }}>{stats.dateRange.earliest?.slice(0, 7)}</strong> — <strong style={{ color: "var(--ink-soft)" }}>{stats.dateRange.latest?.slice(0, 7)}</strong></span>
            )}
          </div>
          <ExportButton filters={{ uid: filterUid, dateFrom: filterDateFrom, dateTo: filterDateTo, keyword: searchKeyword, isOriginal: filterType === "original" ? 1 : filterType === "repost" ? 0 : undefined }} />
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
          <FileText size={48} style={{ margin: "0 auto 16px", opacity: 0.5 }} />
          <h2 style={{ fontFamily: "var(--font-sans)", fontSize: "1.15rem", fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>
            {searchKeyword || filterDateFrom ? "没有匹配的帖子" : "还没有备份的微博"}
          </h2>
          <p style={{ fontSize: "0.9rem" }}>{searchKeyword || filterDateFrom ? "尝试调整筛选条件" : "前往账号管理添加微博账号并开始同步"}</p>
        </div>
      )}

      {/* Timeline */}
      {!loading && posts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {yearGroups.map((group) => (
            <div key={group.year}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0 4px" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{group.year}</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>
              {group.posts.map((post, idx) => {
                const postKey = `${post.uid}-${post.weibo_id}`;
                const isExpanded = expandedReposts.has(postKey);
                const images = post.images_json ? JSON.parse(post.images_json) as string[] : [];
                const accountLabel = post.account_nickname || post.uid;
                return (
                  <article key={postKey} style={{ ...styles.card, animation: "fadeUp 0.4s var(--ease-out) both", animationDelay: `${idx * 0.04}s` }} onClick={() => openDetail(post.id)}>
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
                        <Badge bg="var(--gold-wash)" color="var(--gold-dk)" icon={Pen}>{post.is_original ? "原创" : ""}</Badge>
                        {!post.is_original && <Badge bg="#edf0f4" color="var(--slate)" icon={Repeat}>转发</Badge>}
                        {post.is_long_text === 1 && <Badge bg="#f5f0e9" color="var(--amber)" icon={FileText}>长文</Badge>}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.95rem", lineHeight: 1.78, color: "var(--ink-soft)", marginBottom: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{post.content}</div>
                    {!post.is_original && post.repost_json && (
                      <div style={{ background: "var(--hairl)", borderRadius: "var(--r-sm)", padding: "14px 18px", marginBottom: 12, borderLeft: "3px solid var(--border)", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); toggleRepost(postKey); }}>
                        <div style={{ fontSize: "0.84rem", color: "var(--muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Repeat size={14} />转发了 <strong style={{ color: "var(--ink-soft)", fontWeight: 600 }}>@{(JSON.parse(post.repost_json).user as any)?.screen_name || "用户"}</strong> 的微博</div>
                        <div style={{ fontSize: "0.88rem", color: isExpanded ? "var(--ink-soft)" : "var(--muted)", lineHeight: 1.65, display: isExpanded ? "block" : "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{(JSON.parse(post.repost_json) as any).text_raw || (JSON.parse(post.repost_json) as any).text || ""}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--gold)", marginTop: 6, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}><ChevronDown size={12} style={{ transform: isExpanded ? "rotate(180deg)" : undefined, transition: "transform 250ms" }} />{isExpanded ? "收起原文" : "展开原文"}</div>
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

      {/* Bottom pagination */}
      {totalPages > 1 && posts.length > 0 && (
        <div style={{ paddingTop: 4 }}><PageNav page={page} totalPages={totalPages} goToPage={goToPage} /></div>
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

            {/* Comments */}
            {detail.comments && detail.comments.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--hairl)" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-soft)", marginBottom: 10 }}>
                  评论 ({detail.comments.length})
                </div>
                {detail.comments.map((c: any) => (
                  <div key={c.comment_id} style={{ padding: "8px 0", borderBottom: "1px solid var(--hairl)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>{c.commenter_name}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{formatDate(c.created_at)}</span>
                      {c.likes_count > 0 && (
                        <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginLeft: "auto" }}>
                          <Heart size={11} style={{ verticalAlign: "middle", marginRight: 2 }} />
                          {c.likes_count}
                        </span>
                      )}
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

// ===================== Sub-components =====================

function SegmentedControl({ value, onChange, options }: { value: string; onChange: (v: any) => void; options: { value: string; label: string; icon: React.ComponentType<any> }[] }) {
  return (
    <div style={{ display: "flex", gap: 1, background: "var(--hairl)", borderRadius: "var(--r-xs)", padding: 2 }}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button key={opt.value} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: "calc(var(--r-xs) - 1px)", border: "none", background: active ? "var(--card)" : "transparent", color: active ? "var(--ink)" : "var(--muted)", fontSize: "0.84rem", fontFamily: "var(--font-body)", cursor: "pointer", boxShadow: active ? "var(--sh-card)" : "none", transition: "color 150ms, background 150ms, box-shadow 150ms", whiteSpace: "nowrap" }} onClick={() => onChange(opt.value)}>
            <Icon size={14} />{opt.label}
          </button>
        );
      })}
    </div>
  );
}

function CustomSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={ref} style={{ position: "relative", minWidth: 130 }}>
      <button style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", fontFamily: "var(--font-body)", fontSize: "0.875rem", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-xs)", background: "var(--canvas)", color: "var(--ink)", cursor: "pointer", outline: "none" }} onClick={() => setOpen(!open)}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label || value}</span>
        <ChevronDown size={14} style={{ color: "var(--muted)", flexShrink: 0, transition: "transform 200ms", transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "var(--card)", borderRadius: "var(--r-sm)", boxShadow: "var(--sh-over)", border: "1px solid var(--border)", minWidth: "100%", zIndex: 30, maxHeight: 240, overflow: "auto" }}>
          {options.map((o) => (
            <button key={o.value} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: o.value === value ? "var(--hairl)" : "transparent", fontFamily: "var(--font-body)", fontSize: "0.84rem", color: o.value === value ? "var(--ink)" : "var(--ink-soft)", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => { onChange(o.value); setOpen(false); }} onMouseEnter={(e) => { if (o.value !== value) (e.target as HTMLElement).style.background = "var(--hairl)"; }} onMouseLeave={(e) => { if (o.value !== value) (e.target as HTMLElement).style.background = "transparent"; }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function CustomInput({ value, onChange, placeholder, pl }: { value: string; onChange: (v: string) => void; placeholder: string; pl?: number }) {
  return <input type="search" style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", padding: `8px 12px 8px ${pl || 12}px`, width: "100%", border: "1px solid var(--border)", borderRadius: "var(--r-xs)", background: "var(--canvas)", color: "var(--ink)", outline: "none" }} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function Badge({ bg, color, icon: Icon, children }: { bg: string; color: string; icon: React.ComponentType<any>; children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", padding: "3px 9px", borderRadius: 99, fontWeight: 500, background: bg, color }}><Icon size={11} />{children}</span>;
}

function PageNav({ page, totalPages, goToPage }: { page: number; totalPages: number; goToPage: (p: number) => void }) {
  const [jumpInput, setJumpInput] = useState("");
  function handleJump() {
    const p = parseInt(jumpInput, 10);
    if (p >= 1 && p <= totalPages) { goToPage(p); setJumpInput(""); }
  }
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, padding: "12px 0", flexWrap: "wrap" }}>
      <PaginationBtn onClick={() => goToPage(page - 1)} disabled={page <= 1}><ChevronLeft size={16} /></PaginationBtn>
      {pageNumbers(page, totalPages).map((p, i) =>
        p === "..." ? <span key={`dot-${i}`} style={{ color: "var(--muted)", padding: "0 2px", fontSize: "0.8rem" }}>...</span> :
        <PaginationBtn key={p} active={p === page} onClick={() => goToPage(p as number)}>{p}</PaginationBtn>
      )}
      <PaginationBtn onClick={() => goToPage(page + 1)} disabled={page >= totalPages}><ChevronRight size={16} /></PaginationBtn>
      {totalPages > 5 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") handleJump(); }}
            placeholder={`/${totalPages}`}
            style={{
              width: 96, minWidth: 96, flexShrink: 0, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--r-xs)",
              background: "var(--card)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: "0.8rem",
              textAlign: "center", outline: "none",
            }}
          />
          <PaginationBtn onClick={handleJump}>跳转</PaginationBtn>
        </div>
      )}
    </div>
  );
}

function PaginationBtn({ children, active, disabled, onClick }: { children: React.ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 36, height: 36, padding: "0 10px", borderRadius: "var(--r-xs)", border: active ? "1px solid var(--gold)" : "1px solid var(--border)", background: active ? "var(--gold-wash)" : "var(--card)", color: active ? "var(--gold-dk)" : disabled ? "var(--faint)" : "var(--ink-soft)", fontFamily: "var(--font-body)", fontSize: "0.875rem", fontWeight: active ? 600 : 400, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1 }} onClick={onClick} disabled={disabled}>{children}</button>;
}

function ExportButton({ filters }: { filters: { uid?: string; dateFrom?: string; dateTo?: string; keyword?: string; isOriginal?: number } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function download(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  async function handleJSON() { download(await exportJSON(filters), "weibo-export.json", "application/json"); setOpen(false); }
  async function handleHTML() { download(await exportHTML(filters), "weibo-export.html", "text/html;charset=utf-8"); setOpen(false); }
  async function handleMarkdown() {
    const base64 = await exportMarkdownZip(filters);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    downloadURL(new Blob([bytes], { type: "application/zip" }), "weibo-markdown.zip");
    setOpen(false);
  }
  async function handlePrint() {
    const html = await exportPrintHTML(filters);
    const w = window.open("", "_blank")!;
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 800);
    setOpen(false);
  }
  function downloadURL(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-body)", fontSize: "0.84rem", fontWeight: 500, padding: "6px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--card)", color: "var(--ink-soft)", cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <Download size={15} />导出
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--card)", borderRadius: "var(--r-sm)", boxShadow: "var(--sh-over)", border: "1px solid var(--border)", minWidth: 170, zIndex: 30, overflow: "hidden" }}>
          {[
            { label: "JSON", action: handleJSON },
            { label: "HTML", action: handleHTML },
            { label: "Markdown ZIP", action: handleMarkdown },
            { label: "PDF / 打印", action: handlePrint },
          ].map((item) => (
            <button key={item.label} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", border: "none", background: "transparent", fontFamily: "var(--font-body)", fontSize: "0.84rem", color: "var(--ink-soft)", cursor: "pointer" }} onClick={item.action} onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "var(--hairl)"; }} onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== Helpers =====================

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return dateStr; }
}

