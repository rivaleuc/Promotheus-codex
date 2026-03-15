import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { fetchDoc, downloadUrl, formatBytes, STATUS, EXPLORER_NETWORK, APTOS_NODE_URL, PROMETHEUS_CONTRACT, type Doc } from "../lib/api";
import { Shield, Eye, AlertTriangle, ExternalLink, ChevronLeft, Check, X, Loader } from "lucide-react";

const GUARDIAN_PRESETS = [5_000_000, 20_000_000, 50_000_000, 100_000_000];
const CHALLENGE_STAKE = 20_000_000;
const VOTE_STAKE = 1_000_000;

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);
  const { connected, account, signAndSubmitTransaction } = useWallet();

  const aptos = useMemo(() => new Aptos(new AptosConfig({
    network: Network.CUSTOM,
    fullnode: APTOS_NODE_URL,
  })), []);

  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"guardian" | "challenge">("guardian");

  // Guardian
  const [gStake, setGStake] = useState(GUARDIAN_PRESETS[0]);
  const [gStatus, setGStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [gTx, setGTx] = useState("");
  const [gErr, setGErr] = useState("");

  // Challenge
  const [cReason, setCReason] = useState("");
  const [cStatus, setCStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [cTx, setCTx] = useState("");
  const [cErr, setCErr] = useState("");

  // Vote
  const [vSupports, setVSupports] = useState<boolean | null>(null);
  const [vStatus, setVStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [vTx, setVTx] = useState("");
  const [vErr, setVErr] = useState("");

  const loadDoc = () => {
    fetchDoc(docId).then(d => { setDoc(d); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { loadDoc(); }, [docId]);

  // ── Become Guardian ───────────────────────────────────────
  const becomeGuardian = async () => {
    if (!connected || !account) { setGErr("Connect wallet first."); setGStatus("error"); return; }
    setGStatus("loading"); setGErr("");
    try {
      const tx = await signAndSubmitTransaction({
        data: {
          function: `${PROMETHEUS_CONTRACT}::document::become_guardian`,
          typeArguments: [],
          functionArguments: [PROMETHEUS_CONTRACT, docId.toString(), gStake.toString()],
        },
      });
      await aptos.waitForTransaction({ transactionHash: tx.hash });
      setGTx(tx.hash);
      setGStatus("done");
      loadDoc();
    } catch (e: any) {
      setGErr(e.message || "Transaction failed");
      setGStatus("error");
    }
  };

  // ── Open Challenge ────────────────────────────────────────
  const openChallenge = async () => {
    if (!connected || !account) { setCErr("Connect wallet first."); setCStatus("error"); return; }
    if (!cReason.trim()) { setCErr("Reason is required."); setCStatus("error"); return; }
    setCStatus("loading"); setCErr("");
    try {
      const tx = await signAndSubmitTransaction({
        data: {
          function: `${PROMETHEUS_CONTRACT}::challenge::open_challenge`,
          typeArguments: [],
          functionArguments: [PROMETHEUS_CONTRACT, docId.toString(), CHALLENGE_STAKE.toString(), cReason],
        },
      });
      await aptos.waitForTransaction({ transactionHash: tx.hash });
      setCTx(tx.hash);
      setCStatus("done");
      loadDoc();
    } catch (e: any) {
      setCErr(e.message || "Transaction failed");
      setCStatus("error");
    }
  };

  // ── Vote ──────────────────────────────────────────────────
  const vote = async () => {
    if (!connected || !account) { setVErr("Connect wallet first."); setVStatus("error"); return; }
    if (vSupports === null) { setVErr("Select REAL or FAKE first."); setVStatus("error"); return; }
    setVStatus("loading"); setVErr("");
    try {
      const tx = await signAndSubmitTransaction({
        data: {
          function: `${PROMETHEUS_CONTRACT}::challenge::vote`,
          typeArguments: [],
          functionArguments: [PROMETHEUS_CONTRACT, "1", VOTE_STAKE.toString(), vSupports],
        },
      });
      await aptos.waitForTransaction({ transactionHash: tx.hash });
      setVTx(tx.hash);
      setVStatus("done");
      loadDoc();
    } catch (e: any) {
      setVErr(e.message || "Transaction failed");
      setVStatus("error");
    }
  };

  // ── UI helpers ────────────────────────────────────────────
  const TxSuccess = ({ hash }: { hash: string }) => (
    <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 3, padding: "12px 16px", marginTop: 16 }}>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#4ade80", marginBottom: 4 }}>✓ Transaction confirmed</div>
      <a href={`https://explorer.aptoslabs.com/txn/${hash}?network=${EXPLORER_NETWORK}`} target="_blank" rel="noreferrer"
        style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: 4 }}>
        {hash.slice(0, 16)}… <ExternalLink size={10} />
      </a>
    </div>
  );

  const ErrBox = ({ msg }: { msg: string }) => (
    <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 3, padding: "10px 14px", marginTop: 12, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#f87171" }}>
      {msg}
    </div>
  );

  // ── Render ────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", paddingTop: "56px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>loading...</span>
    </div>
  );

  if (!doc) return (
    <div style={{ minHeight: "100vh", paddingTop: "56px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "'IBM Plex Mono',monospace", color: "hsl(var(--muted-foreground))" }}>Document not found.</p>
      <Link to="/feed"><button className="btn-ghost" style={{ padding: "8px 16px" }}>← Back to Feed</button></Link>
    </div>
  );

  const st = STATUS[doc.status];

  return (
    <div style={{ minHeight: "100vh", paddingTop: "56px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>

        {/* Back */}
        <Link to="/feed" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 28 }}>
          <ChevronLeft size={14} /> FEED
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>#{doc.docId}</span>
                <span className={st.cls} style={{ padding: "3px 10px", borderRadius: 2, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: "0.1em" }}>{st.label}</span>
              </div>
              <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", marginBottom: 8, lineHeight: 1 }}>{doc.title.toUpperCase()}</h1>
              {doc.description && <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.9rem", margin: 0 }}>{doc.description}</p>}
            </div>
            {doc.status !== 2 && (
              <button className="btn-amber" onClick={() => window.open(downloadUrl(docId), "_blank")}
                style={{ padding: "12px 20px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <Eye size={14} /> READ FREE
              </button>
            )}
          </div>

          {/* Metadata grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 2, marginBottom: 32 }}>
            {[
              { label: "FILE", value: doc.filename },
              { label: "SIZE", value: formatBytes(doc.size) },
              { label: "GUARDIANS", value: doc.guardianCount, color: "var(--amber)" },
              { label: "STAKED", value: doc.totalStakedAPT, color: "var(--amber)" },
              { label: "READS", value: doc.readCount },
              { label: "UPLOADED", value: new Date(doc.uploadedAt).toLocaleDateString() },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-card" style={{ padding: "14px 16px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "hsl(var(--muted-foreground))", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: color || "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* SHA256 + TX */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
            {[
              { label: "SHA256", value: doc.sha256 },
              { label: "TX HASH", value: doc.txHash, link: `https://explorer.aptoslabs.com/txn/${doc.txHash}?network=${EXPLORER_NETWORK}` },
            ].map(({ label, value, link }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, background: "hsl(var(--muted))", padding: "10px 14px", borderRadius: 3 }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "hsl(var(--muted-foreground))", letterSpacing: "0.08em", minWidth: 64 }}>{label}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--foreground))", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
                {link && <a href={link} target="_blank" rel="noreferrer"><ExternalLink size={12} style={{ color: "hsl(var(--muted-foreground))" }} /></a>}
              </div>
            ))}
          </div>

          <div className="amber-line" style={{ marginBottom: 32 }} />

          {/* Wallet warning */}
          {!connected && (
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 3, padding: "12px 16px", marginBottom: 24, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#fbbf24" }}>
              ⚠ Connect your Petra wallet to interact with this document.
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid hsl(var(--border))" }}>
            {(["guardian", "challenge"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: "10px 20px", fontFamily: "'Oswald',sans-serif", fontWeight: 600, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", background: "transparent", border: "none", borderBottom: tab === t ? "2px solid var(--amber)" : "2px solid transparent", color: tab === t ? "var(--amber)" : "hsl(var(--muted-foreground))", marginBottom: -1, transition: "all 0.15s" }}>
                {t === "guardian"
                  ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Shield size={13} /> BECOME GUARDIAN</span>
                  : <span style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={13} /> CHALLENGE</span>}
              </button>
            ))}
          </div>

          {/* ── Guardian panel ── */}
          {tab === "guardian" && (
            <motion.div key="guardian" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p style={{ fontSize: "0.88rem", color: "hsl(var(--muted-foreground))", marginBottom: 24, lineHeight: 1.7 }}>
                Stake APT on this document to become a guardian. You vouch for its authenticity and earn a share of read fees. If someone challenges and wins, your stake is slashed.
              </p>

              {gStatus === "done" ? <TxSuccess hash={gTx} /> : (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {GUARDIAN_PRESETS.map(v => (
                      <button key={v} onClick={() => setGStake(v)}
                        style={{ flex: 1, padding: "12px 0", textAlign: "center", cursor: "pointer", borderRadius: 3, transition: "all 0.15s", background: gStake === v ? "rgba(245,158,11,0.12)" : "hsl(var(--card))", border: gStake === v ? "1px solid rgba(245,158,11,0.5)" : "1px solid hsl(var(--border))", fontFamily: "'Oswald',sans-serif", fontSize: "0.9rem", color: gStake === v ? "var(--amber)" : "hsl(var(--foreground))" }}>
                        {(v / 1e8).toFixed(2)} APT
                      </button>
                    ))}
                  </div>

                  <button className="btn-amber"
                    disabled={!connected || gStatus === "loading"}
                    onClick={becomeGuardian}
                    style={{ width: "100%", padding: "14px", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {gStatus === "loading"
                      ? <><Loader size={14} /> STAKING...</>
                      : <><Shield size={14} /> STAKE {(gStake / 1e8).toFixed(2)} APT AS GUARDIAN</>}
                  </button>

                  {gErr && <ErrBox msg={gErr} />}
                </>
              )}
            </motion.div>
          )}

          {/* ── Challenge panel ── */}
          {tab === "challenge" && (
            <motion.div key="challenge" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {doc.status === 0 ? (
                <>
                  <p style={{ fontSize: "0.88rem", color: "hsl(var(--muted-foreground))", marginBottom: 24, lineHeight: 1.7 }}>
                    Believe this document is fabricated? Stake 0.2 APT to open a challenge. Community votes for 72h. Losers get slashed.
                  </p>

                  {cStatus === "done" ? <TxSuccess hash={cTx} /> : (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))", letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>REASON *</label>
                        <textarea value={cReason} onChange={e => setCReason(e.target.value)}
                          placeholder="Why is this document fake or misleading?"
                          rows={3}
                          style={{ width: "100%", padding: "10px 14px", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 3, color: "hsl(var(--foreground))", fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "0.9rem", resize: "vertical" }} />
                      </div>

                      <button
                        disabled={!connected || !cReason.trim() || cStatus === "loading"}
                        onClick={openChallenge}
                        style={{ width: "100%", padding: "14px", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", borderRadius: 3, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171", fontFamily: "'Oswald',sans-serif", letterSpacing: "0.08em" }}>
                        {cStatus === "loading"
                          ? <><Loader size={14} /> SUBMITTING...</>
                          : <><AlertTriangle size={14} /> OPEN CHALLENGE — 0.2 APT</>}
                      </button>

                      {cErr && <ErrBox msg={cErr} />}
                    </>
                  )}
                </>
              ) : doc.status === 1 ? (
                <>
                  <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 3, padding: "14px 16px", marginBottom: 24 }}>
                    <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: "0.9rem", color: "#fbbf24", letterSpacing: "0.08em", marginBottom: 4 }}>⚡ UNDER CHALLENGE</div>
                    <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))", margin: 0 }}>
                      This document is being challenged. Vote before the deadline.
                    </p>
                  </div>

                  {vStatus === "done" ? <TxSuccess hash={vTx} /> : (
                    <>
                      <p style={{ fontSize: "0.88rem", color: "hsl(var(--muted-foreground))", marginBottom: 20 }}>
                        Stake APT to vote. <span style={{ color: "#4ade80" }}>✓ Real</span> = document is authentic. <span style={{ color: "#f87171" }}>✗ Fake</span> = challenger is right.
                      </p>

                      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                        <button onClick={() => setVSupports(true)}
                          style={{ flex: 1, padding: 16, cursor: "pointer", borderRadius: 3, background: vSupports === true ? "rgba(74,222,128,0.12)" : "hsl(var(--card))", border: vSupports === true ? "1px solid rgba(74,222,128,0.4)" : "1px solid hsl(var(--border))", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'Oswald',sans-serif", letterSpacing: "0.08em", color: vSupports === true ? "#4ade80" : "hsl(var(--foreground))", transition: "all 0.15s" }}>
                          <Check size={16} /> REAL
                        </button>
                        <button onClick={() => setVSupports(false)}
                          style={{ flex: 1, padding: 16, cursor: "pointer", borderRadius: 3, background: vSupports === false ? "rgba(248,113,113,0.12)" : "hsl(var(--card))", border: vSupports === false ? "1px solid rgba(248,113,113,0.4)" : "1px solid hsl(var(--border))", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'Oswald',sans-serif", letterSpacing: "0.08em", color: vSupports === false ? "#f87171" : "hsl(var(--foreground))", transition: "all 0.15s" }}>
                          <X size={16} /> FAKE
                        </button>
                      </div>

                      <button className="btn-amber"
                        disabled={!connected || vSupports === null || vStatus === "loading"}
                        onClick={vote}
                        style={{ width: "100%", padding: "14px", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        {vStatus === "loading"
                          ? <><Loader size={14} /> VOTING...</>
                          : <>SUBMIT VOTE — 0.01 APT</>}
                      </button>

                      {vErr && <ErrBox msg={vErr} />}
                    </>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: 40, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                  {doc.status === 3 ? "✓ Document was vindicated — challenge rejected." : "✗ Document was removed — challenge upheld."}
                </div>
              )}
            </motion.div>
          )}

        </motion.div>
      </div>
    </div>
  );
}