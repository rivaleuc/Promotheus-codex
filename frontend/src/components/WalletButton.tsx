import { useMemo, useState } from "react";
import { useWallet, WalletReadyState } from "@aptos-labs/wallet-adapter-react";

function shortAddr(addr?: unknown) {
  if (!addr) return "—";
  const s =
    typeof addr === "string"
      ? addr
      : typeof (addr as any).toString === "function"
        ? (addr as any).toString()
        : String(addr);
  if (!s || s === "[object Object]") return "—";
  return s.slice(0, 6) + "…" + s.slice(-4);
}

export default function WalletButton() {
  const { connected, account, connect, disconnect, wallets, notDetectedWallets, isLoading } = useWallet();
  const [err, setErr] = useState("");

  const petra = useMemo(
    () => wallets.find((w) => w.name === "Petra" || w.name === "Petra Web"),
    [wallets]
  );
  const petraMissing = useMemo(
    () => notDetectedWallets.find((w) => w.name === "Petra" || w.name === "Petra Web"),
    [notDetectedWallets]
  );

  if (connected && account?.address) {
    return (
      <button
        className="btn-ghost"
        onClick={() => disconnect()}
        style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}
        title={typeof account.address === "string" ? account.address : String(account.address)}
      >
        {shortAddr(account.address)} · Disconnect
      </button>
    );
  }

  if (petra && petra.readyState === WalletReadyState.Installed) {
    return (
      <button
        className="btn-amber"
        disabled={isLoading}
        onClick={() => connect(petra.name).catch((e) => setErr(e?.message || "Wallet error"))}
        style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}
      >
        Connect Petra
      </button>
    );
  }

  if (petraMissing) {
    return (
      <a href={petraMissing.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
        <button
          className="btn-ghost"
          style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}
        >
          Install Petra
        </button>
      </a>
    );
  }

  if (err) {
    return (
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#f87171" }}>
        {err}
      </div>
    );
  }

  return (
    <button
      className="btn-ghost"
      disabled
      style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}
    >
      Wallets Loading…
    </button>
  );
}
