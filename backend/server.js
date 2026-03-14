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
    let account = null;
    try { account = contract.getServerAccount(); } catch {}
    const networkName = process.env.NETWORK_NAME || "shelbynet";
    res.json({
      ok: true,
      contract: process.env.PROMETHEUS_CONTRACT,
      serverWallet: account ? account.accountAddress.toString() : null,
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
// Flow:
//   1. Receive file
//   2. Compute sha256
//   3. Upload to Shelby
//   4. Publish on Aptos contract (stake APT)
//   5. Store metadata locally
//   6. Return doc info
// ─────────────────────────────────────────────────────────
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const {
      title       = req.file.originalname,
      description = "",
      stakeAmount = 10_000_000, // 0.1 APT default
    } = req.body;

    const shelbyAccount = process.env.SHELBY_ACCOUNT;
    if (!shelbyAccount) return res.status(500).json({ error: "SHELBY_ACCOUNT not set" });

    const timestamp  = Date.now();
    const safeName   = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blobName   = `prometheus/${timestamp}_${safeName}`;
    const hash       = contract.sha256(req.file.buffer);

    console.log(C.cyan(`⬆  Uploading: ${blobName} (${req.file.size} bytes)`));

    // 1. Upload to Shelby
    await shelby.uploadBlob(shelbyAccount, blobName, req.file.buffer);
    console.log(C.green(`   Shelby upload ✔`));

    // 2. Publish on-chain
    const txHash = await contract.publishDocument({
      shelbyAccount,
      shelbyBlobName: blobName,
      title,
      description,
      sha256Hash: hash,
      stakeAmount: parseInt(stakeAmount),
    });
    console.log(C.green(`   Contract publish ✔ tx: ${txHash}`));

    // 3. Get docId (= next_id - 1 after publish)
    const docId = await contract.getTotalDocs();

    // 4. Store metadata
    const meta = {
      docId,
      title,
      description,
      filename:    req.file.originalname,
      mimeType:    req.file.mimetype,
      size:        req.file.size,
      sha256:      hash,
      shelbyAccount,
      shelbyBlobName: blobName,
      stakeAmount: parseInt(stakeAmount),
      txHash,
      uploadedAt:  new Date().toISOString(),
    };
    docRegistry.set(docId, meta);

    console.log(C.green(`   Doc #${docId} registered\n`));

    res.json({
      ok: true,
      docId,
      txHash,
      sha256: hash,
      shelbyBlobName: blobName,
      stakeAmount: formatAPT(stakeAmount),
      explorerUrl: `https://explorer.aptoslabs.com/txn/${txHash}?network=${process.env.EXPLORER_NETWORK || process.env.NETWORK_NAME || "shelbynet"}`,
    });

  } catch (err) {
    console.error(C.red("Upload error:"), err.message);
    res.status(500).json({ error: err.message });
  }
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
// Server-sponsored read:
//   1. Check doc is active/vindicated
//   2. Create Shelby session (server pays)
//   3. Record read on-chain
//   4. Stream file to client
//
// Client pays: NOTHING
// ─────────────────────────────────────────────────────────
app.get("/api/read/:docId", async (req, res) => {
  const docId  = parseInt(req.params.docId);
  const meta   = docRegistry.get(docId);

  if (!meta) return res.status(404).json({ error: "Document not found" });

  try {
    // Check status
    const status = await contract.getDocStatus(docId);
    if (status === contract.DOC_STATUS.REMOVED) {
      return res.status(410).json({ error: "Document was removed after challenge" });
    }

    const userIdentity = req.headers["x-wallet"] || req.ip || "anonymous";

    // Server creates session + pays Shelby
    const sessionId = await shelby.createSession(userIdentity);

    // Record read on Aptos (async — don't block the stream)
    if (process.env.SERVER_PRIVATE_KEY) {
      contract.recordRead(docId).catch((e) =>
        console.warn(C.dim(`  record_read warning: ${e.message}`))
      );
    }

    console.log(C.cyan(`⬇  Reading doc #${docId} — user: ${userIdentity}`));

    res.setHeader("Content-Disposition", `attachment; filename="${meta.filename}"`);
    res.setHeader("X-Doc-Id",     docId.toString());
    res.setHeader("X-Sha256",     meta.sha256);
    res.setHeader("X-Tx-Hash",    meta.txHash);
    res.setHeader("X-Session-Id", sessionId);

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
