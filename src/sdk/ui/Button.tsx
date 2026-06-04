import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[linear-gradient(135deg,var(--game-accent),var(--game-accent-strong))] text-[var(--on-accent)] shadow-[0_10px_26px_-8px_var(--game-accent-glow),inset_0_1px_0_rgb(255_255_255/0.4)]',
  secondary: 'bg-[var(--surface-2)] text-[var(--text)] shadow-[inset_0_0_0_1.5px_var(--border-glow)]',
  ghost: 'bg-transparent text-[var(--game-accent)]',
  danger:
    'bg-[linear-gradient(135deg,var(--color-game-rose),var(--color-game-rose-strong))] text-white shadow-[0_10px_26px_-8px_color-mix(in_oklab,var(--color-game-rose)_60%,transparent)]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-12 px-5 text-base',
  lg: 'h-14 px-6 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-pill)] font-bold',
        'transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    />
  );
}
