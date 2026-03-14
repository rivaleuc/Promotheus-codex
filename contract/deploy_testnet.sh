#!/bin/bash
# ============================================================
#   PROMETHEUS — Deploy to Aptos Testnet
#   Run this script from the /contract directory
# ============================================================

set -e
set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APTOS_RPC="${APTOS_RPC:-https://api.testnet.aptoslabs.com/v1}"
APTOS_FAUCET="${APTOS_FAUCET:-https://faucet.testnet.aptoslabs.com}"
FUND_AMOUNT="${FUND_AMOUNT:-200000000}"
SKIP_FAUCET="${SKIP_FAUCET:-0}"
SKIP_FETCH_LATEST="${SKIP_FETCH_LATEST:-1}"

echo -e "${CYAN}"
echo "  ██████╗ ██████╗  ██████╗ ███╗   ███╗███████╗████████╗██╗  ██╗███████╗██╗   ██╗███████╗"
echo "  ██╔══██╗██╔══██╗██╔═══██╗████╗ ████║██╔════╝╚══██╔══╝██║  ██║██╔════╝██║   ██║██╔════╝"
echo "  ██████╔╝██████╔╝██║   ██║██╔████╔██║█████╗     ██║   ███████║█████╗  ██║   ██║███████╗"
echo "  ██╔═══╝ ██╔══██╗██║   ██║██║╚██╔╝██║██╔══╝     ██║   ██╔══██║██╔══╝  ██║   ██║╚════██║"
echo "  ██║     ██║  ██║╚██████╔╝██║ ╚═╝ ██║███████╗   ██║   ██║  ██║███████╗╚██████╔╝███████║"
echo "  ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚══════╝"
echo -e "${NC}"
echo -e "  Deploy to ${YELLOW}aptos testnet${NC}\n"

# ─── Step 0: Check aptos CLI ──────────────────────────────
echo -e "${YELLOW}[0/5] Checking aptos CLI...${NC}"
if ! command -v aptos &> /dev/null; then
    echo -e "${RED}  ✘ aptos CLI not found${NC}"
    echo ""
    echo "  Install it:"
    echo "  curl -fsSL https://aptos.dev/scripts/install_cli.py | python3"
    echo ""
    exit 1
fi
APTOS_VERSION=$(aptos --version 2>&1 | head -1)
echo -e "  ${GREEN}✔ $APTOS_VERSION${NC}"

# ─── Step 1: Init / load account ─────────────────────────
echo -e "\n${YELLOW}[1/5] Loading account...${NC}"
if [ ! -f ".aptos/config.yaml" ]; then
    echo "  No config found — initializing account on testnet..."
    aptos init \
        --network custom \
        --rest-url "$APTOS_RPC" \
        --faucet-url "$APTOS_FAUCET" \
        --assume-yes
fi

# Extract address
ADDRESS=$(aptos account lookup-address 2>/dev/null | grep -Eo '0x[0-9a-f]+' | head -1)
if [ -z "$ADDRESS" ]; then
    ADDRESS=$(awk '/account:/{print $2; exit}' .aptos/config.yaml | tr -d '"')
    if [[ -n "$ADDRESS" && "$ADDRESS" != 0x* ]]; then
        ADDRESS="0x$ADDRESS"
    fi
fi

if [ -z "$ADDRESS" ]; then
    echo -e "${RED}  ✘ Could not determine account address${NC}"
    echo "  Check .aptos/config.yaml or run aptos init again."
    exit 1
fi

echo -e "  ${GREEN}✔ Address: $ADDRESS${NC}"

# ─── Step 2: Fund account ─────────────────────────────────
if [ "$SKIP_FAUCET" = "1" ]; then
    echo -e "\n${YELLOW}[2/5] Skipping faucet funding (SKIP_FAUCET=1)${NC}"
else
    echo -e "\n${YELLOW}[2/5] Funding account (testnet faucet)...${NC}"
    if [ -z "$APTOS_FAUCET" ]; then
        echo -e "${RED}  ✘ APTOS_FAUCET not set${NC}"
        exit 1
    fi
    aptos account fund-with-faucet \
        --account "$ADDRESS" \
        --faucet-url "$APTOS_FAUCET" \
        --url "$APTOS_RPC" \
        --amount "$FUND_AMOUNT" 2>&1 | tail -2
fi

BALANCE=$(aptos account balance --account "$ADDRESS" --url "$APTOS_RPC" 2>/dev/null | grep -Eo '[0-9]+' | head -1)
echo -e "  ${GREEN}✔ Balance: $BALANCE octas${NC}"

# ─── Step 3: Compile ──────────────────────────────────────
echo -e "\n${YELLOW}[3/5] Compiling contracts...${NC}"
if [ "$SKIP_FETCH_LATEST" = "1" ]; then
    aptos move compile \
        --named-addresses prometheus="$ADDRESS" \
        --save-metadata \
        --skip-fetch-latest-git-deps
else
    aptos move compile \
        --named-addresses prometheus="$ADDRESS" \
        --save-metadata
fi

echo -e "  ${GREEN}✔ Compiled successfully${NC}"

# ─── Step 4: Publish ──────────────────────────────────────
echo -e "\n${YELLOW}[4/5] Publishing to testnet...${NC}"
if [ "$SKIP_FETCH_LATEST" = "1" ]; then
    aptos move publish \
        --named-addresses prometheus="$ADDRESS" \
        --url "$APTOS_RPC" \
        --assume-yes \
        --skip-fetch-latest-git-deps 2>&1 | tail -5
else
    aptos move publish \
        --named-addresses prometheus="$ADDRESS" \
        --url "$APTOS_RPC" \
        --assume-yes 2>&1 | tail -5
fi

echo -e "  ${GREEN}✔ Published!${NC}"

# ─── Step 5: Initialize ───────────────────────────────────
echo -e "\n${YELLOW}[5/5] Initializing PROMETHEUS...${NC}"
if [ "$SKIP_FETCH_LATEST" = "1" ]; then
    aptos move run \
        --function-id "${ADDRESS}::prometheus::initialize" \
        --url "$APTOS_RPC" \
        --assume-yes \
        --skip-fetch-latest-git-deps 2>&1 | tail -3
else
    aptos move run \
        --function-id "${ADDRESS}::prometheus::initialize" \
        --url "$APTOS_RPC" \
        --assume-yes 2>&1 | tail -3
fi

echo -e "  ${GREEN}✔ Initialized!${NC}"

# ─── Summary ──────────────────────────────────────────────
echo ""
echo -e "${GREEN}  ✅ PROMETHEUS deployed successfully!${NC}"
echo ""
echo -e "  ${CYAN}Contract address:${NC} $ADDRESS"
echo -e "  ${CYAN}Explorer:${NC}        https://explorer.aptoslabs.com/account/$ADDRESS?network=testnet"
echo ""
echo "  Save this address — you need it for the backend .env:"
echo ""
echo "  PROMETHEUS_CONTRACT=$ADDRESS"
echo ""

# Save address to file
echo "PROMETHEUS_CONTRACT=$ADDRESS" > .deployed
echo "DEPLOY_NETWORK=testnet" >> .deployed
echo "DEPLOY_RPC=$APTOS_RPC" >> .deployed
echo -e "  ${CYAN}Saved to .deployed${NC}\n"
