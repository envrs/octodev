/**
 * Main Interactive TUI Shell
 */

import React, { useEffect, useState } from "react";
import { render, Box, Text } from "ink";
import { CLIConfig } from "@/types";
import { createLogger } from "@/utils/logger";
import { useTUIStore } from "@/tui/store";
import { ChatDisplay, Sidebar, StatusBar, LoadingSpinner, InputHandler } from "@/tui/components";

const logger = createLogger("tui-shell");

interface ShellAppProps {
  config: CLIConfig;
}

const ShellApp: React.FC<ShellAppProps> = ({ config }) => {
  const store = useTUIStore();
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    // Initialize store with config
    store.setInitialized(true);
    store.setProfile(config.profile);

    // Add welcome message
    store.addMessage({
      type: "system",
      content: `Welcome to octodev-cli v0.1.0! Profile: ${config.profile} | Log Level: ${config.logLevel}`,
    });

    store.addMessage({
      type: "system",
      content: 'Type "help" for available commands or "exit" to quit.',
    });

    logger.info({ profile: config.profile }, "Shell initialized");
  }, [config, store]);

  const handleInput = (input: string) => {
    if (!input.trim()) return;

    store.addMessage({
      type: "user",
      content: input,
    });

    // Handle commands
    const command = input.toLowerCase().trim();

    if (command === "exit" || command === "quit") {
      logger.info("User exited shell");
      process.exit(0);
    }

    if (command === "help") {
      store.addMessage({
        type: "system",
        content: `Available commands:\n  help - Show this message\n  exit - Exit the shell\n  status - Show connection status\n  tools - List available tools\n  clear - Clear messages`,
      });
    } else if (command === "status") {
      store.addMessage({
        type: "system",
        content: `Status: ${store.isConnected ? "Connected" : "Offline"} | Profile: ${store.currentProfile}`,
      });
    } else if (command === "tools") {
      store.addMessage({
        type: "system",
        content: `Available tools:\n  ${(config.tools || []).join("\n  ") || "No tools configured"}`,
      });
    } else if (command === "clear") {
      store.clearMessages();
    } else {
      store.addMessage({
        type: "assistant",
        content: `[Mock Response] You said: "${input}". AI integration coming in Phase 3.`,
      });
    }
  };

  return (
    <Box flexDirection="column" width="100%">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          octodev-cli v0.1.0
        </Text>
      </Box>

      <Box>
        <Sidebar profile={store.currentProfile} activeTool={store.activeTool} isConnected={store.isConnected} />

        <Box flexDirection="column" flexGrow={1}>
          <ChatDisplay messages={store.messages} />
          {isWaiting && <LoadingSpinner message="Processing..." />}
          <InputHandler onSubmit={handleInput} isWaiting={isWaiting} />
        </Box>
      </Box>

      <StatusBar connectionStatus={store.isConnected} mode="Interactive" />
    </Box>
  );
};

export async function createTUIShell(config: CLIConfig) {
  logger.debug({ config }, "Creating TUI shell");

  return {
    start: async () => {
      const { unmount } = render(<ShellApp config={config} />);

      // Keep the app running
      return new Promise((resolve) => {
        process.on("exit", () => {
          unmount();
          resolve(undefined);
        });
      });
    },
  };
}
