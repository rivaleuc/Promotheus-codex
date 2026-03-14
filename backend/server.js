// ============================================================
//   PROMETHEUS — Backend API
//   Shelby Protocol + Aptos Move contract
// ============================================================
require("dotenv").config();

const express = require("express");
const multer  = require("multer");
const cors    = require("cors");
const shelby  = require("./shelby");
const contract = require("./aptos");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// ─── In-memory doc registry ───────────────────────────────
// Maps docId → full metadata (augments on-chain data)
// In production: replace with Postgres
const docRegistry = new Map();

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
    res.json({
      ok: true,
      contract: process.env.PROMETHEUS_CONTRACT,
      serverWallet: null,
      network: networkName,
      docs: docRegistry.size,
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
    if (!account || !blobName) return res.status(400).json({ error: "account and blobName are required" });
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
    docRegistry.set(meta.docId, meta);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// [POST] /api/upload
//
// Server-signed upload is disabled (no backend wallet).
// Use the client wallet flow (/api/shelby/upload + on-chain tx from frontend).
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
    const docs = [];

    for (const [docId, meta] of docRegistry.entries()) {
      const [status, guardians, staked, reads] = await Promise.all([
        contract.getDocStatus(docId),
        contract.getGuardianCount(docId),
        contract.getTotalStaked(docId),
        contract.getReadCount(docId),
      ]);

      docs.push({
        ...meta,
        status,
        statusLabel: contract.STATUS_LABELS[status],
        guardianCount: guardians,
        totalStaked:   staked,
        totalStakedAPT: formatAPT(staked),
        readCount:     reads,
      });
    }

    // Sort by docId desc (newest first)
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
    const meta  = docRegistry.get(docId);

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
      statusLabel: contract.STATUS_LABELS[status],
      guardianCount: guardians,
      totalStaked:   staked,
      totalStakedAPT: formatAPT(staked),
      readCount:     reads,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// [GET] /api/read/:docId
//
// Server-sponsored reads are disabled (no backend wallet).
// Paid reads must be done client-side with the user's wallet.
// ─────────────────────────────────────────────────────────
app.get("/api/read/:docId", async (req, res) => {
  const docId = parseInt(req.params.docId);
  const meta = docRegistry.get(docId);

  if (!meta) return res.status(404).json({ error: "Document not found" });

  res.status(402).json({
    error: "Paid reads require client wallet signature. Server wallet is disabled.",
    docId,
    shelbyAccount: meta.shelbyAccount,
    shelbyBlobName: meta.shelbyBlobName,
  });
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
    const [totalDocs, totalChallenges] = await Promise.all([
      contract.getTotalDocs(),
      contract.getTotalChallenges(),
    ]);

    // Aggregate from registry
    let totalReads = 0;
    let totalStaked = 0;
    for (const [docId] of docRegistry.entries()) {
      const [reads, staked] = await Promise.all([
        contract.getReadCount(docId),
        contract.getTotalStaked(docId),
      ]);
      totalReads  += reads;
      totalStaked += staked;
    }

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
