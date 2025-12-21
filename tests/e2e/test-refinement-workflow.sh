#!/bin/bash

# DevFlow End-to-End Test: Refinement Workflow
# Tests the complete workflow from Linear issue creation to refinement completion
#
# Usage:
#   ./test-refinement-workflow.sh [options]
#
# Options:
#   --cleanup     Delete the test issue after completion
#   --team-id ID  Specify Linear team ID (auto-detected if not provided)
#   --timeout N   Workflow timeout in seconds (default: 120)
#   --help        Show this help message

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Default configuration
API_URL=${DEVFLOW_API_URL:-"http://localhost:3001/api/v1"}
CLEANUP=""
TEAM_ID=""
TIMEOUT="120"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --cleanup)
      CLEANUP="--cleanup"
      shift
      ;;
    --team-id)
      TEAM_ID="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --help)
      echo "DevFlow E2E Test: Refinement Workflow"
      echo ""
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --cleanup     Delete the test issue after completion"
      echo "  --team-id ID  Specify Linear team ID (auto-detected if not provided)"
      echo "  --timeout N   Workflow timeout in seconds (default: 120)"
      echo "  --help        Show this help message"
      echo ""
      echo "Environment Variables:"
      echo "  LINEAR_API_KEY       (required) Linear API key"
      echo "  DEFAULT_PROJECT_ID   (required) DevFlow project ID"
      echo "  DEVFLOW_API_URL      API URL (default: http://localhost:3001/api/v1)"
      echo "  DATABASE_URL         Database connection string"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  DevFlow E2E Test: Refinement Workflow${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check prerequisites
echo -e "${CYAN}Checking prerequisites...${NC}"

# Check LINEAR_API_KEY
if [ -z "$LINEAR_API_KEY" ]; then
  # Try to load from .env
  if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env" 2>/dev/null || true
  fi
fi

if [ -z "$LINEAR_API_KEY" ]; then
  echo -e "${RED}❌ LINEAR_API_KEY environment variable is required${NC}"
  echo "   Export it or add it to $PROJECT_ROOT/.env"
  exit 1
fi
echo -e "${GREEN}✅ LINEAR_API_KEY is set${NC}"

# Check DEFAULT_PROJECT_ID
if [ -z "$DEFAULT_PROJECT_ID" ]; then
  # Try to load from .env
  if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env" 2>/dev/null || true
  fi
fi

if [ -z "$DEFAULT_PROJECT_ID" ]; then
  echo -e "${RED}❌ DEFAULT_PROJECT_ID environment variable is required${NC}"
  echo "   Export it or add it to $PROJECT_ROOT/.env"
  exit 1
fi
echo -e "${GREEN}✅ DEFAULT_PROJECT_ID is set ($DEFAULT_PROJECT_ID)${NC}"

# Check API health
echo -e "${CYAN}Checking API at $API_URL...${NC}"
if curl -s "$API_URL/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ API is reachable${NC}"
else
  echo -e "${RED}❌ API is not reachable at $API_URL${NC}"
  echo ""
  echo "Please start the infrastructure:"
  echo "  docker-compose up -d"
  echo ""
  echo "And start the API:"
  echo "  cd packages/api && pnpm dev"
  echo ""
  echo "And start the worker:"
  echo "  cd packages/worker && pnpm dev"
  exit 1
fi

# Check if worker is running (via Temporal)
TEMPORAL_UI=${TEMPORAL_UI:-"http://localhost:8080"}
echo -e "${CYAN}Checking Temporal at $TEMPORAL_UI...${NC}"
if curl -s "$TEMPORAL_UI" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Temporal UI is reachable${NC}"
else
  echo -e "${YELLOW}⚠️  Temporal UI not reachable at $TEMPORAL_UI (workflow monitoring may not work)${NC}"
fi

echo ""
echo -e "${BLUE}Starting test...${NC}"
echo ""

# Build test args
TEST_ARGS=""
if [ -n "$CLEANUP" ]; then
  TEST_ARGS="$TEST_ARGS --cleanup"
fi
if [ -n "$TEAM_ID" ]; then
  TEST_ARGS="$TEST_ARGS --team-id $TEAM_ID"
fi
TEST_ARGS="$TEST_ARGS --timeout $TIMEOUT"

# Run the TypeScript test
cd "$PROJECT_ROOT"

# Export environment variables for the test
export DEVFLOW_API_URL="$API_URL"
export TEST_TIMEOUT="$TIMEOUT"

npx tsx tests/e2e/test-refinement-workflow.ts $TEST_ARGS

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  ✅ Test Passed${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}  ❌ Test Failed${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

exit $EXIT_CODE
