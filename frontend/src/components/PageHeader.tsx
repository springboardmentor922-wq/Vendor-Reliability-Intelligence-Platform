import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

export default function PageHeader({
  eyebrow,
  title,
  description,
  onRefresh,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onRefresh: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">
        <button className="button ghost" onClick={onRefresh}>
          <RefreshCw size={15} /> Refresh
        </button>
        {action}
      </div>
    </div>
  );
}
