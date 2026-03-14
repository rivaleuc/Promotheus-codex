# PROMETHEUS — Smart Contract

Move smart contract deployed on **Aptos shelbynet**.

## Modules

| Module | Responsibility |
|---|---|
| `document.move` | Publish docs, guardian registry, read tracking |
| `challenge.move` | Open disputes, vote, permissionless resolution |
| `guardian.move` | Per-guardian positions, reward accrual |
| `treasury.move` | APT stake/reward/slash flows |
| `prometheus.move` | Entry point — wires all modules |

## Deploy to shelbynet

```bash
# Install Aptos CLI
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3

# Init account on shelbynet
aptos init --network custom \
  --rest-url https://api.shelbynet.shelby.xyz/v1 \
  --faucet-url https://faucet.shelbynet.shelby.xyz

# Compile
aptos move compile --named-addresses prometheus=<YOUR_ADDRESS>

# Deploy
aptos move publish \
  --named-addresses prometheus=<YOUR_ADDRESS> \
  --url https://api.shelbynet.shelby.xyz/v1

# Initialize (one-time)
aptos move run \
  --function-id <YOUR_ADDRESS>::prometheus::initialize \
  --url https://api.shelbynet.shelby.xyz/v1
```

## Publish a document

```bash
aptos move run \
  --function-id <YOUR_ADDRESS>::prometheus::publish_document \
  --args \
    address:<YOUR_ADDRESS> \
    string:"0xSHELBY_ACCOUNT" \
    string:"prometheus/2024-doc.pdf" \
    string:"My Title" \
    string:"Description here" \
    string:"sha256hashhere" \
    u64:10000000 \
  --url https://api.shelbynet.shelby.xyz/v1
```

## Become guardian

```bash
aptos move run \
  --function-id <YOUR_ADDRESS>::document::become_guardian \
  --args \
    address:<YOUR_ADDRESS> \
    u64:1 \
    u64:5000000 \
  --url https://api.shelbynet.shelby.xyz/v1
```

## Open challenge

```bash
aptos move run \
  --function-id <YOUR_ADDRESS>::challenge::open_challenge \
  --args \
    address:<YOUR_ADDRESS> \
    u64:1 \
    u64:20000000 \
    string:"This document is fabricated" \
  --url https://api.shelbynet.shelby.xyz/v1
```

## Vote on challenge

```bash
# true = doc is real, false = doc is fake
aptos move run \
  --function-id <YOUR_ADDRESS>::challenge::vote \
  --args \
    address:<YOUR_ADDRESS> \
    u64:1 \
    u64:1000000 \
    bool:true \
  --url https://api.shelbynet.shelby.xyz/v1
```

## Resolve (after 72h deadline)

```bash
aptos move run \
  --function-id <YOUR_ADDRESS>::challenge::resolve \
  --args address:<YOUR_ADDRESS> u64:1 \
  --url https://api.shelbynet.shelby.xyz/v1
```

## Economics

| Action | Cost |
|---|---|
| Publish doc | min 0.1 APT stake |
| Become guardian | min 0.05 APT stake |
| Open challenge | min 0.2 APT stake |
| Vote | min 0.01 APT stake |
| Read fee (server pays) | 0.001 APT → guardians |

## Document lifecycle

```
ACTIVE → challenge opened → CHALLENGED
       → challenge resolved (doc wins) → VINDICATED
       → challenge resolved (fake wins) → REMOVED
```
