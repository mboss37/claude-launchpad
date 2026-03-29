import { twMerge } from 'tailwind-merge';

type ClassValue = false | null | string | undefined;

export function cn(...inputs: ClassValue[]): string {
  return twMerge(inputs.filter(Boolean).join(' '));
}
