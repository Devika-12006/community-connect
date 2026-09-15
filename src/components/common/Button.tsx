import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[32px]',
    md: 'text-sm px-4 py-2 gap-2 min-h-[40px]',
    lg: 'text-base px-5 py-2.5 gap-2.5 min-h-[48px]',
  }[size];

  const variantClasses = {
    primary:
      'bg-[#166534] hover:bg-[#14532D] text-white focus-visible:outline-[#166534] shadow-sm',
    secondary:
      'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 focus-visible:outline-[#166534]',
    outline:
      'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 focus-visible:outline-[#166534] shadow-xs',
    danger:
      'bg-red-600 hover:bg-red-700 text-white focus-visible:outline-red-600 shadow-sm',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-700 focus-visible:outline-[#166534]',
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
