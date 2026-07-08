import React from "react";
import { Box, Text, useApp, useInput } from "ink";

function CrashScreen({
  message,
}: {
  readonly message: string;
}): React.ReactNode {
  const { exit } = useApp();
  useInput((input) => {
    if (input === "q") exit();
  });
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      padding={1}
    >
      <Text bold color="red">
        Dashboard crashed
      </Text>
      <Text>{message}</Text>
      <Text dimColor>Your data is untouched. Press q to quit.</Text>
    </Box>
  );
}

interface Props {
  readonly children: React.ReactNode;
}
interface State {
  readonly error: Error | null;
}

/**
 * One bad render must not unmount Ink mid-raw-mode and strand the terminal.
 * Ink restores the terminal on clean exit; this keeps the exit clean.
 */
export class DashboardErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return <CrashScreen message={this.state.error.message} />;
    }
    return this.props.children;
  }
}
