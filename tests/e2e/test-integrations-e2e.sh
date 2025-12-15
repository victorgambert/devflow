#!/bin/bash

# DevFlow End-to-End Integration Tests
# Tests the complete OAuth + integration workflow using CLI commands
#
# Usage: ./test-integrations-e2e.sh <project-id>

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${1:-""}
API_URL=${DEVFLOW_API_URL:-"http://localhost:3000/api/v1"}

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}❌ Project ID required${NC}"
  echo "Usage: $0 <project-id>"
  exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 DevFlow End-to-End Integration Tests${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${GREEN}Project ID:${NC} $PROJECT_ID"
echo -e "${GREEN}API URL:${NC} $API_URL\n"

# Check if devflow CLI is available
if ! command -v devflow &> /dev/null; then
  echo -e "${RED}❌ devflow CLI not found${NC}"
  echo "Please build and link the CLI first:"
  echo "  cd packages/cli"
  echo "  pnpm build"
  echo "  pnpm link --global"
  exit 1
fi

# Check if API is running
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. Checking API connectivity...${NC}\n"

if curl -s "$API_URL/health" > /dev/null; then
  echo -e "${GREEN}✅ API is reachable${NC}\n"
else
  echo -e "${RED}❌ API is not reachable at $API_URL${NC}"
  echo "Please start the API first:"
  echo "  cd packages/api"
  echo "  pnpm dev"
  exit 1
fi

# Test: Show project details
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. Fetching project details...${NC}\n"

if devflow project:show "$PROJECT_ID"; then
  echo -e "\n${GREEN}✅ Project exists${NC}\n"
else
  echo -e "\n${RED}❌ Project not found${NC}"
  echo "Please create the project first:"
  echo "  devflow project:create"
  exit 1
fi

# Test: Check OAuth connection status
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. Checking OAuth connection status...${NC}\n"

devflow oauth:status "$PROJECT_ID" || echo -e "${YELLOW}⚠️  Some OAuth connections may not be configured${NC}"
echo ""

# Test: Show integration configuration
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. Showing integration configuration...${NC}\n"

devflow integrations:show "$PROJECT_ID" || echo -e "${YELLOW}⚠️  Integrations may not be configured${NC}"
echo ""

# Test: Test all integrations
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5. Testing all integrations...${NC}\n"

TEST_RESULT=0
devflow integrations:test "$PROJECT_ID" || TEST_RESULT=$?

echo ""

# Test: Test individual integrations
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}6. Testing individual integrations...${NC}\n"

# Test GitHub
echo -e "${BLUE}6.1. Testing GitHub...${NC}\n"
devflow integrations:test "$PROJECT_ID" --provider github || echo -e "${YELLOW}⚠️  GitHub test failed${NC}"
echo ""

# Test Linear
echo -e "${BLUE}6.2. Testing Linear...${NC}\n"
devflow integrations:test "$PROJECT_ID" --provider linear || echo -e "${YELLOW}⚠️  Linear test failed${NC}"
echo ""

# Test Figma
echo -e "${BLUE}6.3. Testing Figma...${NC}\n"
devflow integrations:test "$PROJECT_ID" --provider figma || echo -e "${YELLOW}⚠️  Figma test failed${NC}"
echo ""

# Test Sentry
echo -e "${BLUE}6.4. Testing Sentry...${NC}\n"
devflow integrations:test "$PROJECT_ID" --provider sentry || echo -e "${YELLOW}⚠️  Sentry test failed${NC}"
echo ""

# Summary
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Test Summary${NC}\n"

if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ All configured integrations are working!${NC}\n"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some integrations have issues. See logs above for details.${NC}\n"

  echo -e "${BLUE}💡 Next Steps:${NC}\n"
  echo "  1. Register OAuth apps (if not done):"
  echo "     devflow oauth:register"
  echo ""
  echo "  2. Connect OAuth providers:"
  echo "     devflow oauth:connect $PROJECT_ID github"
  echo "     devflow oauth:connect $PROJECT_ID linear"
  echo "     devflow oauth:connect $PROJECT_ID figma"
  echo "     devflow oauth:connect $PROJECT_ID sentry"
  echo ""
  echo "  3. Configure integrations:"
  echo "     devflow integrations:configure $PROJECT_ID"
  echo ""
  echo "  4. Setup Linear custom fields:"
  echo "     devflow integrations:setup-linear $PROJECT_ID"
  echo ""

  exit $TEST_RESULT
fi
