/**
 * Main Interactive TUI Shell
 */

import React, { useEffect, useState } from "react";
import { render, Box, Text } from "ink";
import { CLIConfig } from "@/types";
import { createLogger } from "@/utils/logger";
import { useTUIStore } from "@/tui/store";
import { ChatDisplay, Sidebar, StatusBar, LoadingSpinner, InputHandler } from "@/tui/components";
import { getExecutorService } from "@/tui/executor-service";

const logger = createLogger("tui-shell");

interface ShellAppProps {
  config: CLIConfig;
}

const ShellApp: React.FC<ShellAppProps> = ({ config }) => {
  const store = useTUIStore();
  const [isWaiting, setIsWaiting] = useState(false);
  const [executorService] = useState(() =>
    getExecutorService({
      defaultTimeout: 30000,
      allowedPaths: [config.projectDir || process.cwd()]
    })
  );

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

  const handleInput = async (input: string) => {
    if (!input.trim()) return;

    store.addMessage({
      type: "user",
      content: input,
    });

    const command = input.toLowerCase().trim();

    // Handle exit
    if (command === "exit" || command === "quit") {
      logger.info("User exited shell");
      process.exit(0);
    }

    // Check for built-in commands first
    const builtIn = await executorService.handleBuiltInCommand(input, store.sessionId);
    if (builtIn.handled) {
      if (command !== "clear") {
        store.addMessage({
          type: "system",
          content: builtIn.output || "",
        });
      } else {
        store.clearMessages();
      }
      return;
    }

    // Execute tool command
    setIsWaiting(true);
    try {
      const result = await executorService.executeCommand(
        input,
        store.sessionId,
        config.projectDir || process.cwd()
      );

      if (result.success) {
        store.addMessage({
          type: "assistant",
          content: result.output || "(No output)",
        });

        if (result.truncated) {
          store.addMessage({
            type: "system",
            content: "[Output truncated - exceeds size limit]",
          });
        }
      } else {
        store.addMessage({
          type: "error",
          content: `Error: ${result.error}${result.suggestion ? `\n\nSuggestion: ${result.suggestion}` : ""}`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.addMessage({
        type: "error",
        content: `Failed to execute command: ${message}`,
      });
      logger.error({ error: message }, "Command execution error");
    } finally {
      setIsWaiting(false);
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
