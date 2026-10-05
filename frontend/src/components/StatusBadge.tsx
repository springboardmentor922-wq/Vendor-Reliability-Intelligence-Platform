const tone = (value?: string) => {
  const v = String(value ?? "").toLowerCase();
  if (
    [
      "active",
      "approved",
      "completed",
      "delivered",
      "paid",
      "compliant",
      "low",
    ].some((x) => v.includes(x))
  )
    return "success";
  if (["pending", "ordered", "medium", "review"].some((x) => v.includes(x)))
    return "warning";
  if (
    [
      "rejected",
      "cancelled",
      "overdue",
      "non-compliant",
      "high",
      "expired",
    ].some((x) => v.includes(x))
  )
    return "danger";
  return "neutral";
};

export default function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`status-badge ${tone(value)}`}>
      <span className="status-dot" />
      {String(value).replaceAll("_", " ")}
    </span>
  );
}
