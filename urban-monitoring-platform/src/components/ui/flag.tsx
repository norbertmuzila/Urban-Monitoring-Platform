import { cn } from "@/lib/cn";

/** Country flag from flagcdn (renders on every OS, unlike emoji flags on Windows). */
export function Flag({ iso2, className, title }: { iso2: string; className?: string; title?: string }) {
  const code = /^[a-z]{2}$/.test(iso2) ? iso2 : "un";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={title ?? `${code.toUpperCase()} flag`}
      className={cn("inline-block shrink-0 rounded-[3px] object-cover ring-1 ring-white/10", className ?? "h-3.5 w-5")}
      loading="lazy"
    />
  );
}
