# PROMETHEUS

**Truth with teeth.**

> A decentralized document authenticity protocol. No delete button. No moderator. Skin-in-the-game replaces trust.

![Architecture](assets/architecture.png)

---

## The Problem

Every platform has a delete button. Governments, lawyers, and money know how to press it. There is no infrastructure today that can refuse.

## The Solution

Prometheus makes truth costly to erase.

- Documents live on **Shelby Protocol** as uncensorable blobs
- **Aptos** timestamps them as proof of existence
- **Guardians** stake APT to defend authenticity
- **Challengers** risk their stake to dispute
- If you lie, you pay

## Why This Works

| Property | How |
|---|---|
| No company can be pressured to delete | Shelby blobs are uncensorable |
| No moderator decides what's true | Economic skin-in-the-game replaces trust |
| Proof of existence | Aptos on-chain timestamp |
| Reads are free | Server-sponsored streaming, no wallet needed |

---

## Architecture

```
User
 ├── Uploads file → Backend → Shelby (blob storage)
 ├── Signs tx → Aptos (publish_document + stake APT)
 └── Registers metadata → Backend → Upstash Redis (index)

Reader
 └── Clicks READ FREE → Backend streams blob from Shelby (no wallet needed)

Guardian
 └── Stakes APT on doc → earns read fees → slashed if challenge wins

Challenger
 └── Stakes 0.2 APT → opens 72h vote → losers get slashed
```

---

## Move Modules

| Module | Responsibility |
|---|---|
| `document.move` | Publish docs, guardian registry, read tracking |
| `challenge.move` | Open disputes, vote, permissionless resolution |
| `guardian.move` | Per-guardian positions, reward accrual |
| `treasury.move` | APT stake/reward/slash flows |
| `prometheus.move` | Entry point that wires all modules |

## Document Lifecycle

```
ACTIVE → challenge opened → CHALLENGED
       → challenge resolved (doc wins)  → VINDICATED
       → challenge resolved (fake wins) → REMOVED
```

---

## Economics

| Action | Cost |
|---|---|
| Publish document | min 0.1 APT stake |
| Become guardian | min 0.05 APT stake |
| Open challenge | min 0.2 APT stake |
| Vote | min 0.01 APT stake |
| Read | Free (server-sponsored) |

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind |
| Backend | Express.js + Shelby SDK + Aptos SDK |
| Storage | Shelby Protocol (uncensorable blobs) |
| Chain | Aptos (Move contracts on Shelbynet) |
| Registry | Upstash Redis (persistent metadata index) |
| Wallet | Petra (Aptos wallet adapter) |

---

## Project Structure

```
├── frontend/          React UI (Vite + Tailwind)
├── backend/           Express API + Shelby client + Aptos SDK
├── contract/          Move modules on Aptos
└── render.yaml        Render deployment config
```

---




## Built With

- [Shelby Protocol](https://shelby.xyz) — uncensorable hot storage
- [Aptos](https://aptos.dev) — Move smart contracts
- [Upstash](https://upstash.com) — serverless Redis
- [Petra Wallet](https://petra.app) — Aptos wallet adapter
