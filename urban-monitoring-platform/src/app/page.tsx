import type { Metadata } from "next";
import { HomeView } from "@/components/home/home-view";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { absolute: "Urban Monitoring Platform · Live environmental intelligence for every city" },
};

export default function HomePage() {
  return (
    <Providers>
      <HomeView />
    </Providers>
  );
}
