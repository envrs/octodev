/**
 * Help and documentation utilities
 */

export function buildHelpText(): string {
  return `
octodev-cli - AI-powered development tool

USAGE:
  octodev [command] [options]

COMMANDS:
  shell                      Launch interactive TUI shell (default)
  help                       Show this help message
  version                    Show version number

OPTIONS:
  -h, --help                 Show help
  -v, --version              Show version
  --config <path>            Path to config file
  --profile <name>           Profile to use
  --debug                    Enable debug logging

EXAMPLES:
  octodev                    Start the interactive shell
  octodev shell              Launch the TUI shell
  octodev --version          Display version
  octodev --help             Show this help

CONFIGURATION:
  Configuration can be provided via:
    1. .octodevrc file in current directory
    2. .octodevrc.yaml or .octodevrc.yml
    3. Environment variables

PROFILES:
  Define multiple profiles in .octodevrc:
    profiles:
      development:
        projectDir: ./projects-dev
        logLevel: debug

For more information, visit: https://github.com/khulnasoft-bot/octodev
`;
}

export function buildCommandHelp(command: string): string {
  const helps: Record<string, string> = {
    shell: `
SHELL - Interactive TUI Shell

USAGE:
  octodev shell [options]

OPTIONS:
  --config <path>            Path to config file
  --profile <name>           Profile to use

DESCRIPTION:
  Launches the interactive TUI shell where you can:
  - Chat with AI assistant
  - Manage tools
  - Execute commands
  - Browse files

EXAMPLE:
  octodev shell --profile development
`,
  };

  return helps[command] || `No help available for command: ${command}`;
}
