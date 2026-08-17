"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface DatePickerProps {
  value: string;        // "YYYY-MM-DD"
  onChange: (v: string) => void;
  placeholder?: string;
}

const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const WEEKDAYS = ["一","二","三","四","五","六","日"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfWeek(year: number, month: number): number {
  // 0 = Monday, 6 = Sunday
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDate(val: string): { y: number; m: number; d: number } | null {
  const parts = val.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { y, m: m - 1, d };
}

export default function DatePicker({ value, onChange, placeholder }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const parsed = value ? parseDate(value) : null;

  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? today.getMonth());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync view when value changes externally
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.y);
      setViewMonth(parsed.m);
    }
  }, [value]);

  function selectDay(d: number) {
    const formatted = formatDate(viewYear, viewMonth, d);
    onChange(formatted);
    setOpen(false);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDow = firstDayOfWeek(viewYear, viewMonth);
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const days: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= totalDays; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);

  const inputDisplay = value || placeholder || "选择日期";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        style={{
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "var(--font-body)", fontSize: "0.875rem",
          padding: "8px 10px", minWidth: 130,
          border: open ? "1px solid var(--gold)" : "1px solid var(--border)",
          borderRadius: "var(--r-xs)", background: "var(--canvas)",
          color: value ? "var(--ink)" : "var(--muted)", cursor: "pointer",
          outline: "none", transition: "border-color 150ms, box-shadow 150ms",
          boxShadow: open ? "0 0 0 3px var(--gold-glow)" : "none",
          whiteSpace: "nowrap",
        }}
        onClick={() => setOpen(!open)}
      >
        <Calendar size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{inputDisplay}</span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            style={{
              marginLeft: "auto", background: "none", border: "none",
              color: "var(--muted)", cursor: "pointer", padding: 0,
              display: "flex", fontSize: "1rem", lineHeight: 1,
            }}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange(""); } }}
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 40,
            background: "var(--card)", borderRadius: "var(--r-md)",
            boxShadow: "var(--sh-over)", border: "1px solid var(--border)",
            padding: 14, width: 256,
          }}
        >
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <NavBtn onClick={prevMonth}><ChevronLeft size={16} /></NavBtn>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                style={{ fontFamily: "var(--font-body)", fontSize: "0.84rem", fontWeight: 600, color: "var(--ink)", border: "none", background: "transparent", cursor: "pointer", outline: "none", appearance: "none" as const, WebkitAppearance: "none" as const, paddingRight: 4 }}
              >
                {Array.from({ length: 20 }, (_, i) => today.getFullYear() - 15 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                style={{ fontFamily: "var(--font-body)", fontSize: "0.84rem", fontWeight: 600, color: "var(--ink)", border: "none", background: "transparent", cursor: "pointer", outline: "none", appearance: "none" as const, WebkitAppearance: "none" as const }}
              >
                {MONTHS.map((label, i) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            </div>
            <NavBtn onClick={nextMonth}><ChevronRight size={16} /></NavBtn>
          </div>

          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ textAlign: "center", fontSize: "0.7rem", fontWeight: 500, color: "var(--muted)", padding: "4px 0" }}>{w}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {days.map((d, i) => {
              if (d === null) return <div key={`e-${i}`} />;
              const dateStr = formatDate(viewYear, viewMonth, d);
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              return (
                <button
                  key={dateStr}
                  style={{
                    width: "100%", aspectRatio: "1",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "none", borderRadius: "var(--r-xs)",
                    background: isSelected ? "var(--gold)" : "transparent",
                    color: isSelected ? "#fff" : isToday ? "var(--gold-dk)" : "var(--ink-soft)",
                    fontFamily: "var(--font-body)", fontSize: "0.8rem",
                    fontWeight: isSelected || isToday ? 600 : 400,
                    cursor: "pointer",
                    transition: "background 150ms, color 150ms",
                  }}
                  onClick={() => selectDay(d)}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.target as HTMLElement).style.background = "var(--hairl)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.target as HTMLElement).style.background = "transparent";
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Clear + Today shortcuts */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--hairl)" }}>
            <button
              style={{
                flex: 1, padding: "6px 0",
                fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500,
                border: "1px solid var(--border)", borderRadius: "var(--r-xs)",
                background: "transparent", color: "var(--muted)", cursor: "pointer",
              }}
              onClick={() => { onChange(""); }}
            >
              清除
            </button>
            <button
              style={{
                flex: 1, padding: "6px 0",
                fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500,
                border: "none", borderRadius: "var(--r-xs)",
                background: "var(--gold-wash)", color: "var(--gold-dk)", cursor: "pointer",
              }}
              onClick={() => {
                onChange(todayStr);
                setOpen(false);
              }}
            >
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 28, height: 28, borderRadius: "var(--r-xs)",
        border: "none", background: "transparent",
        color: "var(--ink-soft)", cursor: "pointer",
        transition: "background 150ms",
      }}
      onClick={onClick}
      onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "var(--hairl)"; }}
      onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}