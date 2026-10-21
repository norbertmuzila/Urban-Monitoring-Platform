import { Database, House, LayoutDashboard, Pickaxe, SatelliteDish, Telescope, Trees, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  /** Exact match only (for "/"). */
  exact?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", short: "Home", description: "About the platform", icon: House, exact: true },
  { href: "/dashboard", label: "City monitor", short: "Cities", description: "Live conditions & predictions", icon: LayoutDashboard },
  { href: "/explorer", label: "Satellite explorer", short: "Satellite", description: "Live Sentinel, Landsat & VIIRS layers", icon: SatelliteDish },
  { href: "/forests", label: "Forests & fires", short: "Forests", description: "Forest cover & active fires", icon: Trees },
  { href: "/chipinge", label: "Chipinge observatory", short: "Chipinge", description: "Featured deforestation project", icon: Telescope },
  { href: "/zimbabwe", label: "Zimbabwe watch", short: "Zimbabwe", description: "Mining & land-degradation screening", icon: Pickaxe },
  { href: "/sources", label: "Data sources", short: "Sources", description: "Providers, status & licences", icon: Database },
];

export const isActive = (item: NavItem, pathname: string) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));
