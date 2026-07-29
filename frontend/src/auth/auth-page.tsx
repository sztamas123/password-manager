import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { Brand } from "../components/brand";
import { Spinner } from "../components/spinner";
import { useAuth } from "./auth-context";

export function AuthPage({ action }: { action: "login" | "register" }) {
  const { authenticate } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRegister = action === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await authenticate(action, email, password);
      setPassword("");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Unable to continue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="auth-story-inner">
          <Brand />
          <div className="auth-story-copy">
            <p className="eyebrow">
              <ShieldCheck size={15} />
              Zero-knowledge by design
            </p>
            <h1>Your digital life, held only by you.</h1>
            <p>
              Passwords are encrypted in this browser before they ever reach
              your self-hosted server.
            </p>
          </div>
          <div className="security-points">
            <div>
              <Fingerprint />
              <span>
                <strong>Private by default</strong>
                Your master password never leaves this device.
              </span>
            </div>
            <div>
              <LockKeyhole />
              <span>
                <strong>Authenticated encryption</strong>
                Every vault item is protected against tampering.
              </span>
            </div>
          </div>
          <p className="auth-footnote">
            Open source · Self-hosted · No tracking
          </p>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-card">
          <div className="auth-heading">
            <span className="auth-icon">
              {isRegister ? <ShieldCheck /> : <LockKeyhole />}
            </span>
            <h2>{isRegister ? "Create your account" : "Welcome back"}</h2>
            <p>
              {isRegister
                ? "Start with an account password. Your separate master password comes next."
                : "Sign in to your self-hosted vault."}
            </p>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)}>
            <label className="field">
              <span>Email address</span>
              <input
                autoComplete="email"
                inputMode="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="field">
              <span>Account password</span>
              <span className="input-with-action">
                <input
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  minLength={12}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 12 characters"
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

            {isRegister && (
              <p className="form-hint">
                <Check size={15} />
                Use a long, unique account password.
              </p>
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
                <Spinner
                  label={isRegister ? "Creating account" : "Signing in"}
                />
              ) : (
                <>
                  {isRegister ? "Create account" : "Sign in"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch">
            {isRegister ? "Already have an account?" : "New to KeyNest?"}{" "}
            <Link to={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
