// ============================================================
//   PROMETHEUS — Backend API
//   Shelby Protocol + Aptos Move contract
//   Registry: Upstash Redis (persistent across restarts)
//   Reads: free, server streams blob from Shelby directly
// ============================================================
require("dotenv").config();

const express  = require("express");
const multer   = require("multer");
const cors     = require("cors");
const shelby   = require("./shelby");
const contract = require("./aptos");
const { Redis } = require("@upstash/redis");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// ─── Upstash Redis client ──────────────────────────────────
// Required env vars:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ─── Registry helpers ──────────────────────────────────────
const REGISTRY_KEY = "prometheus:registry";

async function registryGet(docId) {
  const raw = await redis.hget(REGISTRY_KEY, String(docId));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function registrySet(docId, meta) {
  await redis.hset(REGISTRY_KEY, { [String(docId)]: JSON.stringify(meta) });
}

async function registryEntries() {
  const all = await redis.hgetall(REGISTRY_KEY);
  if (!all) return [];
  return Object.entries(all).map(([k, v]) => [
    Number(k),
    typeof v === "string" ? JSON.parse(v) : v,
  ]);
}

async function registrySize() {
  return await redis.hlen(REGISTRY_KEY);
}

// ─── Helpers ──────────────────────────────────────────────
const C = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  cyan:  (s) => `\x1b[36m${s}\x1b[0m`,
  dim:   (s) => `\x1b[2m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
};

function formatAPT(octas) {
  return (Number(octas) / 1e8).toFixed(4) + " APT";
}

// ─── Routes ───────────────────────────────────────────────

// [GET] /health
app.get("/health", async (req, res) => {
  try {
    const networkName = process.env.NETWORK_NAME || "shelbynet";
    const size = await registrySize();
    res.json({
      ok: true,
      contract: process.env.PROMETHEUS_CONTRACT,
      serverWallet: null,
      network: networkName,
      docs: size,
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────
// [POST] /api/shelby/upload
// Storage-only upload (expects blob registered on-chain by client wallet)
// ─────────────────────────────────────────────────────────
app.post("/api/shelby/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const { account, blobName } = req.body;
    if (!account || !blobName)
      return res.status(400).json({ error: "account and blobName are required" });
    await shelby.putBlob(account, blobName, req.file.buffer);
    res.json({ ok: true });
  } catch (err) {
    console.error(C.red("Shelby storage upload error:"), err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// [POST] /api/registry
// Store doc metadata (client-signed flow)
// ─────────────────────────────────────────────────────────
app.post("/api/registry", async (req, res) => {
  try {
    const meta = req.body;
    if (!meta || typeof meta.docId !== "number") {
      return res.status(400).json({ error: "Invalid payload" });
    }
    await registrySet(meta.docId, meta);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// [POST] /api/upload
// Server-signed upload is disabled (no backend wallet).
// ─────────────────────────────────────────────────────────
app.post("/api/upload", async (_req, res) => {
  res.status(501).json({
    error: "Server-signed upload is disabled. Use client wallet upload flow.",
  });
});

// ─────────────────────────────────────────────────────────
// [GET] /api/docs
// List all documents with on-chain state
// ─────────────────────────────────────────────────────────
app.get("/api/docs", async (req, res) => {
  try {
    const entries = await registryEntries();
    const docs = [];

    for (const [docId, meta] of entries) {
      const [status, guardians, staked, reads] = await Promise.all([
        contract.getDocStatus(docId),
        contract.getGuardianCount(docId),
        contract.getTotalStaked(docId),
        contract.getReadCount(docId),
      ]);

      docs.push({
        ...meta,
        status,
        statusLabel:    contract.STATUS_LABELS[status],
        guardianCount:  guardians,
        totalStaked:    staked,
        totalStakedAPT: formatAPT(staked),
        readCount:      reads,
      });
    }

    docs.sort((a, b) => b.docId - a.docId);
    res.json({ docs, total: docs.length });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// [GET] /api/docs/:docId
// ─────────────────────────────────────────────────────────
app.get("/api/docs/:docId", async (req, res) => {
  try {
    const docId = parseInt(req.params.docId);
    const meta  = await registryGet(docId);

    if (!meta) return res.status(404).json({ error: "Document not found" });

    const [status, guardians, staked, reads] = await Promise.all([
      contract.getDocStatus(docId),
      contract.getGuardianCount(docId),
      contract.getTotalStaked(docId),
      contract.getReadCount(docId),
    ]);

    res.json({
      ...meta,
      status,
      statusLabel:    contract.STATUS_LABELS[status],
      guardianCount:  guardians,
      totalStaked:    staked,
      totalStakedAPT: formatAPT(staked),
      readCount:      reads,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// [GET] /api/read/:docId
// Free read — server streams blob from Shelby directly
// Browser opens file inline (PDF, video, image...)
// ─────────────────────────────────────────────────────────
app.get("/api/read/:docId", async (req, res) => {
  try {
    const docId = parseInt(req.params.docId);
    const meta  = await registryGet(docId);

    if (!meta) return res.status(404).json({ error: "Document not found" });

    // Set correct MIME type so browser can render inline
    if (meta.mimeType) {
      res.setHeader("Content-Type", meta.mimeType);
    }

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${meta.filename || "document"}"`
    );

    await shelby.streamBlob(meta.shelbyAccount, meta.shelbyBlobName, res);
  } catch (err) {
    console.error(C.red("Read error:"), err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ─────────────────────────────────────────────────────────
// [GET] /api/challenges/:challengeId/tally
// ─────────────────────────────────────────────────────────
app.get("/api/challenges/:challengeId/tally", async (req, res) => {
  try {
    const tally = await contract.getChallengeTally(parseInt(req.params.challengeId));
    res.json(tally);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// [GET] /api/stats
// Protocol-level stats
// ─────────────────────────────────────────────────────────
app.get("/api/stats", async (req, res) => {
  try {
    const [totalDocs, totalChallenges, entries] = await Promise.all([
      contract.getTotalDocs(),
      contract.getTotalChallenges(),
      registryEntries(),
    ]);

    let totalReads  = 0;
    let totalStaked = 0;

    await Promise.all(
      entries.map(async ([docId]) => {
        const [reads, staked] = await Promise.all([
          contract.getReadCount(docId),
          contract.getTotalStaked(docId),
        ]);
        totalReads  += reads;
        totalStaked += staked;
      })
    );

    res.json({
      totalDocs,
      totalChallenges,
      totalReads,
      totalStaked,
      totalStakedAPT: formatAPT(totalStaked),
      contract: process.env.PROMETHEUS_CONTRACT,
      network:  process.env.NETWORK_NAME || "shelbynet",
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(C.bold(`\n  🔥 PROMETHEUS BACKEND`));
  console.log(C.dim(`  http://localhost:${PORT}`));
  console.log(C.dim(`  Contract : ${process.env.PROMETHEUS_CONTRACT || "not set"}`));
  console.log(C.dim(`  Network  : ${process.env.NETWORK_NAME || "shelbynet"}\n`));
});
