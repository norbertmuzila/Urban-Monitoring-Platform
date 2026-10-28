"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, LoaderCircle, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ComboItem {
  value: string;
  label: string;
  hint?: string;
  meta?: string;
  icon?: React.ReactNode;
}

const MAX_RENDERED = 150;

/**
 * Accessible, filterable dropdown (WAI-ARIA combobox). Filters locally; `extra` can append
 * asynchronously found items (e.g. geocoder results) below the local matches.
 */
export function Combobox({
  label,
  placeholder,
  items,
  value,
  onChange,
  disabled,
  loading,
  emptyText = "No matches",
  onQueryChange,
  extra,
  extraHeading,
  className,
}: {
  label: string;
  placeholder: string;
  items: ComboItem[];
  value: string | null;
  onChange: (value: string, item: ComboItem) => void;
  disabled?: boolean;
  loading?: boolean;
  emptyText?: string;
  onQueryChange?: (q: string) => void;
  extra?: ComboItem[];
  extraHeading?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const selected = items.find((i) => i.value === value) ?? extra?.find((i) => i.value === value) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, MAX_RENDERED);
    const starts: ComboItem[] = [];
    const contains: ComboItem[] = [];
    for (const i of items) {
      const l = i.label.toLowerCase();
      if (l.startsWith(q)) starts.push(i);
      else if (l.includes(q) || i.hint?.toLowerCase().includes(q)) contains.push(i);
    }
    return [...starts, ...contains].slice(0, MAX_RENDERED);
  }, [items, query]);

  const extraItems = (extra ?? []).filter((e) => !matches.some((m) => m.value === e.value));
  const all = [...matches, ...extraItems];

  useEffect(() => {
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  const choose = (i: number) => {
    const item = all[i];
    if (!item) return;
    onChange(item.value, item);
    setOpen(false);
    setQuery("");
    onQueryChange?.("");
  };

  const renderItem = (item: ComboItem, index: number) => (
    <li
      key={`${item.value}-${index}`}
      role="option"
      data-index={index}
      aria-selected={index === hi}
      onMouseEnter={() => setHi(index)}
      onMouseDown={(e) => {
        e.preventDefault();
        choose(index);
      }}
      className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm", index === hi && "bg-surface-3")}
    >
      {item.icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.label}</span>
        {item.hint && <span className="block truncate text-[11px] text-subtle">{item.hint}</span>}
      </span>
      {item.meta && <span className="shrink-0 font-mono text-[11px] text-subtle">{item.meta}</span>}
      {item.value === value && <Check className="size-3.5 shrink-0 text-accent" aria-hidden />}
    </li>
  );

  return (
    <div ref={wrap} className={cn("relative min-w-0", className)}>
      <span id={`${id}-label`} className="mb-1.5 block text-[11px] font-semibold tracking-wider text-subtle uppercase">
        {label}
      </span>
      {!open ? (
        <button
          type="button"
          disabled={disabled}
          aria-labelledby={`${id}-label`}
          onClick={() => {
            setOpen(true);
            setHi(0);
            requestAnimationFrame(() => input.current?.focus());
          }}
          className="flex h-11 w-full items-center gap-2 rounded-xl border border-line bg-surface-2/80 px-3 text-left text-sm transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selected?.icon}
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-subtle")}>{selected?.label ?? placeholder}</span>
          {loading ? <LoaderCircle className="size-4 animate-spin text-subtle" aria-hidden /> : <ChevronsUpDown className="size-4 text-subtle" aria-hidden />}
        </button>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            ref={input}
            role="combobox"
            aria-expanded
            aria-controls={`${id}-list`}
            aria-labelledby={`${id}-label`}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            placeholder={`Search ${label.toLowerCase()}…`}
            onChange={(e) => {
              setQuery(e.target.value);
              setHi(0);
              onQueryChange?.(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((h) => Math.min(h + 1, all.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(hi);
              } else if (e.key === "Escape") setOpen(false);
            }}
            className="h-11 w-full rounded-xl border border-accent/50 bg-surface-2 pr-9 pl-9 text-sm text-fg placeholder:text-subtle focus:outline-none"
          />
          {loading && <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-subtle" aria-hidden />}
        </div>
      )}

      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          className="absolute z-[1200] mt-1.5 max-h-80 w-full min-w-64 overflow-y-auto rounded-xl border border-line-strong bg-surface p-1 shadow-2xl shadow-black/60"
        >
          {matches.map((item, i) => renderItem(item, i))}
          {extraItems.length > 0 && (
            <>
              <li role="presentation" className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                {extraHeading ?? "More results"}
              </li>
              {extraItems.map((item, i) => renderItem(item, matches.length + i))}
            </>
          )}
          {all.length === 0 && <li className="px-3 py-2 text-xs text-subtle">{loading ? "Searching…" : emptyText}</li>}
          {matches.length === MAX_RENDERED && <li className="px-3 py-1.5 text-[10px] text-subtle">Showing first {MAX_RENDERED} — type to narrow down.</li>}
        </ul>
      )}
    </div>
  );
}
