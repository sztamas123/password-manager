import { X } from "lucide-react";
import { type MouseEvent, type ReactNode, useEffect, useId } from "react";

export function Dialog({
  children,
  description,
  onClose,
  title,
  wide = false,
}: {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={handleBackdrop}>
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={wide ? "dialog dialog-wide" : "dialog"}
        role="dialog"
      >
        <header className="dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            aria-label="Close dialog"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
