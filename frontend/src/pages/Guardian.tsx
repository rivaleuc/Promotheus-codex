import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, TrendingUp, Flame, AlertTriangle } from "lucide-react";
import { APTOS_NODE_URL } from "../lib/api";

// In a full app this would fetch from contract via aptos SDK
// For now: show wallet input + instructions

export default function Guardian() {
  const [wallet, setWallet] = useState("");
  const [checked, setChecked] = useState(false);

  return (
    <div style={{ minHeight: "100vh", paddingTop: "56px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>

        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: "2.2rem", marginBottom: 6 }}>GUARDIAN</h1>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            Stake APT on documents. Earn read fees. Protect truth.
          </p>
        </div>

        {/* How guardians work */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: 40 }}>
          {[
            { icon: <Shield size={18} style={{ color: "var(--amber)" }} />, title: "STAKE", body: "Stake min 0.05 APT on any active document. You vouch for its authenticity." },
            { icon: <TrendingUp size={18} style={{ color: "var(--amber)" }} />, title: "EARN", body: "Every time someone reads a document you guard, you earn a share of the 0.001 APT read fee." },
            { icon: <Flame size={18} style={{ color: "var(--amber)" }} />, title: "PROTECT", body: "More guardians = higher trust signal. Documents with many guardians are harder to censor." },
            { icon: <AlertTriangle size={18} style={{ color: "#f87171" }} />, title: "RISK", body: "If a challenge succeeds and the document is removed, guardians lose their stake." },
          ].map(({ icon, title, body }) => (
            <div key={title} className="p-card" style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                {icon}
                <span style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 600, letterSpacing: "0.08em" }}>{title}</span>
              </div>
              <p style={{ fontSize: "0.83rem", color: "hsl(var(--muted-foreground))", margin: 0, lineHeight: 1.6 }}>{body}</p>
            </div>
          ))}
        </div>

        {/* Wallet checker */}
        <div className="p-card" style={{ padding: 28 }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: 16 }}>CHECK YOUR POSITIONS</h3>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              placeholder="Your Aptos wallet address (0x…)"
              style={{ flex: 1, padding: "10px 14px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", borderRadius: 3, color: "hsl(var(--foreground))", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}
            />
            <button className="btn-amber" style={{ padding: "10px 20px", fontSize: "0.8rem" }} onClick={() => setChecked(true)} disabled={!wallet}>
              CHECK
            </button>
          </div>

          {checked && wallet && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ background: "hsl(var(--muted))", borderRadius: 3, padding: 16, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, lineHeight: 2, color: "hsl(var(--muted-foreground))" }}>
                <div style={{ color: "hsl(var(--foreground))", marginBottom: 8 }}>$ aptos move view \\</div>
                <div style={{ paddingLeft: 16, color: "#4ade80" }}>
                  --function-id {"<CONTRACT>"}::guardian::get_total_staked \<br />
                  --args address:{wallet} \<br />
                  --url {APTOS_NODE_URL}
                </div>
              </div>
              <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 12 }}>
                Run the above command to check your total staked + rewards earned on-chain.
              </p>
            </motion.div>
          )}
        </div>

        {/* Become guardian CTA */}
        <div style={{ marginTop: 32, padding: 28, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 4, textAlign: "center" }}>
          <Shield size={28} style={{ color: "var(--amber)", margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "1.1rem", marginBottom: 8 }}>READY TO GUARD?</h3>
          <p style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))", marginBottom: 20 }}>
            Browse the feed, find a document you believe in, and stake your APT.
          </p>
          <a href="/feed" style={{ textDecoration: "none" }}>
            <button className="btn-amber" style={{ padding: "12px 28px", fontSize: "0.85rem" }}>
              Browse Documents →
            </button>
          </a>
        </div>
      </div>
    </div>
  );
}
