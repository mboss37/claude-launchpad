import * as React from 'react';
import { cn } from '@/lib/utils';

const variantClasses = {
  default: 'bg-fd-foreground text-fd-background hover:opacity-90',
  outline: 'border border-fd-border bg-fd-card text-fd-foreground hover:bg-fd-accent/60',
  ghost: 'text-fd-muted-foreground hover:bg-fd-card hover:text-fd-foreground',
} as const;

const sizeClasses = {
  default: 'h-10 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-11 px-6 text-sm',
  icon: 'h-9 w-9',
} as const;

type ButtonVariant = keyof typeof variantClasses;
type ButtonSize = keyof typeof sizeClasses;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function buttonVariants({
  className,
  size = 'default',
  variant = 'default',
}: {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
} = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = 'default', type = 'button', variant = 'default', ...props }, ref) => {
    return <button ref={ref} type={type} className={buttonVariants({ className, size, variant })} {...props} />;
  },
);

Button.displayName = 'Button';
