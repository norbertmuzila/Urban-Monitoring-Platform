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

/**
 * Browser page translation (Chrome, Edge, Safari) replaces text nodes behind React's back;
 * React then throws when it removes or inserts next to a node that is no longer there,
 * and the whole view fails. These guards make those DOM calls tolerant instead.
 */
const DOM_GUARD = `(function(){if(typeof Node!=="function"||!Node.prototype)return;var r=Node.prototype.removeChild;Node.prototype.removeChild=function(c){if(c&&c.parentNode!==this)return c;return r.apply(this,arguments)};var i=Node.prototype.insertBefore;Node.prototype.insertBefore=function(n,ref){if(ref&&ref.parentNode!==this)return i.call(this,n,null);return i.apply(this,arguments)}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DOM_GUARD }} />
      </head>
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
