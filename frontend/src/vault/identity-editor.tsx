import { Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Dialog } from "../components/dialog";
import { Spinner } from "../components/spinner";
import type {
  DecryptedEntry,
  DecryptedFolder,
  IdentityData,
} from "../lib/types";

const EMPTY_IDENTITY: IdentityData = {
  type: "identity",
  name: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "",
  addressLine1: "",
  addressLine2: "",
  region: "",
  city: "",
  postalCode: "",
  notes: "",
};

export function IdentityEditor({
  entry,
  folders,
  onClose,
  onDelete,
  onSave,
}: {
  entry: DecryptedEntry<IdentityData> | null;
  folders: DecryptedFolder[];
  onClose: () => void;
  onDelete: (entry: DecryptedEntry<IdentityData>) => void;
  onSave: (
    data: IdentityData,
    folderId: string | null,
    entryId?: string,
  ) => Promise<void>;
}) {
  const [data, setData] = useState<IdentityData>(entry?.data ?? EMPTY_IDENTITY);
  const [folderId, setFolderId] = useState(entry?.folderId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof IdentityData, value: string) {
    setData((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(
        {
          ...data,
          type: "identity",
          name: data.name.trim(),
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email.trim(),
          phone: data.phone.trim(),
          country: data.country.trim(),
          addressLine1: data.addressLine1.trim(),
          addressLine2: data.addressLine2.trim(),
          region: data.region.trim(),
          city: data.city.trim(),
          postalCode: data.postalCode.trim(),
        },
        folderId || null,
        entry?.id,
      );
      onClose();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save identity",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      description="Personal details are encrypted in this browser before saving."
      onClose={onClose}
      title={entry ? "Edit identity" : "Add an identity"}
      wide
    >
      <form
        className="entry-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="entry-form-grid">
          <label className="field">
            <span>Identity name</span>
            <input
              autoFocus
              maxLength={200}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Home address"
              required
              value={data.name}
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

          <label className="field">
            <span>First name</span>
            <input
              autoComplete="off"
              maxLength={200}
              onChange={(event) => update("firstName", event.target.value)}
              value={data.firstName}
            />
          </label>

          <label className="field">
            <span>Last name</span>
            <input
              autoComplete="off"
              maxLength={200}
              onChange={(event) => update("lastName", event.target.value)}
              value={data.lastName}
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              autoComplete="off"
              maxLength={320}
              onChange={(event) => update("email", event.target.value)}
              type="email"
              value={data.email}
            />
          </label>

          <label className="field">
            <span>Phone</span>
            <input
              autoComplete="off"
              maxLength={100}
              onChange={(event) => update("phone", event.target.value)}
              type="tel"
              value={data.phone}
            />
          </label>

          <label className="field field-span-two">
            <span>Country or region</span>
            <input
              autoComplete="off"
              maxLength={200}
              onChange={(event) => update("country", event.target.value)}
              placeholder="e.g. Romania"
              value={data.country}
            />
          </label>

          <label className="field field-span-two">
            <span>Street address</span>
            <input
              autoComplete="off"
              maxLength={500}
              onChange={(event) => update("addressLine1", event.target.value)}
              placeholder="Street name and number"
              value={data.addressLine1}
            />
          </label>

          <label className="field field-span-two">
            <span>Apartment, suite, unit (optional)</span>
            <input
              autoComplete="off"
              maxLength={500}
              onChange={(event) => update("addressLine2", event.target.value)}
              value={data.addressLine2}
            />
          </label>

          <label className="field">
            <span>State, county, or province</span>
            <input
              autoComplete="off"
              maxLength={200}
              onChange={(event) => update("region", event.target.value)}
              value={data.region}
            />
          </label>

          <label className="field">
            <span>City or locality</span>
            <input
              autoComplete="off"
              maxLength={200}
              onChange={(event) => update("city", event.target.value)}
              value={data.city}
            />
          </label>

          <label className="field">
            <span>Postal code</span>
            <input
              autoComplete="off"
              maxLength={50}
              onChange={(event) => update("postalCode", event.target.value)}
              value={data.postalCode}
            />
          </label>

          <label className="field field-span-two">
            <span>Notes</span>
            <textarea
              maxLength={20_000}
              onChange={(event) => update("notes", event.target.value)}
              rows={3}
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
