import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";

export const metadata: Metadata = { title: "Page not found" };

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "City monitor" },
  { href: "/explorer", label: "Satellite explorer" },
  { href: "/forests", label: "Forests & fires" },
  { href: "/zimbabwe", label: "Zimbabwe watch" },
  { href: "/sources", label: "Data sources" },
];

export default function NotFound() {
  return (
    <main className="app-backdrop grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-surface/80 p-8 text-center backdrop-blur">
        <Link href="/" className="mx-auto grid size-14 place-items-center overflow-hidden rounded-2xl bg-white p-1.5">
          <Image src="/brand/euromoonmars.png" alt="Urban Monitoring Platform" width={40} height={50} className="h-11 w-auto" />
        </Link>
        <Compass className="mx-auto mt-6 size-8 text-accent" strokeWidth={1.5} aria-hidden />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted">This address isn&apos;t part of the Urban Monitoring Platform. Pick a workspace below.</p>
        <nav className="mt-6 grid grid-cols-2 gap-2" aria-label="Platform pages">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group inline-flex items-center justify-between rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm hover:border-accent/40 hover:bg-accent/10"
            >
              {l.label}
              <ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
