#!/bin/bash

# DevFlow Integration Tests Runner
# Usage: ./run-integration-tests.sh [all|github|linear|figma|sentry]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${RED}❌ .env file not found${NC}"
  echo "Please create a .env file with required variables:"
  echo "  DATABASE_URL=postgresql://..."
  echo "  PROJECT_ID=your-project-id"
  echo "  OAUTH_ENCRYPTION_KEY=your-key"
  exit 1
fi

# Load .env
export $(cat .env | grep -v '^#' | xargs)

# Verify required variables
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL not set${NC}"
  exit 1
fi

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}❌ PROJECT_ID not set${NC}"
  exit 1
fi

if [ -z "$OAUTH_ENCRYPTION_KEY" ]; then
  echo -e "${RED}❌ OAUTH_ENCRYPTION_KEY not set${NC}"
  exit 1
fi

# Determine which test to run
TEST_TYPE=${1:-all}

echo -e "${BLUE}🧪 DevFlow Integration Tests${NC}"
echo -e "${BLUE}Project: $PROJECT_ID${NC}\n"

run_test() {
  local test_name=$1
  local test_file=$2

  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Running: $test_name${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

  if npx tsx "src/__manual_tests__/$test_file"; then
    echo -e "\n${GREEN}✅ $test_name passed${NC}\n"
    return 0
  else
    echo -e "\n${RED}❌ $test_name failed${NC}\n"
    return 1
  fi
}

# Run tests based on argument
case $TEST_TYPE in
  all)
    echo -e "${BLUE}Running all integration tests...${NC}\n"

    FAILED=0

    run_test "GitHub Integration" "test-github-integration.ts" || FAILED=$((FAILED + 1))
    run_test "Linear Integration" "test-linear-integration.ts" || FAILED=$((FAILED + 1))
    run_test "Figma Integration" "test-figma-integration.ts" || FAILED=$((FAILED + 1))
    run_test "Sentry Integration" "test-sentry-integration.ts" || FAILED=$((FAILED + 1))

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [ $FAILED -eq 0 ]; then
      echo -e "${GREEN}✅ All tests passed!${NC}"
      exit 0
    else
      echo -e "${RED}❌ $FAILED test(s) failed${NC}"
      exit 1
    fi
    ;;

  github)
    run_test "GitHub Integration" "test-github-integration.ts"
    ;;

  linear)
    run_test "Linear Integration" "test-linear-integration.ts"
    ;;

  figma)
    run_test "Figma Integration" "test-figma-integration.ts"
    ;;

  sentry)
    run_test "Sentry Integration" "test-sentry-integration.ts"
    ;;

  status)
    run_test "All Integrations Status" "test-all-integrations.ts"
    ;;

  *)
    echo -e "${RED}❌ Unknown test type: $TEST_TYPE${NC}"
    echo ""
    echo "Usage: $0 [all|github|linear|figma|sentry|status]"
    echo ""
    echo "Examples:"
    echo "  $0              # Run all tests"
    echo "  $0 all          # Run all tests"
    echo "  $0 github       # Test GitHub only"
    echo "  $0 linear       # Test Linear only"
    echo "  $0 figma        # Test Figma only"
    echo "  $0 sentry       # Test Sentry only"
    echo "  $0 status       # Check all integration statuses"
    exit 1
    ;;
esac
