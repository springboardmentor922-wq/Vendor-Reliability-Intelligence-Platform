import React from 'react';

export const StatCard = ({ label, value, helpText, color }) => {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : {}}>
        {value !== undefined && value !== null ? value : '-'}
      </div>
      {helpText && <div className="stat-help">{helpText}</div>}
    </div>
  );
};
