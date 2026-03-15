// ─── shelby.js — Shelby Protocol client ──────────────────
const https = require("https");
const contract = require("./aptos");

const RPC_BASE_URL = process.env.SHELBY_RPC_BASE_URL || "";
const INDEXER_BASE_URL = process.env.SHELBY_INDEXER_BASE_URL || "";
const HOST = process.env.SHELBY_HOST
  || (RPC_BASE_URL ? new URL(RPC_BASE_URL).hostname : "api.shelbynet.shelby.xyz");
const BASE_PATH = RPC_BASE_URL
  ? new URL(RPC_BASE_URL).pathname.replace(/\/$/, "")
  : "/shelby";
const API_KEY = process.env.SHELBY_API_KEY || "";
const API_KEY_HEADER = process.env.SHELBY_API_KEY_HEADER || "x-api-key";
const SHELBY_NETWORK = (process.env.SHELBY_NETWORK || process.env.NETWORK_NAME || "testnet").toLowerCase();

function withApiKey(headers = {}) {
  if (!API_KEY) return headers;
  const header = API_KEY_HEADER;
  const value = header.toLowerCase() === "authorization" && !API_KEY.toLowerCase().startsWith("bearer ")
    ? `Bearer ${API_KEY}`
    : API_KEY;
  return { ...headers, [header]: value };
}

let shelbyClientPromise;
async function getShelbyClient() {
  if (!shelbyClientPromise) {
    shelbyClientPromise = (async () => {
      const { ShelbyNodeClient } = await import("@shelby-protocol/sdk/node");
      const { Network } = await import("@aptos-labs/ts-sdk");

      let network = Network.TESTNET;
      if (SHELBY_NETWORK === "mainnet") network = Network.MAINNET;
      if (SHELBY_NETWORK === "devnet") network = Network.DEVNET;
      if (SHELBY_NETWORK === "shelbynet" && Network.SHELBYNET) network = Network.SHELBYNET;

      const apiKey = API_KEY || process.env.GEOMI_API_KEY || "";
      const rpcApiKey = process.env.SHELBY_RPC_API_KEY || apiKey;
      const indexerApiKey = process.env.SHELBY_INDEXER_API_KEY || apiKey;

      const config = {
        network,
        apiKey,
        ...(RPC_BASE_URL || process.env.SHELBY_RPC_API_KEY ? {
          rpc: { baseUrl: RPC_BASE_URL || undefined, apiKey: rpcApiKey || undefined },
        } : {}),
        ...(INDEXER_BASE_URL || process.env.SHELBY_INDEXER_API_KEY ? {
          indexer: { baseUrl: INDEXER_BASE_URL || undefined, apiKey: indexerApiKey || undefined },
        } : {}),
      };

      return new ShelbyNodeClient(config);
    })();
  }
  return shelbyClientPromise;
}

let shelbyRpcPromise;
async function getShelbyRpcClient() {
  if (!shelbyRpcPromise) {
    shelbyRpcPromise = (async () => {
      const { ShelbyRPCClient } = await import("@shelby-protocol/sdk/node");
      const { Network } = await import("@aptos-labs/ts-sdk");

      let network = Network.TESTNET;
      if (SHELBY_NETWORK === "mainnet") network = Network.MAINNET;
      if (SHELBY_NETWORK === "devnet") network = Network.DEVNET;
      if (SHELBY_NETWORK === "shelbynet" && Network.SHELBYNET) network = Network.SHELBYNET;

      const apiKey = API_KEY || process.env.GEOMI_API_KEY || "";
      const rpcApiKey = process.env.SHELBY_RPC_API_KEY || apiKey;

      const config = {
        network,
        apiKey,
        ...(RPC_BASE_URL || process.env.SHELBY_RPC_API_KEY ? {
          rpc: { baseUrl: RPC_BASE_URL || undefined, apiKey: rpcApiKey || undefined },
        } : {}),
      };

      return new ShelbyRPCClient(config);
    })();
  }
  return shelbyRpcPromise;
}

function shelbyRequest({ method, path, buffer, headers = {} }) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.isBuffer(buffer) ? buffer : null;
    const options = {
      hostname: HOST,
      path: `${BASE_PATH}${path}`,
      method,
      headers: withApiKey({
        "Content-Length": payload ? payload.length : 0,
        ...(payload ? { "Content-Type": "application/octet-stream" } : {}),
        ...headers,
      }),
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
        text: Buffer.concat(chunks).toString(),
      }));
    });

    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Shelby timeout")); });
    if (payload) req.write(payload);
    req.end();
  });
}

// Upload blob to Shelby (handles commitments + storage)
async function uploadBlob(account, blobName, buffer) {
  const client = await getShelbyClient();
  const signer = contract.getServerAccount();
  const signerAddr = signer.accountAddress.toString();
  if (account && account.toLowerCase() !== signerAddr.toLowerCase()) {
    throw new Error(`SHELBY_ACCOUNT mismatch. env=${account} signer=${signerAddr}`);
  }

  const days = parseInt(process.env.SHELBY_EXPIRATION_DAYS || "30", 10);
  const expirationMicros = (Date.now() + days * 24 * 60 * 60 * 1000) * 1000;

  const result = await client.upload({
    signer,
    account: signer,
    blobData: buffer,
    blobName,
    expirationMicros,
  });

  return { ok: true, blobName, txHash: result?.transaction?.hash };
}

// Upload blob to Shelby storage ONLY (assumes blob already registered on-chain)
async function putBlob(account, blobName, buffer) {
  const client = await getShelbyRpcClient();
  const { AccountAddress } = await import("@aptos-labs/ts-sdk");
  const addr = AccountAddress.fromString(account);
  await client.putBlob({ account: addr, blobName, blobData: buffer });
  return { ok: true, blobName };
}

// GET blob from Shelby → pipe to Express response
function streamBlob(account, blobName, expressRes, mimeType) {
  return new Promise((resolve, reject) => {
    const path = `${BASE_PATH}/v1/blobs/${account}/${encodeURIComponent(blobName)}`;
    const options = {
      hostname: HOST,
      path,
      method: "GET",
      headers: withApiKey({ "Content-Length": 0 }),
    };

    const req = https.request(options, (shelbyRes) => {
      if (shelbyRes.statusCode === 200) {
        expressRes.setHeader("Content-Type",
          mimeType || shelbyRes.headers["content-type"] || "application/octet-stream");
        if (shelbyRes.headers["content-length"]) {
          expressRes.setHeader("Content-Length", shelbyRes.headers["content-length"]);
        }
        shelbyRes.pipe(expressRes);
        shelbyRes.on("end", resolve);
      } else {
        let d = "";
        shelbyRes.on("data", (c) => (d += c));
        shelbyRes.on("end", () => reject(new Error(`Shelby HTTP ${shelbyRes.statusCode}: ${d}`)));
      }
    });

    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Stream timeout")); });
    req.end();
  });
}

// Create micropayment session (server-sponsored)
async function createSession(userIdentity) {
  // Create micropayment channel if needed
  const channelRes = await shelbyRequest({
    method: "POST",
    path: "/v1/sessions/micropaymentchannels",
    headers: { "Content-Type": "application/json", "Content-Length": 2 },
    buffer: Buffer.from("{}"),
  });

  const channelId = channelRes.headers["x-channel-id"] ||
    (() => { try { return JSON.parse(channelRes.text)?.channelId; } catch { return "default"; } })();

  const sessionRes = await shelbyRequest({
    method: "POST",
    path: "/v1/sessions",
    headers: { "Content-Type": "application/json" },
    buffer: Buffer.from(JSON.stringify({ userIdentity, micropaymentUpdate: channelId || "default" })),
  });

  if (sessionRes.status === 201) {
    const { sessionId } = JSON.parse(sessionRes.text);
    return sessionId;
  }
  throw new Error(`Session creation failed: ${sessionRes.status} — ${sessionRes.text}`);
}

module.exports = { uploadBlob, putBlob, streamBlob, createSession };