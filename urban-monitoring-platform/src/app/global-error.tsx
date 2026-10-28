"use client";

import "./globals.css";
import { Recovery } from "@/components/ui/recovery";

export default function GlobalError(props: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="app-backdrop h-full bg-canvas px-4 font-sans text-fg">
        <title>Urban Monitoring Platform</title>
        <Recovery {...props} />
      </body>
    </html>
  );
}
