import type { Metadata } from "next";
import { ZimbabweView } from "@/components/zimbabwe/zimbabwe-view";

export const metadata: Metadata = { title: "Zimbabwe land & mining watch" };

export default function ZimbabwePage() {
  return <ZimbabweView />;
}
