import {
  Archive,
  ChevronDown,
  Folder,
  FolderPlus,
  KeyRound,
  Lock,
  LogOut,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { Brand } from "../components/brand";
import { ConfirmDialog } from "../components/confirm-dialog";
import { NameDialog } from "../components/name-dialog";
import { Spinner } from "../components/spinner";
import {
  type DecryptedEntry,
  type IdentityData,
  isIdentityEntry,
  isLoginEntry,
  type LoginData,
} from "../lib/types";
import { EntryCard } from "./entry-card";
import { EntryEditor } from "./entry-editor";
import { GeneratorDialog } from "./generator-dialog";
import { IdentityEditor } from "./identity-editor";
import { filterEntries } from "./search";
import { useVaultData } from "./use-vault-data";

type NameDialogState =
  | { type: "create-vault" }
  | { type: "rename-vault" }
  | { type: "create-folder" }
  | null;

type EditorState =
  | { type: "login"; entry: DecryptedEntry<LoginData> | null }
  | { type: "identity"; entry: DecryptedEntry<IdentityData> | null }
  | null;

export function VaultPage() {
  const { lock, logout, user } = useAuth();
  const vault = useVaultData();
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [nameDialog, setNameDialog] = useState<NameDialogState>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deletingEntry, setDeletingEntry] = useState<DecryptedEntry | null>(
    null,
  );
  const [deleteVaultOpen, setDeleteVaultOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const selectedVault = vault.vaults.find(
    (item) => item.id === vault.selectedVaultId,
  );
  const activeFolderId =
    folderId && vault.folders.some((folder) => folder.id === folderId)
      ? folderId
      : null;
  const selectedFolder = vault.folders.find(
    (item) => item.id === activeFolderId,
  );
  const visibleEntries = useMemo(
    () => filterEntries(vault.entries, query, activeFolderId),
    [vault.entries, query, activeFolderId],
  );

  function openNewLogin() {
    setEditor({ type: "login", entry: null });
  }

  function openNewIdentity() {
    setEditor({ type: "identity", entry: null });
  }

  function openEntry(entry: DecryptedEntry) {
    if (isIdentityEntry(entry)) {
      setEditor({ type: "identity", entry });
    } else if (isLoginEntry(entry)) {
      setEditor({ type: "login", entry });
    }
  }

  if (vault.loading && vault.vaults.length === 0) {
    return (
      <main className="app-loading">
        <Brand />
        <Spinner label="Decrypting your vault" />
      </main>
    );
  }

  return (
    <main className="vault-layout">
      <aside className="vault-sidebar">
        <div className="sidebar-brand">
          <Brand compact />
          <span className="secure-badge">
            <ShieldCheck size={13} />
            Private
          </span>
        </div>

        <div className="vault-picker-wrap">
          <label htmlFor="vault-picker">Vault</label>
          <span className="vault-picker">
            <KeyRound size={17} />
            <select
              id="vault-picker"
              onChange={(event) => vault.setSelectedVaultId(event.target.value)}
              value={vault.selectedVaultId ?? ""}
            >
              {vault.vaults.length === 0 && (
                <option value="">No vaults yet</option>
              )}
              {vault.vaults.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.data.name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </span>
          <div className="vault-tools">
            <button
              aria-label="Create vault"
              className="sidebar-tool"
              onClick={() => setNameDialog({ type: "create-vault" })}
              type="button"
            >
              <Plus />
            </button>
            <button
              aria-label="Rename selected vault"
              className="sidebar-tool"
              disabled={!selectedVault}
              onClick={() => setNameDialog({ type: "rename-vault" })}
              type="button"
            >
              <Pencil />
            </button>
            <button
              aria-label="Delete selected vault"
              className="sidebar-tool sidebar-tool-danger"
              disabled={!selectedVault}
              onClick={() => setDeleteVaultOpen(true)}
              type="button"
            >
              <Trash2 />
            </button>
          </div>
        </div>

        <nav className="vault-nav" aria-label="Vault folders">
          <button
            className={
              activeFolderId === null ? "nav-item nav-item-active" : "nav-item"
            }
            onClick={() => setFolderId(null)}
            type="button"
          >
            <Archive />
            <span>All items</span>
            <small>{vault.entries.length}</small>
          </button>
          <div className="nav-heading">
            <span>Folders</span>
            <button
              aria-label="Create folder"
              disabled={!selectedVault}
              onClick={() => setNameDialog({ type: "create-folder" })}
              type="button"
            >
              <FolderPlus />
            </button>
          </div>
          {vault.folders.map((item) => {
            const count = vault.entries.filter(
              (entry) => entry.folderId === item.id,
            ).length;
            return (
              <button
                className={
                  activeFolderId === item.id
                    ? "nav-item nav-item-active"
                    : "nav-item"
                }
                key={item.id}
                onClick={() => setFolderId(item.id)}
                type="button"
              >
                <Folder />
                <span>{item.data.name}</span>
                <small>{count}</small>
              </button>
            );
          })}
          {vault.folders.length === 0 && selectedVault && (
            <p className="nav-empty">No folders yet</p>
          )}
        </nav>

        <div className="sidebar-account">
          <span className="account-avatar">
            {user?.email.charAt(0).toLocaleUpperCase() ?? <UserRound />}
          </span>
          <span className="account-copy">
            <strong>{user?.email.split("@")[0]}</strong>
            <small>{user?.email}</small>
          </span>
          <button
            aria-label="Lock vault"
            className="sidebar-tool"
            onClick={lock}
            title="Lock vault"
            type="button"
          >
            <Lock />
          </button>
          <button
            aria-label="Sign out"
            className="sidebar-tool"
            onClick={logout}
            title="Sign out"
            type="button"
          >
            <LogOut />
          </button>
        </div>
      </aside>

      <section className="vault-content">
        <header className="vault-topbar">
          <label className="search-box">
            <Search />
            <input
              aria-label="Search vault"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search names, usernames, websites..."
              type="search"
              value={query}
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <button
              className="button button-secondary"
              onClick={() => setGeneratorOpen(true)}
              type="button"
            >
              <Sparkles size={17} />
              Generator
            </button>
            <button
              className="button button-secondary"
              disabled={!selectedVault}
              onClick={openNewIdentity}
              type="button"
            >
              <UserRound size={17} />
              New identity
            </button>
            <button
              className="button button-primary"
              disabled={!selectedVault}
              onClick={openNewLogin}
              type="button"
            >
              <Plus size={18} />
              New login
            </button>
          </div>
        </header>

        <div className="vault-main">
          {vault.error && (
            <div className="vault-error" role="alert">
              {vault.error}
            </div>
          )}

          {!selectedVault ? (
            <section className="empty-vault">
              <span className="empty-icon">
                <KeyRound />
              </span>
              <p className="eyebrow">Encrypted from the first item</p>
              <h1>Create your first vault</h1>
              <p>
                Vault names and every credential are encrypted locally before
                being stored.
              </p>
              <button
                className="button button-primary"
                onClick={() => setNameDialog({ type: "create-vault" })}
                type="button"
              >
                <Plus size={18} />
                Create vault
              </button>
            </section>
          ) : (
            <>
              <div className="content-heading">
                <div>
                  <p className="eyebrow">
                    {selectedVault.data.name} ·{" "}
                    {selectedFolder?.data.name ?? "All items"}
                  </p>
                  <h1>{selectedFolder?.data.name ?? "Your items"}</h1>
                  <p>
                    {visibleEntries.length}{" "}
                    {visibleEntries.length === 1 ? "item" : "items"}
                    {query ? ` matching “${query}”` : ""}
                  </p>
                </div>
                <span className="encryption-status">
                  <span />
                  End-to-end encrypted
                </span>
              </div>

              {vault.loading ? (
                <div className="content-loading">
                  <Spinner label="Decrypting items" />
                </div>
              ) : visibleEntries.length > 0 ? (
                <div className="entry-grid">
                  {visibleEntries.map((entry) => (
                    <EntryCard
                      entry={entry}
                      key={entry.id}
                      onOpen={() => openEntry(entry)}
                    />
                  ))}
                </div>
              ) : (
                <section className="empty-list">
                  <span className="empty-icon empty-icon-small">
                    {query ? <Search /> : <KeyRound />}
                  </span>
                  <h2>{query ? "No matches found" : "No items here yet"}</h2>
                  <p>
                    {query
                      ? "Try a different name, username, website, or note."
                      : "Add a login or identity. It will be encrypted before it leaves this browser."}
                  </p>
                  {!query && (
                    <button
                      className="button button-primary"
                      onClick={openNewLogin}
                      type="button"
                    >
                      <Plus size={18} />
                      Add login
                    </button>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </section>

      {nameDialog?.type === "create-vault" && (
        <NameDialog
          label="Vault name"
          onClose={() => setNameDialog(null)}
          onSave={vault.createVault}
          title="Create vault"
        />
      )}
      {nameDialog?.type === "rename-vault" && selectedVault && (
        <NameDialog
          initialValue={selectedVault.data.name}
          label="Vault name"
          onClose={() => setNameDialog(null)}
          onSave={(name) => vault.renameVault(selectedVault.id, name)}
          title="Rename vault"
        />
      )}
      {nameDialog?.type === "create-folder" && (
        <NameDialog
          label="Folder name"
          onClose={() => setNameDialog(null)}
          onSave={vault.createFolder}
          title="Create folder"
        />
      )}
      {editor?.type === "login" && (
        <EntryEditor
          entry={editor.entry}
          folders={vault.folders}
          key={editor.entry?.id ?? "new-entry"}
          onClose={() => setEditor(null)}
          onDelete={(entry) => {
            setEditor(null);
            setDeletingEntry(entry);
          }}
          onSave={vault.saveEntry}
        />
      )}
      {editor?.type === "identity" && (
        <IdentityEditor
          entry={editor.entry}
          folders={vault.folders}
          key={editor.entry?.id ?? "new-identity"}
          onClose={() => setEditor(null)}
          onDelete={(entry) => {
            setEditor(null);
            setDeletingEntry(entry);
          }}
          onSave={vault.saveEntry}
        />
      )}
      {deletingEntry && (
        <ConfirmDialog
          description={`“${deletingEntry.data.name}” will be permanently removed from this vault.`}
          onClose={() => setDeletingEntry(null)}
          onConfirm={() => vault.deleteEntry(deletingEntry.id)}
          title={
            isIdentityEntry(deletingEntry)
              ? "Delete identity?"
              : "Delete login?"
          }
        />
      )}
      {deleteVaultOpen && selectedVault && (
        <ConfirmDialog
          description={`“${selectedVault.data.name}” and all of its folders and items will be permanently deleted.`}
          onClose={() => setDeleteVaultOpen(false)}
          onConfirm={() => vault.deleteVault(selectedVault.id)}
          title="Delete vault?"
        />
      )}
      {generatorOpen && (
        <GeneratorDialog onClose={() => setGeneratorOpen(false)} />
      )}
    </main>
  );
}
