import { Check, Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Dialog } from "../components/dialog";
import {
  GENERATED_PASSWORD_LENGTH,
  generatePassword,
} from "../lib/password-generator";

export function GeneratorDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState(generatePassword);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setError("");
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError("Clipboard access was denied");
    }
  }

  return (
    <Dialog
      description="Generated locally with the browser’s cryptographically secure random source."
      onClose={onClose}
      title="Password generator"
    >
      <div className="generator">
        <div className="generated-value">
          <code>{password}</code>
          <button
            aria-label="Generate another password"
            className="icon-button"
            onClick={() => {
              setPassword(generatePassword());
              setCopied(false);
            }}
            type="button"
          >
            <RefreshCw />
          </button>
        </div>

        <div className="generator-meter">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="generator-meta">
          <span>
            <ShieldCheck size={16} />
            Strong random password
          </span>
          <span>{GENERATED_PASSWORD_LENGTH} characters</span>
        </div>

        <p className="generator-note">
          Uses a fixed mix of letters, numbers, and symbols. Configurable rules
          and entropy analysis arrive in the dedicated generator phase.
        </p>

        {error && <p className="form-error">{error}</p>}

        <button
          className="button button-primary button-wide"
          onClick={() => void copy()}
          type="button"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? "Copied to clipboard" : "Copy password"}
        </button>
      </div>
    </Dialog>
  );
}
