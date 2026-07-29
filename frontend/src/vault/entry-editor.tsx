import { Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Dialog } from "../components/dialog";
import { Spinner } from "../components/spinner";
import type { DecryptedEntry, DecryptedFolder, LoginData } from "../lib/types";

const EMPTY_ENTRY: LoginData = {
  type: "login",
  name: "",
  username: "",
  password: "",
  url: "",
  notes: "",
};

export function EntryEditor({
  entry,
  folders,
  onClose,
  onDelete,
  onSave,
}: {
  entry: DecryptedEntry<LoginData> | null;
  folders: DecryptedFolder[];
  onClose: () => void;
  onDelete: (entry: DecryptedEntry<LoginData>) => void;
  onSave: (
    data: LoginData,
    folderId: string | null,
    entryId?: string,
  ) => Promise<void>;
}) {
  const [data, setData] = useState<LoginData>(entry?.data ?? EMPTY_ENTRY);
  const [folderId, setFolderId] = useState(entry?.folderId ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof LoginData, value: string) {
    setData((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(
        { ...data, name: data.name.trim() },
        folderId || null,
        entry?.id,
      );
      onClose();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save item",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyPassword() {
    if (!data.password) return;
    try {
      await navigator.clipboard.writeText(data.password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError("Clipboard access was denied");
    }
  }

  return (
    <Dialog
      description="Sensitive fields are encrypted in this browser before saving."
      onClose={onClose}
      title={entry ? "Edit login" : "Add a login"}
      wide
    >
      <form
        className="entry-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="entry-form-grid">
          <label className="field field-span-two">
            <span>Item name</span>
            <input
              autoFocus
              maxLength={200}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Personal email"
              required
              value={data.name}
            />
          </label>

          <label className="field">
            <span>Username or email (optional)</span>
            <input
              autoComplete="off"
              maxLength={1_000}
              onChange={(event) => update("username", event.target.value)}
              placeholder="name@example.com or username"
              value={data.username}
            />
          </label>

          <label className="field">
            <span>Folder</span>
            <select
              onChange={(event) => setFolderId(event.target.value)}
              value={folderId}
            >
              <option value="">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.data.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field field-span-two">
            <span>Password</span>
            <span className="password-input-group">
              <span className="password-input-wrap">
                <input
                  autoComplete="new-password"
                  maxLength={4_096}
                  onChange={(event) => update("password", event.target.value)}
                  placeholder="Enter an existing password"
                  type={showPassword ? "text" : "password"}
                  value={data.password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="input-action"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </span>
              <button
                className="field-tool"
                disabled={!data.password}
                onClick={() => void copyPassword()}
                type="button"
              >
                <Copy size={15} />
                {copied ? "Copied" : "Copy"}
              </button>
            </span>
          </label>

          <label className="field field-span-two">
            <span>Website</span>
            <input
              autoComplete="off"
              maxLength={2_048}
              onChange={(event) => update("url", event.target.value)}
              placeholder="https://example.com"
              type="url"
              value={data.url}
            />
          </label>

          <label className="field field-span-two">
            <span>Notes</span>
            <textarea
              maxLength={20_000}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Recovery details, security questions, or other notes"
              rows={4}
              value={data.notes}
            />
          </label>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="dialog-actions dialog-actions-split">
          <div>
            {entry && (
              <button
                className="button button-text-danger"
                onClick={() => onDelete(entry)}
                type="button"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
          </div>
          <div className="dialog-actions">
            <button
              className="button button-ghost"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button className="button button-primary" disabled={saving}>
              {saving ? <Spinner label="Encrypting" /> : "Encrypt & save"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
