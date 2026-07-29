import { KeyRound } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Keynest">
      <span className="brand-mark" aria-hidden="true">
        <KeyRound size={compact ? 18 : 21} strokeWidth={2.4} />
      </span>
      <span
        className={compact ? "brand-name brand-name-compact" : "brand-name"}
      >
        Keynest
      </span>
    </div>
  );
}
