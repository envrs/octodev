/**
 * Welcome Screen Component
 */

import React from "react";
import { Box, Text } from "ink";

export const WelcomeScreen: React.FC = () => {
  return (
    <Box flexDirection="column" marginBottom={2}>
      <Box marginBottom={1}>
        <Text bold color="cyan" fontSize="large">
          {'  ___   ___ _____ ___   ___  ___ ___  '}
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {'  / _ \\ / _ \\_   _/ _ \\ |   \\| __|| __|'}
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {'  \\___/\\___/ |_| \\___/ |_|_/|__ ||__ '}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>AI-powered development tool</Text>
      </Box>

      <Box marginBottom={1} borderStyle="single" borderColor="green" padding={1}>
        <Box flexDirection="column">
          <Text bold>Type "help" to get started</Text>
          <Text dimColor>Use arrow keys to navigate, Enter to submit</Text>
        </Box>
      </Box>
    </Box>
  );
};
