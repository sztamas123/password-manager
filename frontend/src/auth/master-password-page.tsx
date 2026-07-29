import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { Brand } from "../components/brand";
import { Spinner } from "../components/spinner";
import { useAuth } from "./auth-context";

export function MasterPasswordPage({ mode }: { mode: "setup" | "unlock" }) {
  const { logout, setupMasterPassword, unlock, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSetup = mode === "setup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isSetup && password !== confirmation) {
      setError("Master passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      if (isSetup) {
        await setupMasterPassword(password);
      } else {
        await unlock(password);
      }
      setPassword("");
      setConfirmation("");
    } catch {
      setError(
        isSetup
          ? "Unable to create your encryption profile"
          : "Unable to unlock. Check your master password and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="master-layout">
      <header className="master-header">
        <Brand />
        <button className="button button-ghost" onClick={logout} type="button">
          <LogOut size={17} />
          Sign out
        </button>
      </header>

      <section className="master-card">
        <div className="master-art" aria-hidden="true">
          <span className="master-ring master-ring-one" />
          <span className="master-ring master-ring-two" />
          <span className="master-key">
            <KeyRound />
          </span>
        </div>

        <p className="eyebrow">
          <ShieldCheck size={15} />
          {isSetup ? "One last security step" : "Vault locked"}
        </p>
        <h1>{isSetup ? "Create your master password" : "Unlock your vault"}</h1>
        <p className="master-intro">
          {isSetup
            ? "This password encrypts your vault locally. It can be different from your account password."
            : `Welcome back, ${user?.email ?? "vault owner"}. Enter your master password to decrypt locally.`}
        </p>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>Master password</span>
            <span className="input-with-action">
              <input
                autoComplete={isSetup ? "new-password" : "current-password"}
                autoFocus
                minLength={12}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter a long, memorable password"
                required
                type={showPassword ? "text" : "password"}
                value={password}
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
          </label>

          {isSetup && (
            <label className="field">
              <span>Confirm master password</span>
              <input
                autoComplete="new-password"
                minLength={12}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Repeat your master password"
                required
                type={showPassword ? "text" : "password"}
                value={confirmation}
              />
            </label>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="button button-primary button-wide"
            disabled={submitting}
          >
            {submitting ? (
              <Spinner label={isSetup ? "Securing your vault" : "Unlocking"} />
            ) : (
              <>
                {isSetup ? "Create encrypted vault" : "Unlock vault"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="master-warning">
          <TriangleAlert size={20} />
          <span>
            <strong>There is no master-password recovery.</strong>
            {isSetup
              ? " Store it somewhere safe. The server cannot decrypt your vault or reset this password."
              : " Your master password is never sent to the server."}
          </span>
        </div>
      </section>
    </main>
  );
}
