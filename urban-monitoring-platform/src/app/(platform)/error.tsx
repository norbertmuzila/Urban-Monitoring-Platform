"use client";

import { Recovery } from "@/components/ui/recovery";

export default function PlatformError(props: { error: unknown; retry: () => void }) {
  return <Recovery {...props} />;
}
