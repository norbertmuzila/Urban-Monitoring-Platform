"use client";

import { Recovery } from "@/components/ui/recovery";

export default function RootError(props: { error: unknown; retry: () => void }) {
  return (
    <div className="app-backdrop min-h-dvh px-4">
      <Recovery {...props} />
    </div>
  );
}
