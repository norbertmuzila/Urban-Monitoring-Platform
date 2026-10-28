import { Providers } from "@/components/providers";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="app-backdrop flex h-dvh overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 pt-5 pb-28 sm:px-6 lg:pb-10">{children}</div>
          </main>
        </div>
        <MobileNav />
      </div>
    </Providers>
  );
}
