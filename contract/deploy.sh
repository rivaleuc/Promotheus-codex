#!/bin/bash
# ============================================================
#   PROMETHEUS — Deploy to Shelbynet
#   Run this script from the /prometheus directory
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SHELBYNET_RPC="https://api.shelbynet.shelby.xyz/v1"
SHELBYNET_FAUCET="https://faucet.shelbynet.shelby.xyz"

echo -e "${CYAN}"
echo "  ██████╗ ██████╗  ██████╗ ███╗   ███╗███████╗████████╗██╗  ██╗███████╗██╗   ██╗███████╗"
echo "  ██╔══██╗██╔══██╗██╔═══██╗████╗ ████║██╔════╝╚══██╔══╝██║  ██║██╔════╝██║   ██║██╔════╝"
echo "  ██████╔╝██████╔╝██║   ██║██╔████╔██║█████╗     ██║   ███████║█████╗  ██║   ██║███████╗"
echo "  ██╔═══╝ ██╔══██╗██║   ██║██║╚██╔╝██║██╔══╝     ██║   ██╔══██║██╔══╝  ██║   ██║╚════██║"
echo "  ██║     ██║  ██║╚██████╔╝██║ ╚═╝ ██║███████╗   ██║   ██║  ██║███████╗╚██████╔╝███████║"
echo "  ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚══════╝"
echo -e "${NC}"
echo -e "  Deploy to ${YELLOW}shelbynet${NC}\n"

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
    echo "  No config found — initializing account on shelbynet..."
    aptos init \
        --network custom \
        --rest-url "$SHELBYNET_RPC" \
        --faucet-url "$SHELBYNET_FAUCET" \
        --assume-yes
fi

# Extract address
ADDRESS=$(aptos account lookup-address 2>/dev/null | grep -oP '0x[a-f0-9]+' | head -1)
if [ -z "$ADDRESS" ]; then
    ADDRESS=$(cat .aptos/config.yaml | grep "account:" | grep -oP '0x[a-f0-9]+' | head -1)
fi

echo -e "  ${GREEN}✔ Address: $ADDRESS${NC}"

# ─── Step 2: Fund account ─────────────────────────────────
echo -e "\n${YELLOW}[2/5] Funding account (shelbynet faucet)...${NC}"
aptos account fund-with-faucet \
    --account "$ADDRESS" \
    --faucet-url "$SHELBYNET_FAUCET" \
    --url "$SHELBYNET_RPC" \
    --amount 200000000 2>&1 | tail -2

BALANCE=$(aptos account balance --account "$ADDRESS" --url "$SHELBYNET_RPC" 2>/dev/null | grep -oP '\d+' | head -1)
echo -e "  ${GREEN}✔ Balance: $BALANCE octas${NC}"

# ─── Step 3: Compile ──────────────────────────────────────
echo -e "\n${YELLOW}[3/5] Compiling contracts...${NC}"
aptos move compile \
    --named-addresses prometheus="$ADDRESS" \
    --save-metadata

echo -e "  ${GREEN}✔ Compiled successfully${NC}"

# ─── Step 4: Publish ──────────────────────────────────────
echo -e "\n${YELLOW}[4/5] Publishing to shelbynet...${NC}"
aptos move publish \
    --named-addresses prometheus="$ADDRESS" \
    --url "$SHELBYNET_RPC" \
    --assume-yes 2>&1 | tail -5

echo -e "  ${GREEN}✔ Published!${NC}"

# ─── Step 5: Initialize ───────────────────────────────────
echo -e "\n${YELLOW}[5/5] Initializing PROMETHEUS...${NC}"
aptos move run \
    --function-id "${ADDRESS}::prometheus::initialize" \
    --url "$SHELBYNET_RPC" \
    --assume-yes 2>&1 | tail -3

echo -e "  ${GREEN}✔ Initialized!${NC}"

# ─── Summary ──────────────────────────────────────────────
echo ""
echo -e "${GREEN}  ✅ PROMETHEUS deployed successfully!${NC}"
echo ""
echo -e "  ${CYAN}Contract address:${NC} $ADDRESS"
echo -e "  ${CYAN}Explorer:${NC}        https://explorer.aptoslabs.com/account/$ADDRESS?network=shelbynet"
echo ""
echo "  Save this address — you need it for the backend .env:"
echo ""
echo "  PROMETHEUS_CONTRACT=$ADDRESS"
echo ""

# Save address to file
echo "PROMETHEUS_CONTRACT=$ADDRESS" > .deployed
echo "DEPLOY_NETWORK=shelbynet" >> .deployed
echo "DEPLOY_RPC=$SHELBYNET_RPC" >> .deployed
echo -e "  ${CYAN}Saved to .deployed${NC}\n"
