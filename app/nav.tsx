"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, Shuffle, RefreshCw, Users, CalendarDays } from "lucide-react";

const tabs = [
  { href: "/posts", label: "浏览", icon: List },
  { href: "/shuffle", label: "随机刷", icon: Shuffle },
  { href: "/on-this-day", label: "那年今日", icon: CalendarDays },
  { href: "/sync", label: "同步", icon: RefreshCw },
  { href: "/accounts", label: "账号", icon: Users },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        padding: "14px 0",
        background: `color-mix(in srgb, var(--canvas) 92%, transparent)`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: "1.1rem",
            color: "var(--ink)",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          Weibo Backup
        </Link>

        <div
          style={{
            display: "flex",
            gap: 2,
            background: "var(--hairl)",
            borderRadius: "var(--r-sm)",
            padding: 3,
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  borderRadius: "var(--r-xs)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: active ? "var(--ink)" : "var(--muted)",
                  background: active ? "var(--card)" : "transparent",
                  boxShadow: active ? "var(--sh-card)" : "none",
                  textDecoration: "none",
                  transition: "color 150ms, background 150ms, box-shadow 150ms",
                  whiteSpace: "nowrap",
                }}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}