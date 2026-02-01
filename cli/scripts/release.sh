#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}octodev-cli Release Tool${NC}"
echo "=========================="
echo ""

# Get current version
CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")
echo -e "${BLUE}Current version: ${CURRENT_VERSION}${NC}"
echo ""

# Parse arguments
RELEASE_TYPE="${1:-patch}"
if [[ ! "$RELEASE_TYPE" =~ ^(major|minor|patch)$ ]]; then
  echo -e "${RED}Invalid release type: $RELEASE_TYPE${NC}"
  echo "Usage: $0 [major|minor|patch]"
  exit 1
fi

echo -e "${YELLOW}Release type: $RELEASE_TYPE${NC}"
echo ""

# Run tests before release
echo -e "${YELLOW}Running test suite...${NC}"
npm run test:all
echo -e "${GREEN}Tests passed!${NC}"
echo ""

# Build
echo -e "${YELLOW}Building TypeScript...${NC}"
npm run build
echo -e "${GREEN}Build complete!${NC}"
echo ""

# Detect version from commit messages using conventional commits
echo -e "${YELLOW}Analyzing commit messages for version bump...${NC}"
if command -v standard-version &> /dev/null; then
  standard-version --release-as $RELEASE_TYPE --verbose
else
  echo -e "${RED}standard-version not found. Install with: npm install -g standard-version${NC}"
  exit 1
fi

# Get new version
NEW_VERSION=$(node -e "console.log(require('./package.json').version)")
echo -e "${GREEN}Version bumped: ${CURRENT_VERSION} → ${NEW_VERSION}${NC}"
echo ""

# Push changes and tags
echo -e "${YELLOW}Pushing changes to remote...${NC}"
git push --follow-tags origin main
echo -e "${GREEN}Push complete!${NC}"
echo ""

echo -e "${GREEN}Release ${NEW_VERSION} is complete!${NC}"
echo ""
echo "The GitHub Actions release pipeline will automatically:"
echo "  1. Run full test suite"
echo "  2. Build binaries (Linux, macOS, Windows)"
echo "  3. Build Docker image"
echo "  4. Create GitHub Release"
echo "  5. Publish to npm (public)"
echo "  6. Publish to GitHub Packages (private)"
echo ""
echo -e "${BLUE}Track progress at:${NC}"
echo "  https://github.com/khulnasoft-bot/octodev/actions"
