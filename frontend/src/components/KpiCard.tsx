import type { LucideIcon } from "lucide-react";

export default function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  trend?: string;
}) {
  return (
    <article className="kpi-card">
      <div className="kpi-top">
        <span>{label}</span>
        <div className="kpi-icon">
          <Icon size={17} strokeWidth={1.8} />
        </div>
      </div>
      <strong>{value}</strong>
      <div className="kpi-bottom">
        <span>{detail}</span>
        {trend && <em>{trend}</em>}
      </div>
    </article>
  );
}
