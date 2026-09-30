import React from 'react';
import { UserRole } from '../../types';
import { 
  Shield, 
  ShoppingCart, 
  Truck, 
  Building2, 
  DollarSign, 
  FileCheck2 
} from 'lucide-react';

interface UserAvatarProps {
  name: string;
  role?: UserRole;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showRoleIconBadge?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  role = 'Administrator',
  size = 'md',
  className = '',
  showRoleIconBadge = true,
}) => {
  // Extract clean initials from role or name (e.g. Administrator -> AD, Procurement Manager -> PM)
  const getInitials = (n: string) => {
    if (!n) return 'U';
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return n.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(name);

  // Consistent, professional role styling
  const roleConfig: Record<UserRole, { bg: string; text: string; ring: string; icon: React.ComponentType<{ className?: string }> }> = {
    'Administrator': {
      bg: 'bg-gradient-to-br from-purple-700 to-indigo-800',
      text: 'text-purple-100',
      ring: 'ring-purple-500/30',
      icon: Shield,
    },
    'Procurement Manager': {
      bg: 'bg-gradient-to-br from-blue-700 to-sky-800',
      text: 'text-sky-100',
      ring: 'ring-sky-500/30',
      icon: ShoppingCart,
    },
    'Supply Chain Manager': {
      bg: 'bg-gradient-to-br from-cyan-700 to-teal-800',
      text: 'text-cyan-100',
      ring: 'ring-cyan-500/30',
      icon: Truck,
    },
    'Vendor': {
      bg: 'bg-gradient-to-br from-emerald-700 to-teal-800',
      text: 'text-emerald-100',
      ring: 'ring-emerald-500/30',
      icon: Building2,
    },
    'Finance Officer': {
      bg: 'bg-gradient-to-br from-amber-700 to-orange-800',
      text: 'text-amber-100',
      ring: 'ring-amber-500/30',
      icon: DollarSign,
    },
    'Auditor': {
      bg: 'bg-gradient-to-br from-rose-700 to-pink-800',
      text: 'text-rose-100',
      ring: 'ring-rose-500/30',
      icon: FileCheck2,
    },
  };

  const config = roleConfig[role] || roleConfig['Administrator'];
  const RoleIcon = config.icon;

  const sizeStyles = {
    sm: 'h-7 w-7 text-[11px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-11 w-11 text-sm',
    xl: 'h-14 w-14 text-base font-extrabold',
  };

  const badgeSizeStyles = {
    sm: 'h-3.5 w-3.5 -bottom-0.5 -right-0.5 p-0.5',
    md: 'h-4 w-4 -bottom-1 -right-1 p-0.5',
    lg: 'h-5 w-5 -bottom-1 -right-1 p-1',
    xl: 'h-6 w-6 -bottom-1 -right-1 p-1',
  };

  return (
    <div className={`relative inline-flex flex-shrink-0 items-center justify-center font-bold font-mono select-none rounded-xl ring-1 ${config.ring} ${config.bg} ${config.text} ${sizeStyles[size]} ${className}`}>
      <span>{initials}</span>

      {showRoleIconBadge && (
        <div className={`absolute flex items-center justify-center rounded-full bg-slate-900 border border-slate-700 text-white shadow-sm ${badgeSizeStyles[size]}`}>
          <RoleIcon className="w-full h-full text-slate-200" />
        </div>
      )}
    </div>
  );
};
