import {
  calculatePasswordEntropy,
  DEFAULT_PASSWORD_OPTIONS,
  generatePassword,
  getPasswordStrength,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type PasswordGeneratorOptions,
} from "@password-manager/password-generator";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import type {
  CredentialSummary,
  ExtensionStatus,
  IdentitySummary,
  RuntimeRequest,
  RuntimeResponse,
} from "../../lib/types";

const WEB_APP_URL =
  import.meta.env.WXT_PUBLIC_WEB_APP_URL ?? "http://localhost:8080";

type CharacterOption = {
  key: keyof Pick<
    PasswordGeneratorOptions,
    "uppercase" | "lowercase" | "numbers" | "symbols"
  >;
  label: string;
};

const CHARACTER_OPTIONS: CharacterOption[] = [
  { key: "uppercase", label: "A–Z" },
  { key: "lowercase", label: "a–z" },
  { key: "numbers", label: "2–9" },
  { key: "symbols", label: "!@#" },
];

export function PopupApp() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void sendMessage<ExtensionStatus>({ type: "GET_STATUS" }).then(
      (response) => {
        if (response.ok) setStatus(response.data);
        else setError(response.error);
      },
    );
  }, []);

  if (!status) {
    return <LoadingState error={error} />;
  }

  return (
    <main className="popup-shell">
      <Header />
      {status.stage === "signed-out" && (
        <LoginView initialServerUrl={status.serverUrl} onStatus={setStatus} />
      )}
      {status.stage === "setup-required" && (
        <SetupRequiredView onStatus={setStatus} />
      )}
      {status.stage === "locked" && (
        <UnlockView email={status.user?.email ?? ""} onStatus={setStatus} />
      )}
      {status.stage === "unlocked" && (
        <UnlockedView email={status.user?.email ?? ""} onStatus={setStatus} />
      )}
    </main>
  );
}

function LoginView({
  initialServerUrl,
  onStatus,
}: {
  initialServerUrl: string;
  onStatus: (status: ExtensionStatus) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState(initialServerUrl);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await sendMessage<ExtensionStatus>({
      type: "LOGIN",
      email,
      password,
      serverUrl,
    });
    setLoading(false);

    if (response.ok) onStatus(response.data);
    else setError(response.error);
  }

  return (
    <form className="popup-form" onSubmit={(event) => void submit(event)}>
      <div className="intro-copy">
        <p className="eyebrow">Extension access</p>
        <h1>Sign in to your vault</h1>
        <p>Your master password is entered separately after authentication.</p>
      </div>

      <label>
        <span>Email</span>
        <input
          autoComplete="username"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </label>
      <label>
        <span>Account password</span>
        <input
          autoComplete="current-password"
          minLength={12}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      <details className="server-settings">
        <summary>Self-hosted server</summary>
        <label>
          <span>API URL</span>
          <input
            onChange={(event) => setServerUrl(event.target.value)}
            required
            type="url"
            value={serverUrl}
          />
        </label>
      </details>

      {error && <p className="form-error">{error}</p>}
      <button className="primary-button" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <button
        className="text-button"
        onClick={() => void openWebApp()}
        type="button"
      >
        Create an account in the web app
      </button>
    </form>
  );
}

function SetupRequiredView({
  onStatus,
}: {
  onStatus: (status: ExtensionStatus) => void;
}) {
  return (
    <section className="state-view">
      <span className="state-icon">◇</span>
      <h1>Finish account setup</h1>
      <p>
        Create your master password and first vault in the web app, then return
        here.
      </p>
      <button
        className="primary-button"
        onClick={() => void openWebApp()}
        type="button"
      >
        Open web app
      </button>
      <button
        className="text-button"
        onClick={() => void logoutAndUpdate(onStatus)}
        type="button"
      >
        Sign out
      </button>
    </section>
  );
}

function UnlockView({
  email,
  onStatus,
}: {
  email: string;
  onStatus: (status: ExtensionStatus) => void;
}) {
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await sendMessage<ExtensionStatus>({
      type: "UNLOCK",
      masterPassword,
    });
    setMasterPassword("");
    setLoading(false);

    if (response.ok) onStatus(response.data);
    else setError("Unable to unlock. Check your master password.");
  }

  return (
    <form className="popup-form" onSubmit={(event) => void submit(event)}>
      <div className="intro-copy">
        <p className="eyebrow">Vault locked</p>
        <h1>Unlock autofill</h1>
        <p>{email}</p>
      </div>
      <label>
        <span>Master password</span>
        <input
          autoComplete="current-password"
          autoFocus
          minLength={12}
          onChange={(event) => setMasterPassword(event.target.value)}
          required
          type="password"
          value={masterPassword}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button" disabled={loading}>
        {loading ? "Deriving key…" : "Unlock"}
      </button>
      <button
        className="text-button"
        onClick={() => void logoutAndUpdate(onStatus)}
        type="button"
      >
        Sign out
      </button>
    </form>
  );
}

function UnlockedView({
  email,
  onStatus,
}: {
  email: string;
  onStatus: (status: ExtensionStatus) => void;
}) {
  const [activeTab, setActiveTab] = useState<Browser.tabs.Tab | null>(null);
  const [matches, setMatches] = useState<CredentialSummary[]>([]);
  const [identities, setIdentities] = useState<IdentitySummary[]>([]);
  const [identityFormAvailable, setIdentityFormAvailable] = useState(false);
  const [usernameHint, setUsernameHint] = useState("");
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadActiveTabData().then(
      ({
        identities: foundIdentities,
        identityFormAvailable: foundIdentityForm,
        matches: found,
        tab,
        usernameHint: hint,
      }) => {
        setActiveTab(tab);
        setMatches(found);
        setIdentities(foundIdentities);
        setIdentityFormAvailable(foundIdentityForm);
        setUsernameHint(hint);
        setLoadingMatches(false);
      },
    );
  }, []);

  const pageAvailable =
    activeTab?.id !== undefined && isSupportedPage(activeTab.url);

  async function fill(match: CredentialSummary) {
    if (activeTab?.id === undefined || !activeTab.url) return;
    setError("");
    const response = await sendMessage({
      type: "FILL_CREDENTIAL",
      entryId: match.entryId,
      tabId: activeTab.id,
      url: activeTab.url,
      usernameHint,
      vaultId: match.vaultId,
    });
    if (response.ok) window.close();
    else setError(response.error);
  }

  async function fillIdentity(identity: IdentitySummary) {
    if (activeTab?.id === undefined) return;
    setError("");
    const response = await sendMessage({
      type: "FILL_IDENTITY",
      entryId: identity.entryId,
      mode: "identity",
      tabId: activeTab.id,
      vaultId: identity.vaultId,
    });
    if (response.ok) window.close();
    else setError(response.error);
  }

  return (
    <>
      <section className="account-bar">
        <span className="avatar">{email.charAt(0).toLocaleUpperCase()}</span>
        <span>
          <strong>Vault unlocked</strong>
          <small>{email}</small>
        </span>
        <button
          onClick={() => void lockAndUpdate(onStatus)}
          title="Lock extension"
          type="button"
        >
          Lock
        </button>
      </section>

      <section className="site-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Current website</p>
            <h2>{siteLabel(activeTab?.url)}</h2>
          </div>
          <span className={pageAvailable ? "status-dot" : "status-dot muted"} />
        </div>

        {loadingMatches && <p className="muted-copy">Checking your vault…</p>}
        {!loadingMatches && !pageAvailable && (
          <p className="muted-copy">
            Autofill is unavailable on browser-internal pages.
          </p>
        )}
        {!loadingMatches && pageAvailable && matches.length === 0 && (
          <p className="muted-copy">No saved login for this website yet.</p>
        )}
        {matches.map((match) => (
          <button
            className="credential-row"
            key={`${match.vaultId}:${match.entryId}`}
            onClick={() => void fill(match)}
            type="button"
          >
            <span className="credential-mark">●</span>
            <span>
              <strong>{match.name}</strong>
              <small>{match.username || "No username"}</small>
            </span>
            <b>Fill</b>
          </button>
        ))}
      </section>

      <section className="site-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Checkout and contact forms</p>
            <h2>Fill identity</h2>
          </div>
          <span
            className={
              identityFormAvailable ? "status-dot" : "status-dot muted"
            }
          />
        </div>
        {!identityFormAvailable && identities.length > 0 && (
          <p className="muted-copy">
            No address form was detected on this page.
          </p>
        )}
        {identities.length === 0 && (
          <p className="muted-copy">
            Add an identity in the web vault to fill addresses.
          </p>
        )}
        {identities.map((identity) => (
          <button
            className="credential-row"
            disabled={!identityFormAvailable}
            key={`${identity.vaultId}:${identity.entryId}`}
            onClick={() => void fillIdentity(identity)}
            type="button"
          >
            <span className="credential-mark">◆</span>
            <span>
              <strong>{identity.name}</strong>
              <small>{identity.email || "Address profile"}</small>
            </span>
            <b>Fill</b>
          </button>
        ))}
      </section>

      <GeneratorSection
        pageAvailable={pageAvailable}
        tabId={activeTab?.id ?? null}
      />

      {error && <p className="form-error popup-error">{error}</p>}
      <footer className="popup-footer">
        <button onClick={() => void openWebApp()} type="button">
          Open vault
        </button>
        <button onClick={() => void logoutAndUpdate(onStatus)} type="button">
          Sign out
        </button>
      </footer>
    </>
  );
}

function GeneratorSection({
  pageAvailable,
  tabId,
}: {
  pageAvailable: boolean;
  tabId: number | null;
}) {
  const [options, setOptions] = useState<PasswordGeneratorOptions>(
    DEFAULT_PASSWORD_OPTIONS,
  );
  const [password, setPassword] = useState(() => generatePassword(options));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const enabledCount = CHARACTER_OPTIONS.filter(
    ({ key }) => options[key],
  ).length;
  const entropy = useMemo(() => calculatePasswordEntropy(options), [options]);
  const strength = getPasswordStrength(entropy);

  function update(next: PasswordGeneratorOptions) {
    setOptions(next);
    setPassword(generatePassword(next));
    setCopied(false);
  }

  async function fillGenerated() {
    if (tabId === null) return;
    const response = await sendMessage({
      type: "FILL_GENERATED_PASSWORD",
      password,
      tabId,
    });
    if (response.ok) window.close();
    else setError(response.error);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_200);
    } catch {
      setError("Clipboard access was denied");
    }
  }

  return (
    <section className="generator-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">New account</p>
          <h2>Generate password</h2>
        </div>
        <span className={`strength strength-${strength.level}`}>
          {Math.round(entropy)} bits
        </span>
      </div>

      <div className="generated-password">
        <code>{password}</code>
        <button
          aria-label="Generate another password"
          onClick={() => update(options)}
          title="Generate another password"
          type="button"
        >
          ↻
        </button>
      </div>

      <div className="length-row">
        <label htmlFor="extension-password-length">Length</label>
        <output htmlFor="extension-password-length">{options.length}</output>
      </div>
      <input
        className="range"
        id="extension-password-length"
        max={MAX_PASSWORD_LENGTH}
        min={MIN_PASSWORD_LENGTH}
        onChange={(event) =>
          update({ ...options, length: Number(event.target.value) })
        }
        type="range"
        value={options.length}
      />

      <div className="character-options">
        {CHARACTER_OPTIONS.map(({ key, label }) => (
          <label key={key}>
            <input
              checked={options[key]}
              disabled={options[key] && enabledCount === 1}
              onChange={(event) =>
                update({ ...options, [key]: event.target.checked })
              }
              type="checkbox"
            />
            {label}
          </label>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="generator-actions">
        <button className="secondary-button" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          className="primary-button"
          disabled={!pageAvailable}
          onClick={() => void fillGenerated()}
        >
          Generate & fill
        </button>
      </div>
    </section>
  );
}

function Header() {
  return (
    <header className="brand-header">
      <span className="brand-mark">K</span>
      <span>KeyNest</span>
      <small>Private</small>
    </header>
  );
}

function LoadingState({ error }: { error: string }) {
  return (
    <main className="popup-shell">
      <Header />
      <section className="state-view">
        <span className="loading-mark">◆</span>
        <p>{error || "Opening your encrypted vault…"}</p>
      </section>
    </main>
  );
}

async function loadActiveTabData(): Promise<{
  identities: IdentitySummary[];
  identityFormAvailable: boolean;
  matches: CredentialSummary[];
  tab: Browser.tabs.Tab | null;
  usernameHint: string;
}> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isSupportedPage(tab.url))
    return {
      identities: [],
      identityFormAvailable: false,
      matches: [],
      tab: tab ?? null,
      usernameHint: "",
    };

  const usernameHint =
    tab.id === undefined
      ? ""
      : await browser.tabs
          .sendMessage(tab.id, { type: "GET_PAGE_USERNAME_HINT" })
          .then((value: unknown) => (typeof value === "string" ? value : ""))
          .catch(() => "");

  const [matchesResponse, identitiesResponse, formStatus] = await Promise.all([
    sendMessage<CredentialSummary[]>({
      type: "GET_MATCHES",
      url: tab.url ?? "",
      usernameHint,
    }),
    sendMessage<IdentitySummary[]>({ type: "GET_IDENTITIES" }),
    tab.id === undefined
      ? Promise.resolve({ available: false })
      : browser.tabs
          .sendMessage(tab.id, { type: "GET_IDENTITY_FORM_STATUS" })
          .then((value: unknown) => {
            if (typeof value !== "object" || value === null) {
              return { available: false };
            }
            return {
              available: (value as { available?: unknown }).available === true,
            };
          })
          .catch(() => ({ available: false })),
  ]);
  return {
    identities: identitiesResponse.ok ? identitiesResponse.data : [],
    identityFormAvailable: formStatus.available,
    matches: matchesResponse.ok ? matchesResponse.data : [],
    tab,
    usernameHint,
  };
}

async function lockAndUpdate(
  onStatus: (status: ExtensionStatus) => void,
): Promise<void> {
  const response = await sendMessage<ExtensionStatus>({ type: "LOCK" });
  if (response.ok) onStatus(response.data);
}

async function logoutAndUpdate(
  onStatus: (status: ExtensionStatus) => void,
): Promise<void> {
  const response = await sendMessage<ExtensionStatus>({ type: "LOGOUT" });
  if (response.ok) onStatus(response.data);
}

function openWebApp(): Promise<Browser.tabs.Tab> {
  return browser.tabs.create({ url: WEB_APP_URL });
}

function sendMessage<T = unknown>(
  message: RuntimeRequest,
): Promise<RuntimeResponse<T>> {
  return browser.runtime.sendMessage(message);
}

function isSupportedPage(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function siteLabel(url: string | undefined): string {
  if (!isSupportedPage(url)) return "Unavailable";
  return new URL(url).hostname.replace(/^www\./u, "");
}
