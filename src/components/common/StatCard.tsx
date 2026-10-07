import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  id?: string;
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  badge?: string;
  badgeVariant?: 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  id,
  title,
  value,
  change,
  isPositive,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-400',
  iconBg = 'bg-blue-500/10 border-blue-500/20',
  badge,
  badgeVariant = 'info',
  onClick,
}) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur transition-all duration-200 hover:border-slate-700/80 ${
        onClick ? 'cursor-pointer hover:bg-slate-800/60' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white font-mono">
              {value}
            </span>
            {change && (
              <span
                className={`text-xs font-medium ${
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isPositive ? '↑' : '↓'} {change}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 pt-0.5">{subtitle}</p>
          )}
        </div>
        <div
          className={`rounded-lg border p-2.5 shadow-inner ${iconBg} ${iconColor}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {badge && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
          <span className="text-[11px] font-medium text-slate-400">Status</span>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
              badgeVariant === 'success'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : badgeVariant === 'warning'
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                : badgeVariant === 'danger'
                ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                : 'bg-blue-950/60 text-blue-300 border-blue-800/60'
            }`}
          >
            {badge}
          </span>
        </div>
      )}
    </div>
  );
};
