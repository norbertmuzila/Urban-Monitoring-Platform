import type { Metadata } from "next";
import { ChipingeView } from "@/components/chipinge/chipinge-view";

export const metadata: Metadata = {
  title: "Chipinge Deforestation Observatory",
  description: "Live satellite monitoring of forest and woodland change across Chipinge District, Zimbabwe.",
};

export default function ChipingePage() {
  return <ChipingeView />;
}
