import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, children, ...rest }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("min-w-0 rounded-[var(--radius-card)] border border-line bg-surface/80 backdrop-blur-sm", className)}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-4 pb-3", className)}>
      <div className="flex min-w-0 flex-1 basis-48 items-start gap-2.5">
        {Icon && (
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-muted">
            <Icon className="size-3.5" strokeWidth={2} aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold tracking-tight text-fg">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-subtle">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}

export function CardBody({ className, ...rest }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5", className)} {...rest} />;
}
