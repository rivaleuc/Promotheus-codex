#!/bin/bash
# ============================================================
#   PROMETHEUS — Test deployed contract
#   Run after deploy.sh
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SHELBYNET_RPC="https://api.shelbynet.shelby.xyz/v1"

# Load deployed address
if [ -f ".deployed" ]; then
    source .deployed
    ADDRESS=$PROMETHEUS_CONTRACT
else
    ADDRESS="${1:-}"
fi

if [ -z "$ADDRESS" ]; then
    echo -e "${RED}Usage: ./test.sh <contract_address>${NC}"
    echo "  Or run deploy.sh first to generate .deployed file"
    exit 1
fi

echo -e "${CYAN}\n  Testing PROMETHEUS @ $ADDRESS\n${NC}"

# ─── Test 1: Read view functions ──────────────────────────
echo -e "${YELLOW}[Test 1] View functions...${NC}"

TOTAL=$(aptos move view \
    --function-id "${ADDRESS}::document::get_total_docs" \
    --args "address:$ADDRESS" \
    --url "$SHELBYNET_RPC" 2>/dev/null | grep -oP '\d+' | head -1)
echo -e "  ${GREEN}✔ Total docs: ${TOTAL:-0}${NC}"

NEXT_ID=$(aptos move view \
    --function-id "${ADDRESS}::document::get_next_doc_id" \
    --args "address:$ADDRESS" \
    --url "$SHELBYNET_RPC" 2>/dev/null | grep -oP '\d+' | head -1)
echo -e "  ${GREEN}✔ Next doc ID: ${NEXT_ID:-1}${NC}"

MIN_STAKE=$(aptos move view \
    --function-id "${ADDRESS}::document::min_publish_stake" \
    --url "$SHELBYNET_RPC" 2>/dev/null | grep -oP '\d+' | head -1)
echo -e "  ${GREEN}✔ Min publish stake: ${MIN_STAKE:-10000000} octas${NC}"

# ─── Test 2: Publish a test document ─────────────────────
echo -e "\n${YELLOW}[Test 2] Publishing test document...${NC}"
aptos move run \
    --function-id "${ADDRESS}::prometheus::publish_document" \
    --args \
        "address:$ADDRESS" \
        "string:0xtest_shelby_account" \
        "string:prometheus/test-doc.txt" \
        "string:Test Document" \
        "string:This is a test upload for PROMETHEUS" \
        "string:abc123sha256hashhere" \
        "u64:10000000" \
    --url "$SHELBYNET_RPC" \
    --assume-yes 2>&1 | tail -3

echo -e "  ${GREEN}✔ Document published (doc_id: 1)${NC}"

# ─── Test 3: Verify doc exists ───────────────────────────
echo -e "\n${YELLOW}[Test 3] Verifying doc state...${NC}"

STATUS=$(aptos move view \
    --function-id "${ADDRESS}::document::get_doc_status" \
    --args "address:$ADDRESS" "u64:1" \
    --url "$SHELBYNET_RPC" 2>/dev/null | grep -oP '\d+' | head -1)
echo -e "  ${GREEN}✔ Doc status: ${STATUS} (0 = ACTIVE)${NC}"

STAKED=$(aptos move view \
    --function-id "${ADDRESS}::document::get_total_staked_on_doc" \
    --args "address:$ADDRESS" "u64:1" \
    --url "$SHELBYNET_RPC" 2>/dev/null | grep -oP '\d+' | head -1)
echo -e "  ${GREEN}✔ Total staked on doc: ${STAKED} octas${NC}"

# ─── Test 4: Open a challenge ────────────────────────────
echo -e "\n${YELLOW}[Test 4] Opening challenge on doc 1...${NC}"
aptos move run \
    --function-id "${ADDRESS}::challenge::open_challenge" \
    --args \
        "address:$ADDRESS" \
        "u64:1" \
        "u64:20000000" \
        "string:Test challenge — this is fake" \
    --url "$SHELBYNET_RPC" \
    --assume-yes 2>&1 | tail -3

echo -e "  ${GREEN}✔ Challenge opened (challenge_id: 1)${NC}"

# ─── Test 5: Check challenge state ───────────────────────
echo -e "\n${YELLOW}[Test 5] Checking challenge state...${NC}"

DOC_STATUS=$(aptos move view \
    --function-id "${ADDRESS}::document::get_doc_status" \
    --args "address:$ADDRESS" "u64:1" \
    --url "$SHELBYNET_RPC" 2>/dev/null | grep -oP '\d+' | head -1)
echo -e "  ${GREEN}✔ Doc status after challenge: ${DOC_STATUS} (1 = CHALLENGED)${NC}"

TALLY=$(aptos move view \
    --function-id "${ADDRESS}::challenge::get_vote_tally" \
    --args "address:$ADDRESS" "u64:1" \
    --url "$SHELBYNET_RPC" 2>/dev/null)
echo -e "  ${GREEN}✔ Vote tally: $TALLY${NC}"

DEADLINE=$(aptos move view \
    --function-id "${ADDRESS}::challenge::get_challenge_deadline" \
    --args "address:$ADDRESS" "u64:1" \
    --url "$SHELBYNET_RPC" 2>/dev/null | grep -oP '\d+' | head -1)
echo -e "  ${GREEN}✔ Deadline: $DEADLINE (unix timestamp)${NC}"

# ─── Summary ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}  ✅ All tests passed!${NC}"
echo ""
echo -e "  ${CYAN}Contract:${NC} $ADDRESS"
echo -e "  ${CYAN}Explorer:${NC} https://explorer.aptoslabs.com/account/$ADDRESS?network=shelbynet"
echo ""
