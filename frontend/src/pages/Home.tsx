import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { fetchStats, type Stats } from "../lib/api";
import { Shield, Flame, AlertTriangle, Eye } from "lucide-react";

const TAGLINES = [
  "Truth backed by stake.",
  "Censorship has a price.",
  "Burn it into the chain.",
  "No delete button.",
];

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tagline, setTagline] = useState(0);

  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
    const t = setInterval(() => setTagline(i => (i + 1) % TAGLINES.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ minHeight: "100vh", paddingTop: "56px" }}>

      {/* Hero */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "100px 24px 80px", textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>

          {/* Protocol badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--amber)", border: "1px solid rgba(245,158,11,0.3)", padding: "4px 12px", borderRadius: 2, marginBottom: 40, letterSpacing: "0.1em" }}>
            <Flame size={11} />
            DECENTRALIZED TRUTH PROTOCOL
          </div>

          <h1 style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: "clamp(3.5rem, 10vw, 7rem)", lineHeight: 0.9, letterSpacing: "0.04em", marginBottom: 32, textTransform: "uppercase" }}>
            PROMETHEUS
          </h1>

          {/* Animated tagline */}
          <div style={{ height: 32, overflow: "hidden", marginBottom: 48 }}>
            <motion.p
              key={tagline}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", color: "hsl(var(--muted-foreground))", letterSpacing: "0.05em" }}
            >
              {TAGLINES[tagline]}
            </motion.p>
          </div>

          <p style={{ fontSize: "1.05rem", color: "hsl(var(--muted-foreground))", maxWidth: 540, margin: "0 auto 56px", lineHeight: 1.7 }}>
            Upload documents to <span style={{ color: "var(--amber)" }}>Shelby Protocol</span>, stake APT to vouch for their authenticity. Guardians earn read fees. Challengers risk their stake.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/upload" style={{ textDecoration: "none" }}>
              <button className="btn-amber" style={{ padding: "14px 36px", fontSize: "0.9rem", letterSpacing: "0.1em" }}>
                Publish Document
              </button>
            </Link>
            <Link to="/feed" style={{ textDecoration: "none" }}>
              <button className="btn-ghost" style={{ padding: "14px 36px", fontSize: "12px" }}>
                Browse Feed →
              </button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats */}
      {stats && (
        <motion.section
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          style={{ borderTop: "1px solid hsl(var(--border))", borderBottom: "1px solid hsl(var(--border))", padding: "32px 24px" }}
        >
          <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
            {[
              { n: stats.totalDocs,       label: "DOCUMENTS" },
              { n: stats.totalChallenges, label: "CHALLENGES" },
              { n: stats.totalReads,      label: "READS" },
              { n: stats.totalStakedAPT,  label: "STAKED" },
            ].map(({ n, label }, i) => (
              <div key={i} style={{ textAlign: "center", padding: "8px 0", borderRight: i < 3 ? "1px solid hsl(var(--border))" : "none" }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: "2rem", fontWeight: 600, color: "var(--amber)" }}>
                  {n}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "hsl(var(--muted-foreground))", letterSpacing: "0.1em", marginTop: 4 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* How it works */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "80px 24px" }}>
        <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: "1.6rem", letterSpacing: "0.1em", marginBottom: 48, textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
          HOW IT WORKS
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
          {[
            { icon: <Flame size={20} style={{ color: "var(--amber)" }} />, step: "01", title: "PUBLISH", body: "Upload your document to Shelby Protocol. Stake APT to vouch for its authenticity." },
            { icon: <Shield size={20} style={{ color: "var(--amber)" }} />, step: "02", title: "GUARDIAN", body: "Others stake APT on your document. They earn a share of read fees. More stakes = more trust." },
            { icon: <Eye size={20} style={{ color: "var(--amber)" }} />, step: "03", title: "READ FREE", body: "Anyone reads for free. Server sponsors the Shelby micropayment. No wallet needed to read." },
            { icon: <AlertTriangle size={20} style={{ color: "#f87171" }} />, step: "04", title: "CHALLENGE", body: "Anyone can challenge a document. Community votes with stake. Loser gets slashed." },
          ].map(({ icon, step, title, body }) => (
            <div key={step} className="p-card" style={{ padding: 24, transition: "border-color 0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                {icon}
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))", letterSpacing: "0.1em" }}>
                  {step}
                </span>
              </div>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 600, fontSize: "1rem", letterSpacing: "0.08em", marginBottom: 10 }}>
                {title}
              </div>
              <p style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))", lineHeight: 1.6, margin: 0 }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
