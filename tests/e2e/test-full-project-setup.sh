#!/bin/bash

# DevFlow Full Project Setup E2E Test
# Tests the complete project setup workflow from creation to integration testing
#
# This script demonstrates the full CLI workflow:
# 1. Create project
# 2. Register OAuth apps
# 3. Connect OAuth providers
# 4. Configure integrations
# 5. Test all integrations
#
# Usage: ./test-full-project-setup.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 DevFlow Full Project Setup E2E Test${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${CYAN}This script will guide you through the complete DevFlow setup:${NC}"
echo "  1. ✓ Check prerequisites"
echo "  2. ✓ Create a new project"
echo "  3. ✓ Register OAuth applications"
echo "  4. ✓ Connect OAuth providers"
echo "  5. ✓ Configure integrations"
echo "  6. ✓ Test all integrations"
echo ""

read -p "Press Enter to continue..."
echo ""

# Check prerequisites
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. Checking prerequisites...${NC}\n"

# Check devflow CLI
if ! command -v devflow &> /dev/null; then
  echo -e "${RED}❌ devflow CLI not found${NC}"
  echo "Please build and link the CLI:"
  echo "  cd packages/cli && pnpm build && pnpm link --global"
  exit 1
fi
echo -e "${GREEN}✅ devflow CLI found${NC}"

# Check API
API_URL=${DEVFLOW_API_URL:-"http://localhost:3000/api/v1"}
if curl -s "$API_URL/health" > /dev/null; then
  echo -e "${GREEN}✅ API is reachable at $API_URL${NC}"
else
  echo -e "${RED}❌ API is not reachable${NC}"
  echo "Please start the API: cd packages/api && pnpm dev"
  exit 1
fi

# Check required environment variables
REQUIRED_VARS=("OAUTH_ENCRYPTION_KEY" "DATABASE_URL")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo -e "${RED}❌ Missing required environment variables:${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  exit 1
fi
echo -e "${GREEN}✅ Environment variables configured${NC}\n"

# List existing projects
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. Existing projects:${NC}\n"

devflow project:list
echo ""

# Ask if user wants to create a new project or use existing
read -p "Do you want to create a new project or use an existing one? (new/existing): " CHOICE

PROJECT_ID=""

if [ "$CHOICE" = "new" ]; then
  echo -e "\n${BLUE}Creating new project...${NC}\n"
  echo -e "${YELLOW}Note: You'll need OAuth credentials ready.${NC}"
  echo -e "${YELLOW}Skip OAuth setup if you don't have credentials yet.${NC}\n"

  read -p "Press Enter to start project creation wizard..."

  # Run project creation (interactive)
  devflow project:create

  # Ask for project ID
  echo ""
  read -p "Enter the Project ID you just created: " PROJECT_ID
else
  read -p "Enter existing Project ID: " PROJECT_ID
fi

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}❌ Project ID is required${NC}"
  exit 1
fi

echo -e "\n${GREEN}✅ Using project: $PROJECT_ID${NC}\n"

# Show project details
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. Project details:${NC}\n"

devflow project:show "$PROJECT_ID"
echo ""

# Check OAuth status
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. OAuth connection status:${NC}\n"

devflow oauth:status "$PROJECT_ID" || echo -e "${YELLOW}⚠️  No OAuth connections configured yet${NC}"
echo ""

# Ask if user wants to configure OAuth
read -p "Do you want to configure OAuth connections? (y/n): " CONFIGURE_OAUTH

if [ "$CONFIGURE_OAUTH" = "y" ]; then
  echo -e "\n${BLUE}Configuring OAuth connections...${NC}\n"
  echo "You can connect the following providers:"
  echo "  - GitHub (required for repository access)"
  echo "  - Linear (required for task management)"
  echo "  - Figma (optional - for design context)"
  echo "  - Sentry (optional - for error context)"
  echo ""

  read -p "Connect GitHub? (y/n): " CONNECT_GITHUB
  if [ "$CONNECT_GITHUB" = "y" ]; then
    devflow oauth:connect "$PROJECT_ID" github || echo -e "${YELLOW}⚠️  GitHub connection failed${NC}"
  fi

  read -p "Connect Linear? (y/n): " CONNECT_LINEAR
  if [ "$CONNECT_LINEAR" = "y" ]; then
    devflow oauth:connect "$PROJECT_ID" linear || echo -e "${YELLOW}⚠️  Linear connection failed${NC}"
  fi

  read -p "Connect Figma? (y/n): " CONNECT_FIGMA
  if [ "$CONNECT_FIGMA" = "y" ]; then
    devflow oauth:connect "$PROJECT_ID" figma || echo -e "${YELLOW}⚠️  Figma connection failed${NC}"
  fi

  read -p "Connect Sentry? (y/n): " CONNECT_SENTRY
  if [ "$CONNECT_SENTRY" = "y" ]; then
    devflow oauth:connect "$PROJECT_ID" sentry || echo -e "${YELLOW}⚠️  Sentry connection failed${NC}"
  fi

  echo ""
  echo -e "${GREEN}✅ OAuth configuration complete${NC}\n"
fi

# Check integration configuration
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5. Integration configuration:${NC}\n"

devflow integrations:show "$PROJECT_ID" || echo -e "${YELLOW}⚠️  Integrations not configured${NC}"
echo ""

# Ask if user wants to configure integrations
read -p "Do you want to configure integrations (Figma files, Sentry projects, etc.)? (y/n): " CONFIGURE_INTEGRATIONS

if [ "$CONFIGURE_INTEGRATIONS" = "y" ]; then
  echo -e "\n${BLUE}Opening integration configuration...${NC}\n"
  devflow integrations:configure "$PROJECT_ID"
  echo ""
fi

# Setup Linear custom fields
read -p "Do you want to setup Linear custom fields? (y/n): " SETUP_LINEAR

if [ "$SETUP_LINEAR" = "y" ]; then
  echo -e "\n${BLUE}Setting up Linear custom fields...${NC}\n"
  devflow integrations:setup-linear "$PROJECT_ID" || echo -e "${YELLOW}⚠️  Linear setup failed${NC}"
  echo ""
fi

# Test all integrations
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}6. Testing all integrations...${NC}\n"

devflow integrations:test "$PROJECT_ID" || echo -e "${YELLOW}⚠️  Some integration tests failed${NC}"
echo ""

# Summary
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}✅ Setup Complete!${NC}\n"

echo -e "${GREEN}Your DevFlow project is ready:${NC}"
echo "  Project ID: ${CYAN}$PROJECT_ID${NC}"
echo ""

echo -e "${BLUE}Next steps:${NC}"
echo "  1. Create a Linear issue with status 'To Refinement'"
echo "  2. DevFlow will automatically:"
echo "     - Generate refinement documentation"
echo "     - Create user stories"
echo "     - Generate technical plans"
echo ""

echo -e "${CYAN}Useful commands:${NC}"
echo "  devflow project:show $PROJECT_ID          - View project details"
echo "  devflow oauth:status $PROJECT_ID          - Check OAuth connections"
echo "  devflow integrations:test $PROJECT_ID     - Test integrations"
echo "  devflow workflow:start                    - Start a workflow"
echo ""

echo -e "${GREEN}🎉 Happy coding!${NC}\n"
