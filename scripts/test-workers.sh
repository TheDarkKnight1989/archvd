#!/bin/bash
# Test Workers Script - Manual trigger for local testing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET}"

if [ -z "$CRON_SECRET" ]; then
  echo -e "${RED}Error: CRON_SECRET environment variable not set${NC}"
  echo "Set it in .env.local or export it:"
  echo "  export CRON_SECRET=your_secret_here"
  exit 1
fi

echo -e "${GREEN}=== Market & Releases Worker Test ===${NC}"
echo -e "Base URL: ${YELLOW}${BASE_URL}${NC}"
echo ""

# Function to test an endpoint
test_endpoint() {
  local name=$1
  local path=$2
  local method=${3:-GET}

  echo -e "${YELLOW}Testing ${name}...${NC}"

  response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X "$method" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    "${BASE_URL}${path}")

  http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
  body=$(echo "$response" | sed '/HTTP_STATUS/d')

  if [ "$http_status" -eq 200 ]; then
    echo -e "${GREEN}✓ Success (HTTP $http_status)${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  else
    echo -e "${RED}✗ Failed (HTTP $http_status)${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  fi

  echo ""
}

# Menu
echo "Select worker to test:"
echo "  1) Releases Worker (/api/workers/releases)"
echo "  2) Price Refresh Worker (/api/workers/prices)"
echo "  3) Test Market API (/api/market/DD1391-100)"
echo "  4) Test Releases API (/api/releases)"
echo "  5) Run All Tests"
echo "  q) Quit"
echo ""
read -p "Choice: " choice

case $choice in
  1)
    test_endpoint "Releases Worker" "/api/workers/releases" "POST"
    ;;
  2)
    test_endpoint "Price Refresh Worker" "/api/workers/prices" "POST"
    ;;
  3)
    echo -e "${YELLOW}Testing Market API (no auth required)...${NC}"
    curl -s "${BASE_URL}/api/market/DD1391-100" | jq '.'
    echo ""
    ;;
  4)
    echo -e "${YELLOW}Testing Releases API (no auth required)...${NC}"
    curl -s "${BASE_URL}/api/releases?month=2025-11&status=upcoming&limit=10" | jq '.'
    echo ""
    ;;
  5)
    test_endpoint "Releases Worker" "/api/workers/releases" "POST"
    test_endpoint "Price Refresh Worker" "/api/workers/prices" "POST"

    echo -e "${YELLOW}Testing Market API (no auth required)...${NC}"
    curl -s "${BASE_URL}/api/market/DD1391-100" | jq '.'
    echo ""

    echo -e "${YELLOW}Testing Releases API (no auth required)...${NC}"
    curl -s "${BASE_URL}/api/releases?month=2025-11&status=upcoming&limit=10" | jq '.'
    echo ""
    ;;
  q|Q)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo -e "${GREEN}=== Test Complete ===${NC}"
