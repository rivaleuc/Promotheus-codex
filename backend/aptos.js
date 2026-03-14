// ─── aptos.js — Aptos contract interaction ────────────────
const {
  Aptos, AptosConfig, Network,
  Account, Ed25519PrivateKey,
  InputEntryFunctionData,
} = require("@aptos-labs/ts-sdk");
const crypto = require("crypto");

const NODE_URL = process.env.APTOS_NODE_URL || "https://api.shelbynet.shelby.xyz/v1";
const API_KEY = process.env.APTOS_API_KEY || process.env.GEOMI_API_KEY || "";
const CONTRACT = process.env.PROMETHEUS_CONTRACT;

// Custom network config for shelbynet
const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: NODE_URL,
  ...(API_KEY ? { clientConfig: { API_KEY } } : {}),
});
const aptos = new Aptos(config);

// Server account (pays gas)
let serverAccount;
function getServerAccount() {
  if (serverAccount) return serverAccount;
  const key = process.env.SERVER_PRIVATE_KEY;
  if (!key) throw new Error("SERVER_PRIVATE_KEY not set");
  serverAccount = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(key) });
  return serverAccount;
}

// ─── SHA256 hash of file buffer ───────────────────────────
function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// ─── Submit entry function tx ─────────────────────────────
async function submitTx(fn, args) {
  const account = getServerAccount();
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: { function: fn, functionArguments: args },
  });
  const signed = await aptos.transaction.sign({ signer: account, transaction: tx });
  const result = await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signed });
  await aptos.waitForTransaction({ transactionHash: result.hash });
  return result.hash;
}

// ─── View function ────────────────────────────────────────
async function viewFn(fn, args = []) {
  const result = await aptos.view({ payload: { function: fn, functionArguments: args } });
  return result;
}

// ─── Contract calls ───────────────────────────────────────

// Publish document on-chain after Shelby upload
async function publishDocument({
  shelbyAccount, shelbyBlobName,
  title, description, sha256Hash,
  stakeAmount,
}) {
  return submitTx(`${CONTRACT}::prometheus::publish_document`, [
    CONTRACT,           // registry_addr
    shelbyAccount,      // shelby_account
    shelbyBlobName,     // shelby_blob_name
    title,
    description,
    sha256Hash,
    stakeAmount.toString(),
  ]);
}

// Record a read event on-chain
async function recordRead(docId) {
  return submitTx(`${CONTRACT}::document::record_read`, [
    CONTRACT,
    docId.toString(),
  ]);
}

// Get document status
async function getDocStatus(docId) {
  const [status] = await viewFn(`${CONTRACT}::document::get_doc_status`, [CONTRACT, docId.toString()]);
  return Number(status);
}

// Get total docs
async function getTotalDocs() {
  const [total] = await viewFn(`${CONTRACT}::document::get_total_docs`, [CONTRACT]);
  return Number(total);
}

// Get guardian count
async function getGuardianCount(docId) {
  const [count] = await viewFn(`${CONTRACT}::document::get_guardian_count`, [CONTRACT, docId.toString()]);
  return Number(count);
}

// Get total staked on doc
async function getTotalStaked(docId) {
  const [staked] = await viewFn(`${CONTRACT}::document::get_total_staked_on_doc`, [CONTRACT, docId.toString()]);
  return Number(staked);
}

// Get read count
async function getReadCount(docId) {
  const [count] = await viewFn(`${CONTRACT}::document::get_doc_read_count`, [CONTRACT, docId.toString()]);
  return Number(count);
}

// Get challenge tally
async function getChallengeTally(challengeId) {
  const result = await viewFn(`${CONTRACT}::challenge::get_vote_tally`, [CONTRACT, challengeId.toString()]);
  return { votesFor: Number(result[0]), votesAgainst: Number(result[1]) };
}

// Get total challenges
async function getTotalChallenges() {
  const [total] = await viewFn(`${CONTRACT}::challenge::get_total_challenges`, [CONTRACT]);
  return Number(total);
}

// Status constants
const DOC_STATUS = { ACTIVE: 0, CHALLENGED: 1, REMOVED: 2, VINDICATED: 3 };
const STATUS_LABELS = { 0: "active", 1: "challenged", 2: "removed", 3: "vindicated" };

module.exports = {
  sha256,
  publishDocument,
  recordRead,
  getDocStatus,
  getTotalDocs,
  getGuardianCount,
  getTotalStaked,
  getReadCount,
  getChallengeTally,
  getTotalChallenges,
  DOC_STATUS,
  STATUS_LABELS,
  getServerAccount,
};
