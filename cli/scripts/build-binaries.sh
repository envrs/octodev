#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building octodev-cli standalone binaries...${NC}"

# Ensure dist directory exists
if [ ! -d "dist" ]; then
  echo "Building TypeScript..."
  npm run build
fi

# Build binaries with pkg
echo -e "${YELLOW}Creating standalone executables...${NC}"
mkdir -p dist/bin

targets=(
  "node18-linux-x64"
  "node18-macos-x64"
  "node18-macos-arm64"
  "node18-win-x64"
)

for target in "${targets[@]}"; do
  echo "Building for $target..."
  npx pkg \
    --compress Brotli \
    --target "$target" \
    --output "dist/bin/octodev-${target#node18-}" \
    dist/index.js
done

# Set executable permissions on Unix binaries
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
  chmod +x dist/bin/octodev-*
fi

echo -e "${GREEN}Build complete!${NC}"
echo "Binaries created in dist/bin/"
ls -lh dist/bin/
