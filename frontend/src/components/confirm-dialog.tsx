import { useState } from "react";
import { Dialog } from "./dialog";
import { Spinner } from "./spinner";

export function ConfirmDialog({
  confirmLabel = "Delete",
  description,
  onClose,
  onConfirm,
  title,
}: {
  confirmLabel?: string;
  description: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setWorking(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Unable to continue");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog description={description} onClose={onClose} title={title}>
      {error && <p className="form-error">{error}</p>}
      <div className="dialog-actions">
        <button className="button button-ghost" onClick={onClose} type="button">
          Cancel
        </button>
        <button
          className="button button-danger"
          disabled={working}
          onClick={() => void confirm()}
          type="button"
        >
          {working ? <Spinner label="Deleting" /> : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
