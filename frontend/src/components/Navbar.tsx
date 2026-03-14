import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { NETWORK_NAME } from "../lib/api";
import WalletButton from "./WalletButton";

const LINKS = [
  { to: "/feed",     label: "Feed"     },
  { to: "/upload",   label: "Publish"  },
  { to: "/guardian", label: "Guardian" },
];

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b"
      style={{ borderColor: "hsl(var(--border))", background: "rgba(10,9,8,0.9)", backdropFilter: "blur(12px)" }}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

        <Link to="/" className="flex items-center gap-2 no-underline">
          <Flame size={18} style={{ color: "var(--amber)" }} />
          <span style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(var(--foreground))" }}>
            PROMETHEUS
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map(({ to, label }) => {
            const active = pathname.startsWith(to);
            return (
              <Link key={to} to={to} style={{ textDecoration: "none" }}>
                <div style={{ position: "relative", padding: "6px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: "0.05em", color: active ? "var(--amber)" : "hsl(var(--muted-foreground))", transition: "color 0.15s" }}>
                  {active && (
                    <motion.div layoutId="nav-pill" style={{ position: "absolute", inset: 0, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 3 }} />
                  )}
                  <span style={{ position: "relative" }}>{label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", padding: "3px 10px", borderRadius: 3, letterSpacing: "0.05em", textTransform: "lowercase" }}>
            ● {NETWORK_NAME}
          </div>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
