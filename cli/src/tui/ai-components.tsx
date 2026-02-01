/**
 * AI-Powered TUI Components
 * Suggestion cards, streaming indicators, and AI status displays
 */

import React from "react";
import { Box, Text } from "ink";
import { Suggestion } from "@/ai/suggestion-engine";

/**
 * Suggestion Card Component
 * Displays a single AI suggestion with confidence score
 */
interface SuggestionCardProps {
  suggestion: Suggestion;
  index: number;
  isSelected?: boolean;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  index,
  isSelected = false,
}) => {
  const confidenceBar = "█".repeat(Math.ceil(suggestion.confidence / 10)) +
                       "░".repeat(10 - Math.ceil(suggestion.confidence / 10));

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      paddingX={2}
      borderStyle="round"
      borderColor={isSelected ? "cyan" : "gray"}
    >
      <Box marginBottom={1}>
        <Text bold color={isSelected ? "cyan" : "white"}>
          {index + 1}. {suggestion.command}
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>{suggestion.description}</Text>
      </Box>
      <Box>
        <Text color="yellow">{confidenceBar}</Text>
        <Text dimColor marginLeft={1}>{suggestion.confidence}%</Text>
      </Box>
    </Box>
  );
};

/**
 * Suggestions Display Component
 * Shows up to 3 suggestions with selection indicator
 */
interface SuggestionsDisplayProps {
  suggestions: Suggestion[];
  selectedIndex?: number;
}

export const SuggestionsDisplay: React.FC<SuggestionsDisplayProps> = ({
  suggestions,
  selectedIndex,
}) => {
  if (suggestions.length === 0) {
    return <Text dimColor>No suggestions available</Text>;
  }

  return (
    <Box flexDirection="column" marginBottom={2}>
      <Text bold color="magenta">
        Suggestions:
      </Text>
      {suggestions.slice(0, 3).map((suggestion, index) => (
        <SuggestionCard
          key={`${suggestion.command}-${index}`}
          suggestion={suggestion}
          index={index}
          isSelected={selectedIndex === index}
        />
      ))}
    </Box>
  );
};

/**
 * Streaming Indicator Component
 * Shows while AI response is streaming
 */
interface StreamingIndicatorProps {
  totalTokens?: number;
  estimatedCost?: number;
}

export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({
  totalTokens = 0,
  estimatedCost = 0,
}) => {
  const dots = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const [dotIndex, setDotIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % dots.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="cyan">{dots[dotIndex]}</Text>
        <Text marginLeft={1}>Streaming response...</Text>
      </Box>
      {totalTokens > 0 && (
        <Box marginTop={1} marginLeft={2}>
          <Text dimColor>
            Tokens: {totalTokens}
            {estimatedCost > 0 && ` | Est. Cost: $${estimatedCost.toFixed(4)}`}
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * AI Status Component
 * Shows AI provider status in sidebar
 */
interface AIStatusProps {
  provider?: string;
  isConnected: boolean;
  tokensUsed: number;
  sessionCost: number;
}

export const AIStatus: React.FC<AIStatusProps> = ({
  provider = "openai",
  isConnected,
  tokensUsed,
  sessionCost,
}) => {
  return (
    <Box flexDirection="column" marginBottom={2}>
      <Text bold color="magenta">
        AI Status
      </Text>
      <Box marginTop={1}>
        <Text color={isConnected ? "green" : "red"}>
          {isConnected ? "✓" : "✗"}
        </Text>
        <Text marginLeft={1}>
          {isConnected ? "Connected" : "Offline"} ({provider})
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Tokens: {tokensUsed}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Cost: ${sessionCost.toFixed(4)}</Text>
      </Box>
    </Box>
  );
};

/**
 * Macro Suggestion Component
 * Prompts user when repeated sequences detected
 */
interface MacroSuggestionProps {
  sequenceName: string;
  count: number;
}

export const MacroSuggestion: React.FC<MacroSuggestionProps> = ({
  sequenceName,
  count,
}) => {
  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      paddingX={2}
      borderStyle="round"
      borderColor="yellow"
    >
      <Text bold color="yellow">
        Pattern Detected
      </Text>
      <Text marginTop={1}>
        Repeated command sequence "{sequenceName}" {count} times.
      </Text>
      <Text dimColor marginTop={1}>
        Save as macro? Use: /macro save {sequenceName}
      </Text>
    </Box>
  );
};
