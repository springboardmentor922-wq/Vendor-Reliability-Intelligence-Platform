import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false,
}) => {
  const variantStyles = {
    default: 'bg-slate-800 text-slate-200 border-slate-700',
    neutral: 'bg-slate-700/50 text-slate-300 border-slate-600',
    success: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80',
    warning: 'bg-amber-950/70 text-amber-300 border-amber-800/80',
    danger: 'bg-rose-950/70 text-rose-300 border-rose-800/80',
    info: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/80',
    purple: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/80',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  const dotColors = {
    default: 'bg-slate-400',
    neutral: 'bg-slate-400',
    success: 'bg-emerald-400 animate-pulse',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400 animate-ping',
    info: 'bg-cyan-400',
    purple: 'bg-indigo-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border tracking-wide whitespace-nowrap transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};
