import React from 'react';

export const StatusBadge = ({ status, type }) => {
  if (!status) return null;
  const cleanStatus = String(status).toLowerCase();
  const label = cleanStatus.replace(/_/g, ' ');

  let badgeClass = 'badge-neutral';

  if (['approved', 'active', 'paid', 'delivered', 'completed'].includes(cleanStatus)) {
    badgeClass = 'badge-approved';
  } else if (['pending', 'expiring_soon', 'in_progress'].includes(cleanStatus)) {
    badgeClass = 'badge-pending';
  } else if (['rejected', 'suspended', 'overdue', 'expired', 'cancelled'].includes(cleanStatus)) {
    badgeClass = 'badge-rejected';
  } else if (['ordered'].includes(cleanStatus)) {
    badgeClass = 'badge-ordered';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      {label}
    </span>
  );
};
