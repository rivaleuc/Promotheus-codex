import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  ShelbyBlobClient,
  ClayErasureCodingProvider,
  erasureCodingConfig16Total10Data13Helper,
  erasureCodingConfig4Total2Data3Helper,
  expectedTotalChunksets,
  generateCommitments,
} from "@shelby-protocol/sdk/browser";
import { formatBytes, NETWORK_NAME, PROMETHEUS_CONTRACT, APTOS_NODE_URL, SHELBY_EXPIRATION_DAYS, uploadShelbyBlob, registerDocMeta } from "../lib/api";
import { Upload, FileText, ExternalLink, CheckCircle, Flame } from "lucide-react";

const PRESETS = [
  { label: "0.1 APT", value: 10_000_000, desc: "Minimum — low conviction" },
  { label: "0.5 APT", value: 50_000_000, desc: "Standard — moderate signal" },
  { label: "1 APT",   value: 100_000_000, desc: "High conviction" },
  { label: "5 APT",   value: 500_000_000, desc: "Maximum trust signal" },
];

export default function UploadPage() {
  const navigate = useNavigate();
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const aptos = useMemo(() => new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: APTOS_NODE_URL })), [APTOS_NODE_URL]);
  const [file, setFile]           = useState<File | null>(null);
  const [dragging, setDragging]   = useState(false);
  const [title, setTitle]         = useState("");
  const [desc, setDesc]           = useState("");
  const [stake, setStake]         = useState(10_000_000);
  const [progress, setProgress]   = useState(0);
  const [status, setStatus]       = useState<"idle"|"uploading"|"done"|"error">("idle");
  const [result, setResult]       = useState<{ docId: number; txHash: string; explorerUrl: string } | null>(null);
  const [error, setError]         = useState("");

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")); }
  }, [title]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")); }
  };

  const submit = async () => {
    if (!file || !title) return;
    if (!connected || !account?.address) {
      setError("Connect Petra wallet first."); setStatus("error");
      return;
    }
    if (!PROMETHEUS_CONTRACT) {
      setError("VITE_PROMETHEUS_CONTRACT not set."); setStatus("error");
      return;
    }
    setStatus("uploading"); setProgress(0); setError("");
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const blobName = `prometheus/${Date.now()}_${safeName}`;
      const expirationMicros = (Date.now() + SHELBY_EXPIRATION_DAYS * 24 * 60 * 60 * 1000) * 1000;

      setProgress(8);
      const encoding = Number(import.meta.env.VITE_SHELBY_ENCODING || "0");
      const config = encoding === 0
        ? erasureCodingConfig16Total10Data13Helper()
        : erasureCodingConfig4Total2Data3Helper();
      const provider = await ClayErasureCodingProvider.create(config);
      const commitments = await generateCommitments(provider, buffer);
      const chunksetSize = config.chunkSizeBytes * config.erasure_k;
      const numChunksets = expectedTotalChunksets(buffer.length, chunksetSize);

      const registerPayload = ShelbyBlobClient.createRegisterBlobPayload({
        blobName,
        blobSize: buffer.length,
        blobMerkleRoot: commitments.blob_merkle_root,
        expirationMicros,
        numChunksets,
        encoding: config.enumIndex,
      });

      setProgress(18);
      const registerTx = await signAndSubmitTransaction({
        data: {
          function: registerPayload.function,
          typeArguments: [],
          functionArguments: registerPayload.functionArguments,
        },
      });
      await aptos.waitForTransaction({ transactionHash: registerTx.hash });

      setProgress(30);
      await uploadShelbyBlob(file, account.address, blobName, (pct) => {
        setProgress(30 + Math.round(pct * 0.5));
      });

      const sha256Buffer = await crypto.subtle.digest("SHA-256", buffer);
      const sha256 = Array.from(new Uint8Array(sha256Buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

      setProgress(82);
      const publishTx = await signAndSubmitTransaction({
        data: {
          function: `${PROMETHEUS_CONTRACT}::prometheus::publish_document`,
          typeArguments: [],
          functionArguments: [
            PROMETHEUS_CONTRACT,
            account.address,
            blobName,
            title,
            desc,
            sha256,
            stake.toString(),
          ],
        },
      });
      await aptos.waitForTransaction({ transactionHash: publishTx.hash });

      const [totalDocs] = await aptos.view({
        payload: {
          function: `${PROMETHEUS_CONTRACT}::document::get_total_docs`,
          functionArguments: [PROMETHEUS_CONTRACT],
        },
      });
      const docId = Number(totalDocs);

      await registerDocMeta({
        docId,
        title,
        description: desc,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        sha256,
        shelbyAccount: account.address,
        shelbyBlobName: blobName,
        stakeAmount: stake,
        txHash: publishTx.hash,
        uploadedAt: new Date().toISOString(),
      });

      setProgress(100);
      setResult({
        docId,
        txHash: publishTx.hash,
        explorerUrl: `https://explorer.aptoslabs.com/txn/${publishTx.hash}?network=${import.meta.env.VITE_EXPLORER_NETWORK || import.meta.env.VITE_NETWORK_NAME || "testnet"}`,
      });
      setStatus("done");
    } catch (e: any) {
      setError(e.message); setStatus("error");
    }
  };

  if (status === "done" && result) return (
    <div style={{ minHeight: "100vh", paddingTop: "56px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="p-card" style={{ maxWidth: 480, width: "100%", margin: 24, padding: 40, textAlign: "center" }}>
        <CheckCircle size={40} style={{ color: "#4ade80", margin: "0 auto 20px" }} />
        <h2 style={{ fontSize: "1.6rem", marginBottom: 8 }}>PUBLISHED</h2>
        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 32 }}>
          Document #{result.docId} is now live on {NETWORK_NAME}
        </p>
        <div style={{ background: "hsl(var(--muted))", borderRadius: 3, padding: 16, marginBottom: 24, textAlign: "left" }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>TX HASH</div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "var(--amber)", wordBreak: "break-all" }}>
            {result.txHash}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="btn-amber" style={{ padding: "12px 24px", fontSize: "0.85rem" }} onClick={() => navigate(`/doc/${result.docId}`)}>
            View Document
          </button>
          <a href={result.explorerUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button className="btn-ghost" style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 6 }}>
              <ExternalLink size={12} /> Explorer
            </button>
          </a>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", paddingTop: "56px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: "2.2rem", marginBottom: 6 }}>PUBLISH DOCUMENT</h1>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            Upload to Shelby Protocol + stake APT on-chain
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById("file-input")?.click()}
          style={{ border: `2px dashed ${dragging ? "var(--amber)" : file ? "rgba(74,222,128,0.4)" : "hsl(var(--border))"}`, borderRadius: 4, padding: 40, textAlign: "center", cursor: "pointer", transition: "all 0.2s", marginBottom: 28, background: dragging ? "var(--amber-glow)" : "transparent" }}>
          <input id="file-input" type="file" style={{ display: "none" }} onChange={onFile} />
          {file ? (
            <div>
              <FileText size={28} style={{ color: "#4ade80", margin: "0 auto 12px" }} />
              <div style={{ fontFamily: "'Oswald',sans-serif", letterSpacing: "0.06em", fontSize: "1rem", marginBottom: 4 }}>
                {file.name}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                {formatBytes(file.size)}
              </div>
            </div>
          ) : (
            <div>
              <Upload size={28} style={{ color: "hsl(var(--muted-foreground))", margin: "0 auto 12px" }} />
              <div style={{ fontFamily: "'Oswald',sans-serif", letterSpacing: "0.06em", marginBottom: 6 }}>
                DROP FILE HERE
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                or click to browse — any format, up to 500MB
              </div>
            </div>
          )}
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
          <div>
            <label style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
              TITLE *
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title" style={{ width: "100%", padding: "10px 14px", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 3, color: "hsl(var(--foreground))", fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "0.9rem" }} />
          </div>
          <div>
            <label style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
              DESCRIPTION
            </label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What does this document prove?" rows={3} style={{ width: "100%", padding: "10px 14px", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 3, color: "hsl(var(--foreground))", fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "0.9rem", resize: "vertical" }} />
          </div>
        </div>

        {/* Stake selector */}
        <div style={{ marginBottom: 32 }}>
          <label style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))", letterSpacing: "0.1em", display: "block", marginBottom: 12 }}>
            STAKE AMOUNT — how much APT do you vouch with?
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {PRESETS.map(p => (
              <button key={p.value} onClick={() => setStake(p.value)}
                style={{ padding: "14px 8px", textAlign: "center", cursor: "pointer", borderRadius: 3, transition: "all 0.15s", background: stake === p.value ? "rgba(245,158,11,0.12)" : "hsl(var(--card))", border: stake === p.value ? "1px solid rgba(245,158,11,0.5)" : "1px solid hsl(var(--border))" }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: "1.1rem", color: stake === p.value ? "var(--amber)" : "hsl(var(--foreground))", marginBottom: 4 }}>
                  {p.label}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "hsl(var(--muted-foreground))", letterSpacing: "0.06em" }}>
                  {p.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Progress */}
        {status === "uploading" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                {progress < 25 ? "Registering on Shelby…" : progress < 80 ? "Uploading to Shelby…" : progress < 95 ? "Publishing on Aptos…" : "Finalizing…"}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--amber)" }}>{progress}%</span>
            </div>
            <div style={{ height: 3, background: "hsl(var(--border))", borderRadius: 2 }}>
              <motion.div animate={{ width: `${progress}%` }} style={{ height: "100%", background: "var(--amber)", borderRadius: 2 }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 3, padding: "12px 16px", marginBottom: 20, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#f87171" }}>
            {error}
          </div>
        )}

        <button className="btn-amber" disabled={!file || !title || status === "uploading"} onClick={submit}
          style={{ width: "100%", padding: "16px", fontSize: "0.95rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Flame size={16} />
          {status === "uploading" ? "PUBLISHING..." : "PUBLISH & STAKE"}
        </button>
      </div>
    </div>
  );
}
