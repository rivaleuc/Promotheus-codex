# PROMETHEUS
**Truth with teeth.**

![Architecture](assets/architecture.png)

## Problem
Every platform has a delete button. Governments, lawyers, and money know how to press it. There is no infrastructure today that can refuse.

## Solution
Prometheus makes truth costly to erase. Documents live on Shelby as uncensorable blobs. Aptos timestamps them as proof of existence. Guardians stake APT to defend authenticity. Challengers risk their stake to dispute. If you lie, you pay.

## Why Shelby
This only works because of Shelby. Paid reads fund guardians. Uncensorable blobs remove the delete button. Shelby plus Aptos creates a trustless court that can’t be leaned on. Remove Shelby and the core mechanism collapses.

## Why Web3
Web3 is not hype here. It is the only model where:
1. No company can be pressured to delete
2. No moderator decides what’s true
3. Economic skin-in-the-game replaces trust

## Modules

| Module | Responsibility |
|---|---|
| `document.move` | Publish docs, guardian registry, read tracking |
| `challenge.move` | Open disputes, vote, permissionless resolution |
| `guardian.move` | Per-guardian positions, reward accrual |
| `treasury.move` | APT stake/reward/slash flows |
| `prometheus.move` | Entry point that wires all modules |

## Lifecycle
```
ACTIVE → challenge opened → CHALLENGED
       → challenge resolved (doc wins) → VINDICATED
       → challenge resolved (fake wins) → REMOVED
```

## Economics

| Action | Cost |
|---|---|
| Publish doc | min 0.1 APT stake |
| Become guardian | min 0.05 APT stake |
| Open challenge | min 0.2 APT stake |
| Vote | min 0.01 APT stake |
| Read fee (server pays) | 0.001 APT → guardians |

## Project Structure
1. `frontend/` React UI (Vite + Tailwind)
2. `backend/` Express API + Shelby client + Aptos SDK
3. `contract/` Move modules on Aptos

## Quick Start (UI Demo)
```bash
cd frontend
VITE_DEMO=1 npm install
VITE_DEMO=1 npm run dev
```

## Backend
Set the environment variables in `backend/.env.example`, then run:
```bash
cd backend
npm install
npm run dev
```

## Contracts
See `contract/README.md` for Aptos shelbynet deployment and CLI commands.

