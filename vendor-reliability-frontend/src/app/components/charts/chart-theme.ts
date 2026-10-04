import { Chart, registerables, ChartOptions } from 'chart.js';

// Auto register all Chart.js modules
Chart.register(...registerables);

export const CHART_COLORS = {
  success: '#10b981',       // Emerald/Green (Delivered, Approved, Compliant, Low Risk)
  successLight: 'rgba(16, 185, 129, 0.18)',
  emerald: '#10b981',
  warning: '#f59e0b',       // Amber/Yellow (Pending, In Review, Under Renewal)
  warningLight: 'rgba(245, 158, 11, 0.18)',
  amber: '#f59e0b',
  delayed: '#f97316',       // Orange (Delayed, Warning, Expiring Soon)
  delayedLight: 'rgba(249, 115, 22, 0.18)',
  danger: '#ef4444',        // Red (Cancelled, Rejected, Critical Risk, High Risk, Non-Compliant)
  dangerLight: 'rgba(239, 68, 68, 0.18)',
  critical: '#ef4444',
  info: '#3b82f6',          // Blue (In Progress, In Transit, Active)
  infoLight: 'rgba(59, 130, 246, 0.18)',
  blue: '#3b82f6',
  sky: '#0284c7',
  purple: '#8b5cf6',        // Purple (Admin, Categories, Secondary)
  purpleLight: 'rgba(139, 92, 246, 0.18)',
  teal: '#06b6d4',          // Cyan/Teal
  tealLight: 'rgba(6, 182, 212, 0.18)',
  indigo: '#6366f1',
  indigoLight: 'rgba(99, 102, 241, 0.18)',
  neutral: '#64748b',       // Slate
  slate: '#64748b',
  neutralLight: '#f8fafc',
  border: '#e2e8f0',
  gridLine: 'rgba(226, 232, 240, 0.65)',
  textPrimary: '#1e293b',
  textMuted: '#64748b'
};

export const STATUS_COLORS: any = {
  success: CHART_COLORS.success,
  warning: CHART_COLORS.warning,
  delayed: CHART_COLORS.delayed,
  danger: CHART_COLORS.danger,
  critical: CHART_COLORS.danger,
  info: CHART_COLORS.info,
  'Approved': CHART_COLORS.success,
  'Delivered': CHART_COLORS.success,
  'Completed': CHART_COLORS.success,
  'Compliant': CHART_COLORS.success,
  'Active': CHART_COLORS.success,
  'Low Risk': CHART_COLORS.success,
  'Low': CHART_COLORS.success,
  'Pending': CHART_COLORS.warning,
  'Pending Approval': CHART_COLORS.warning,
  'Under Review': CHART_COLORS.warning,
  'Under Renewal': CHART_COLORS.warning,
  'In Progress': CHART_COLORS.info,
  'In Transit': CHART_COLORS.teal,
  'Issued': CHART_COLORS.info,
  'Delayed': CHART_COLORS.delayed,
  'Expiring Soon': CHART_COLORS.delayed,
  'Minor Issues': CHART_COLORS.delayed,
  'Medium Risk': CHART_COLORS.warning,
  'Medium': CHART_COLORS.warning,
  'Cancelled': CHART_COLORS.danger,
  'Rejected': CHART_COLORS.danger,
  'High Risk': CHART_COLORS.delayed,
  'High': CHART_COLORS.delayed,
  'Critical Risk': CHART_COLORS.danger,
  'Critical': CHART_COLORS.danger,
  'Non-Compliant': CHART_COLORS.danger,
  'Major Issues': CHART_COLORS.danger,
  'Expired': CHART_COLORS.danger
};

export const CATEGORY_PALETTE = [
  '#3b82f6', // IT & Electronics (Blue)
  '#f97316', // Raw Materials (Orange)
  '#10b981', // Office Supplies (Green)
  '#8b5cf6', // Machinery & Spare Parts (Purple)
  '#06b6d4', // Logistics (Teal)
  '#ec4899'  // Services (Pink)
];

export function getCommonChartOptions(extra: any = {}): any {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: CHART_COLORS.textMuted,
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          font: { family: "'Inter', sans-serif", size: 12, weight: 500 }
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        padding: 10,
        cornerRadius: 6,
        bodyFont: { family: "'Inter', sans-serif", size: 12 }
      }
    },
    ...extra
  };
}
