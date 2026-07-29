import { type FormEvent, useState } from "react";
import { Dialog } from "./dialog";
import { Spinner } from "./spinner";

export function NameDialog({
  initialValue = "",
  label,
  onClose,
  onSave,
  title,
}: {
  initialValue?: string;
  label: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  title: string;
}) {
  const [name, setName] = useState(initialValue);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    setError("");
    try {
      await onSave(trimmedName);
      onClose();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog onClose={onClose} title={title}>
      <form
        className="dialog-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label className="field">
          <span>{label}</span>
          <input
            autoFocus
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button
            className="button button-ghost"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={saving}>
            {saving ? <Spinner label="Saving" /> : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
