import { Archive } from "lucide-react";

export default function EmptyState({
  title = "Nothing here yet",
  text = "There are no records matching this view.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Archive size={19} />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
