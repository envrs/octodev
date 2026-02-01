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
}

export const Sidebar: React.FC<SidebarProps> = ({ profile, activeTool, isConnected }) => {
  return (
    <Box flexDirection="column" width={25} marginRight={2}>
      <Box marginBottom={1}>
        <Text bold underline>
          Profile
        </Text>
      </Box>
      <Text>{profile}</Text>

      <Box marginTop={2} marginBottom={1}>
        <Text bold underline>
          Status
        </Text>
      </Box>
      <Text color={isConnected ? "green" : "red"}>{isConnected ? "✓ Connected" : "✗ Offline"}</Text>

      <Box marginTop={2} marginBottom={1}>
        <Text bold underline>
          Active Tool
        </Text>
      </Box>
      <Text>{activeTool || "None"}</Text>
    </Box>
  );
};

interface StatusBarProps {
  connectionStatus: boolean;
  mode: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ connectionStatus, mode }) => {
  return (
    <Box marginTop={1} paddingTop={1} borderStyle="single" borderTop>
      <Text bold dimColor>
        [{connectionStatus ? "Connected" : "Offline"}] | Mode: {mode}
      </Text>
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
