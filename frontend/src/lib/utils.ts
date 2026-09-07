import { clsx, type ClassValue } from 'clsx'

/**
 * Merge conditional class names. Kept as a thin wrapper around clsx so we
 * have one place to swap in tailwind-merge later if class conflicts appear.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
