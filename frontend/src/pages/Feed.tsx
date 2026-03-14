import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetchDocs, formatBytes, shortHash, STATUS, NETWORK_NAME, type Doc } from "../lib/api";
import { Shield, Eye, ChevronRight, RefreshCw, Search } from "lucide-react";

export default function Feed() {
  const [docs, setDocs]       = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"all" | "active" | "challenged" | "vindicated">("all");
  const [query, setQuery]     = useState("");

  const load = async () => {
    setLoading(true);
    try { setDocs(await fetchDocs()); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const visible = docs.filter(d => {
    if (filter !== "all" && d.statusLabel !== filter) return false;
    if (query && !d.title.toLowerCase().includes(query.toLowerCase()) &&
        !d.description.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", paddingTop: "56px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: "2.2rem", marginBottom: 4 }}>DOCUMENT FEED</h1>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              {docs.length} documents on {NETWORK_NAME}
            </p>
          </div>
          <button className="btn-ghost" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }} onClick={load}>
            <RefreshCw size={12} />
            refresh
          </button>
        </div>

        {/* Search + filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
            <input
              placeholder="Search documents..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 3, color: "hsl(var(--foreground))", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}
            />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["all","active","challenged","vindicated"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: "8px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 3, transition: "all 0.15s", background: filter === f ? "rgba(245,158,11,0.12)" : "transparent", border: filter === f ? "1px solid rgba(245,158,11,0.4)" : "1px solid hsl(var(--border))", color: filter === f ? "var(--amber)" : "hsl(var(--muted-foreground))" }}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Doc list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            loading...
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              {docs.length === 0 ? "No documents yet — be the first to publish." : "No documents match."}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {visible.map((doc, i) => (
                <motion.div key={doc.docId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link to={`/doc/${doc.docId}`} style={{ textDecoration: "none" }}>
                    <div className="p-card" style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, cursor: "pointer", transition: "border-color 0.15s" }}>

                      {/* Doc ID */}
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))", minWidth: 36, textAlign: "right" }}>
                        #{doc.docId}
                      </div>

                      {/* Main */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: "1rem", letterSpacing: "0.06em", margin: 0, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {doc.title}
                          </h3>
                          <span className={STATUS[doc.status]?.cls} style={{ padding: "2px 8px", borderRadius: 2, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                            {STATUS[doc.status]?.label}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.description || doc.filename}
                        </p>
                      </div>

                      {/* Stats */}
                      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--amber)", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
                            <Shield size={11} />
                            {doc.guardianCount}
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "hsl(var(--muted-foreground))", letterSpacing: "0.08em" }}>guardians</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "hsl(var(--foreground))", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
                            <Eye size={11} />
                            {doc.readCount}
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "hsl(var(--muted-foreground))", letterSpacing: "0.08em" }}>reads</div>
                        </div>
                        <div style={{ textAlign: "right", minWidth: 80 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "var(--amber)" }}>
                            {doc.totalStakedAPT}
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "hsl(var(--muted-foreground))", letterSpacing: "0.08em" }}>staked</div>
                        </div>
                        <ChevronRight size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
