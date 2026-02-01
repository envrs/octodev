#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${HOME}/.local/bin"
CONFIG_DIR="${HOME}/.octodev"
REPO_URL="https://github.com/khulnasoft-bot/octodev/releases/download"
VERSION="${1:-latest}"

# Detect OS and architecture
detect_platform() {
  case "$(uname -s)" in
    Linux*)     OS="linux";;
    Darwin*)    OS="macos";;
    *)          OS="unknown";;
  esac

  case "$(uname -m)" in
    x86_64)     ARCH="x64";;
    aarch64)    ARCH="arm64";;
    arm64)      ARCH="arm64";;
    *)          ARCH="x64";;
  esac

  echo "${OS}-${ARCH}"
}

PLATFORM=$(detect_platform)

echo -e "${BLUE}octodev-cli Installer${NC}"
echo "====================="
echo "Platform: $PLATFORM"
echo "Version: $VERSION"
echo "Install Directory: $INSTALL_DIR"
echo ""

# Check if already installed
if [ -f "$INSTALL_DIR/octodev" ]; then
  echo -e "${YELLOW}octodev is already installed.${NC}"
  read -p "Do you want to upgrade? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Backing up current installation..."
    cp "$INSTALL_DIR/octodev" "$INSTALL_DIR/octodev.backup.$(date +%s)"
  else
    echo "Installation cancelled."
    exit 0
  fi
fi

# Create necessary directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"

# Download binary
BINARY_NAME="octodev-${PLATFORM}"
DOWNLOAD_URL="$REPO_URL/v${VERSION}/${BINARY_NAME}"

echo -e "${YELLOW}Downloading octodev...${NC}"
if command -v curl &> /dev/null; then
  curl -L -o "$INSTALL_DIR/octodev" "$DOWNLOAD_URL"
elif command -v wget &> /dev/null; then
  wget -O "$INSTALL_DIR/octodev" "$DOWNLOAD_URL"
else
  echo -e "${RED}Error: curl or wget is required.${NC}"
  exit 1
fi

# Make executable
chmod +x "$INSTALL_DIR/octodev"

# Add to PATH if needed
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo ""
  echo -e "${YELLOW}To complete installation, add the following to your shell profile:${NC}"
  echo "export PATH=\"\$PATH:$INSTALL_DIR\""
  echo ""
  echo "Supported shell profiles:"
  echo "  - ~/.bashrc (Bash)"
  echo "  - ~/.zshrc (Zsh)"
  echo "  - ~/.config/fish/config.fish (Fish)"
fi

# Initialize configuration
if [ ! -f "$CONFIG_DIR/.octodevrc" ]; then
  echo -e "${YELLOW}Initializing configuration...${NC}"
  cat > "$CONFIG_DIR/.octodevrc" << EOF
version: '1.0'
profile: default
projectDir: $HOME/projects

execution:
  defaultTimeout: 30000

ai:
  enabled: true
  provider: openai

security:
  enableAuditLogging: true
EOF
fi

echo -e "${GREEN}Installation complete!${NC}"
echo "You can now use octodev:"
echo "  octodev --help"
echo "  octodev --version"
echo ""
echo -e "${BLUE}Configuration directory: $CONFIG_DIR${NC}"
