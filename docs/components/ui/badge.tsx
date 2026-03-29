import * as React from 'react';
import { cn } from '@/lib/utils';

const variantClasses = {
  default: 'bg-emerald-500/12 text-emerald-300',
  secondary: 'bg-fd-card text-fd-muted-foreground',
  outline: 'border border-fd-border bg-transparent text-fd-muted-foreground',
} as const;

type BadgeVariant = keyof typeof variantClasses;

export interface BadgeProps extends React.ComponentProps<'span'> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-wide',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
