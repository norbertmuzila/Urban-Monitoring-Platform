import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Urban Monitoring Platform · EuroMoonMars",
    template: "%s · Urban Monitoring Platform",
  },
  description:
    "Copernicus Earth observation, urban digital twin and satellite deforestation monitoring — a multi-task AI framework for integrated urban monitoring.",
  icons: { icon: "/brand/euromoonmars.png" },
};

export const viewport: Viewport = {
  themeColor: "#060914",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
