const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const DEMO = import.meta.env.VITE_DEMO === "1";
export const NETWORK_NAME = (import.meta.env.VITE_NETWORK_NAME || "testnet").toLowerCase();
export const EXPLORER_NETWORK = (import.meta.env.VITE_EXPLORER_NETWORK || NETWORK_NAME).toLowerCase();
export const APTOS_NODE_URL = import.meta.env.VITE_APTOS_NODE_URL || "https://api.testnet.aptoslabs.com/v1";
export const PROMETHEUS_CONTRACT = import.meta.env.VITE_PROMETHEUS_CONTRACT || "";
export const SHELBY_EXPIRATION_DAYS = Number(import.meta.env.VITE_SHELBY_EXPIRATION_DAYS || "30");
export const READS_DISABLED = (import.meta.env.VITE_DISABLE_READS || "1") === "1";

export interface Doc {
  docId: number;
  title: string;
  description: string;
  filename: string;
  mimeType: string;
  size: number;
  sha256: string;
  shelbyAccount: string;
  shelbyBlobName: string;
  stakeAmount: number;
  txHash: string;
  uploadedAt: string;
  status: number;          // 0 active | 1 challenged | 2 removed | 3 vindicated
  statusLabel: string;
  guardianCount: number;
  totalStaked: number;
  totalStakedAPT: string;
  readCount: number;
  explorerUrl?: string;
}

export interface Stats {
  totalDocs: number;
  totalChallenges: number;
  totalReads: number;
  totalStaked: number;
  totalStakedAPT: string;
  contract: string;
  network: string;
}

export interface UploadResult {
  ok: boolean;
  docId: number;
  txHash: string;
  sha256: string;
  shelbyBlobName: string;
  stakeAmount: string;
  explorerUrl: string;
}

export interface RegistryPayload {
  docId: number;
  title: string;
  description: string;
  filename: string;
  mimeType: string;
  size: number;
  sha256: string;
  shelbyAccount: string;
  shelbyBlobName: string;
  stakeAmount: number;
  txHash: string;
  uploadedAt: string;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const demoDocs: Doc[] = [
  {
    docId: 3,
    title: "Apollo Memo",
    description: "Internal briefing on the Apollo incident.",
    filename: "apollo_memo.pdf",
    mimeType: "application/pdf",
    size: 2450000,
    sha256: "4f8b2a8c9d3e0b6e0c2a7c9e9b8f7a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f",
    shelbyAccount: "0xabc123",
    shelbyBlobName: "prometheus/1710240000_apollo_memo.pdf",
    stakeAmount: 100000000,
    txHash: "0x7a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d",
    uploadedAt: "2025-03-10T12:00:00.000Z",
    status: 0,
    statusLabel: "active",
    guardianCount: 12,
    totalStaked: 250000000,
    totalStakedAPT: "2.5000 APT",
    readCount: 341,
  },
  {
    docId: 2,
    title: "Orion Settlement",
    description: "Disputed settlement terms and signatures.",
    filename: "orion_settlement.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 980000,
    sha256: "9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f",
    shelbyAccount: "0xdef456",
    shelbyBlobName: "prometheus/1710153600_orion_settlement.docx",
    stakeAmount: 50000000,
    txHash: "0x5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a",
    uploadedAt: "2025-03-09T08:30:00.000Z",
    status: 1,
    statusLabel: "challenged",
    guardianCount: 7,
    totalStaked: 180000000,
    totalStakedAPT: "1.8000 APT",
    readCount: 129,
  },
  {
    docId: 1,
    title: "Helios Report",
    description: "Forensic analysis of the Helios breach.",
    filename: "helios_report.txt",
    mimeType: "text/plain",
    size: 120000,
    sha256: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
    shelbyAccount: "0x987654",
    shelbyBlobName: "prometheus/1710067200_helios_report.txt",
    stakeAmount: 20000000,
    txHash: "0xabcdef0123456789abcdef0123456789",
    uploadedAt: "2025-03-08T16:45:00.000Z",
    status: 3,
    statusLabel: "vindicated",
    guardianCount: 3,
    totalStaked: 35000000,
    totalStakedAPT: "0.3500 APT",
    readCount: 58,
  },
];

const demoStats: Stats = {
  totalDocs: demoDocs.length,
  totalChallenges: 4,
  totalReads: 528,
  totalStaked: 465000000,
  totalStakedAPT: "4.6500 APT",
  contract: "0xDEMO",
  network: "testnet",
};

export async function fetchDocs(): Promise<Doc[]> {
  if (DEMO) return demoDocs;
  const d = await get<{ docs: Doc[] }>("/api/docs");
  return d.docs;
}

export async function fetchDoc(id: number): Promise<Doc> {
  if (DEMO) {
    const doc = demoDocs.find((d) => d.docId === id);
    if (doc) return doc;
    throw new Error("Document not found");
  }
  return get<Doc>(`/api/docs/${id}`);
}

export async function fetchStats(): Promise<Stats> {
  if (DEMO) return demoStats;
  return get<Stats>("/api/stats");
}

export async function uploadDoc(
  file: File,
  title: string,
  description: string,
  stakeAmount: number,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  if (DEMO) {
    onProgress?.(100);
    return {
      ok: true,
      docId: 999,
      txHash: "0xDEMO_TX_HASH",
      sha256: "DEMO_SHA256",
      shelbyBlobName: "prometheus/demo_blob",
      stakeAmount: "1.0000 APT",
      explorerUrl: "https://explorer.aptoslabs.com",
    };
  }
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    fd.append("description", description);
    fd.append("stakeAmount", String(stakeAmount));

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const d = JSON.parse(xhr.responseText);
      if (xhr.status === 200) resolve(d);
      else reject(new Error(d.error || "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.open("POST", `${BASE}/api/upload`);
    xhr.send(fd);
  });
}

export async function uploadShelbyBlob(
  file: File,
  account: string,
  blobName: string,
  onProgress?: (pct: number) => void
): Promise<{ ok: boolean }> {
  if (DEMO) {
    onProgress?.(100);
    return { ok: true };
  }
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("account", account);
    fd.append("blobName", blobName);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const d = JSON.parse(xhr.responseText || "{}");
      if (xhr.status === 200) resolve(d);
      else reject(new Error(d.error || "Shelby storage upload failed"));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.open("POST", `${BASE}/api/shelby/upload`);
    xhr.send(fd);
  });
}

export async function registerDocMeta(payload: RegistryPayload): Promise<{ ok: boolean }> {
  if (DEMO) return { ok: true };
  const r = await fetch(`${BASE}/api/registry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export function downloadUrl(docId: number, wallet?: string): string {
  if (DEMO) return "#";
  return `${BASE}/api/read/${docId}${wallet ? `?wallet=${wallet}` : ""}`;
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export function formatAPT(octas: number): string {
  return (octas / 1e8).toFixed(4) + " APT";
}

export function shortHash(h: string): string {
  if (!h) return "—";
  return h.slice(0, 6) + "…" + h.slice(-4);
}

export const STATUS: Record<number, { label: string; cls: string }> = {
  0: { label: "ACTIVE",      cls: "badge-active"     },
  1: { label: "CHALLENGED",  cls: "badge-challenged"  },
  2: { label: "REMOVED",     cls: "badge-removed"     },
  3: { label: "VINDICATED",  cls: "badge-vindicated"  },
};
