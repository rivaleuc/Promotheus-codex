import "./polyfills";
import React from "react";
import ReactDOM from "react-dom/client";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import App from "./App";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";

const networkName = (import.meta.env.VITE_NETWORK_NAME || "testnet").toLowerCase();
const dappNetwork =
  networkName === "mainnet"
    ? Network.MAINNET
    : networkName === "devnet"
      ? Network.DEVNET
      : Network.TESTNET;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AptosWalletAdapterProvider
        autoConnect={false}
        optInWallets={["Petra", "Petra Web"]}
        dappConfig={{ network: dappNetwork }}
        onError={(e) => console.error("[wallet]", e)}
      >
        <App />
      </AptosWalletAdapterProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
