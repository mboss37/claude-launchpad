import { useStdout } from 'ink';
import { useState, useEffect } from 'react';

export interface TerminalSize {
  readonly columns: number;
  readonly rows: number;
}

export type LayoutMode = 'wide' | 'medium' | 'narrow';

export function useTerminalSize(): TerminalSize & { layout: LayoutMode } {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>({
    columns: stdout.columns ?? 80,
    rows: stdout.rows ?? 24,
  });

  useEffect(() => {
    const handler = () => setSize({ columns: stdout.columns, rows: stdout.rows });
    stdout.on('resize', handler);
    return () => { stdout.off('resize', handler); };
  }, [stdout]);

  const layout: LayoutMode =
    size.columns >= 120 ? 'wide' :
    size.columns >= 80 ? 'medium' : 'narrow';

  return { ...size, layout };
}
