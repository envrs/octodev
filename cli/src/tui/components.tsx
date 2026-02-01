/**
 * Ink TUI Components
 */

import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { TUIMessage } from "@/types";

interface ChatDisplayProps {
  messages: TUIMessage[];
}

export const ChatDisplay: React.FC<ChatDisplayProps> = ({ messages }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {messages.length === 0 ? (
        <Text dimColor>No messages yet. Start typing to begin...</Text>
      ) : (
        messages.map((msg) => (
          <Box key={msg.id} flexDirection="column" marginBottom={1}>
            <Text bold color={msg.type === "user" ? "cyan" : msg.type === "error" ? "red" : "green"}>
              {msg.type === "user" ? "You" : msg.type === "error" ? "Error" : msg.type === "system" ? "System" : "Assistant"}
            </Text>
            <Text>{msg.content}</Text>
          </Box>
        ))
      )}
    </Box>
  );
};

interface InputHandlerProps {
  onSubmit: (input: string) => void;
  isWaiting?: boolean;
}

export const InputHandler: React.FC<InputHandlerProps> = ({ onSubmit, isWaiting = false }) => {
  const [input, setInput] = useState("");

  useEffect(() => {
    if (isWaiting) return;

    const handleInput = (ch: string, key: any) => {
      if (key.return) {
        onSubmit(input);
        setInput("");
      } else if (key.backspace) {
        setInput(input.slice(0, -1));
      } else if (ch) {
        setInput(input + ch);
      }
    };

    process.stdin.on("data", handleInput);
    return () => {
      process.stdin.off("data", handleInput);
    };
  }, [input, isWaiting, onSubmit]);

  return (
    <Box marginTop={1}>
      <Text bold color="blue">
        {">> "}
      </Text>
      <Text>{input}</Text>
    </Box>
  );
};

interface SidebarProps {
  profile: string;
  activeTool?: string;
  isConnected: boolean;
  aiConnected?: boolean;
  sessionTokens?: number;
  sessionCost?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  profile,
  activeTool,
  isConnected,
  aiConnected = false,
  sessionTokens = 0,
  sessionCost = 0,
}) => {
  return (
    <Box flexDirection="column" width={30} marginRight={2}>
      <Box marginBottom={1}>
        <Text bold underline color="cyan">
          Profile
        </Text>
      </Box>
      <Text>{profile}</Text>

      <Box marginTop={2} marginBottom={1}>
        <Text bold underline color="cyan">
          Connection
        </Text>
      </Box>
      <Box flexDirection="column">
        <Box>
          <Text color={isConnected ? "green" : "red"}>
            {isConnected ? "✓" : "✗"}
          </Text>
          <Text marginLeft={1}>{isConnected ? "Connected" : "Offline"}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={aiConnected ? "green" : "yellow"}>
            {aiConnected ? "✓" : "✗"}
          </Text>
          <Text marginLeft={1}>{aiConnected ? "AI Ready" : "AI Offline"}</Text>
        </Box>
      </Box>

      <Box marginTop={2} marginBottom={1}>
        <Text bold underline color="cyan">
          Active Tool
        </Text>
      </Box>
      <Text>{activeTool || "None"}</Text>

      {aiConnected && (
        <>
          <Box marginTop={2} marginBottom={1}>
            <Text bold underline color="magenta">
              Session Stats
            </Text>
          </Box>
          <Box flexDirection="column">
            <Text dimColor>Tokens: {sessionTokens}</Text>
            <Text dimColor marginTop={1}>Cost: ${sessionCost.toFixed(4)}</Text>
          </Box>
        </>
      )}
    </Box>
  );
};

interface StatusBarProps {
  connectionStatus: boolean;
  mode: string;
  aiConnected?: boolean;
  isStreaming?: boolean;
  lastCommand?: string;
  executionTime?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  connectionStatus,
  mode,
  aiConnected = false,
  isStreaming = false,
  lastCommand,
  executionTime = 0,
}) => {
  return (
    <Box marginTop={1} paddingTop={1} borderStyle="single" borderTop>
      <Box flexDirection="column" width="100%">
        <Box>
          <Text bold dimColor>
            [{connectionStatus ? "✓" : "✗"} Connected]
          </Text>
          <Text dimColor marginLeft={2}>
            [AI: {aiConnected ? "✓" : "✗"}]
          </Text>
          <Text dimColor marginLeft={2}>
            Mode: {mode}
          </Text>
          {isStreaming && (
            <Text color="cyan" marginLeft={2}>
              [Streaming...]
            </Text>
          )}
        </Box>
        {lastCommand && (
          <Box marginTop={1}>
            <Text dimColor>
              Last: {lastCommand}
              {executionTime > 0 && ` (${executionTime}ms)`}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "Loading" }) => {
  return (
    <Box>
      <Text color="cyan">
        <Spinner type="dots" />
      </Text>
      <Text marginLeft={1}>{message}</Text>
    </Box>
  );
};

interface ErrorMessageProps {
  message: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  return (
    <Box borderStyle="round" borderColor="red" padding={1} marginBottom={1}>
      <Text color="red" bold>
        Error: {message}
      </Text>
    </Box>
  );
};
