import { Check, Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Dialog } from "../components/dialog";
import {
  calculatePasswordEntropy,
  DEFAULT_PASSWORD_OPTIONS,
  generatePassword,
  getPasswordStrength,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type PasswordGeneratorOptions,
} from "../lib/password-generator";

const CHARACTER_TYPE_OPTIONS: {
  key: keyof Pick<
    PasswordGeneratorOptions,
    "uppercase" | "lowercase" | "numbers" | "symbols"
  >;
  label: string;
  example: string;
}[] = [
  { key: "uppercase", label: "Uppercase", example: "A–Z" },
  { key: "lowercase", label: "Lowercase", example: "a–z" },
  { key: "numbers", label: "Numbers", example: "2–9" },
  { key: "symbols", label: "Symbols", example: "!@#$" },
];

export function GeneratorDialog({ onClose }: { onClose: () => void }) {
  const [options, setOptions] = useState<PasswordGeneratorOptions>(
    DEFAULT_PASSWORD_OPTIONS,
  );
  const [password, setPassword] = useState(() =>
    generatePassword(DEFAULT_PASSWORD_OPTIONS),
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const enabledTypeCount = CHARACTER_TYPE_OPTIONS.filter(
    ({ key }) => options[key],
  ).length;
  const entropy = calculatePasswordEntropy(options);
  const strength = getPasswordStrength(entropy);

  function regenerate(nextOptions = options) {
    setPassword(generatePassword(nextOptions));
    setCopied(false);
    setError("");
  }

  function updateOptions(nextOptions: PasswordGeneratorOptions) {
    setOptions(nextOptions);
    regenerate(nextOptions);
  }

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
      wide
    >
      <div className="generator">
        <div className="generated-value">
          <code>{password}</code>
          <button
            aria-label="Generate another password"
            className="icon-button"
            onClick={() => regenerate()}
            title="Generate another password"
            type="button"
          >
            <RefreshCw />
          </button>
        </div>

        <div
          aria-label={`${strength.label}: ${Math.round(entropy)} bits of estimated entropy`}
          className={`generator-meter generator-meter-level-${strength.level}`}
          role="img"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <div className="generator-meta">
          <span>
            <ShieldCheck size={16} />
            {strength.label}
          </span>
          <span>{Math.round(entropy)} bits of estimated entropy</span>
        </div>

        <section className="generator-settings" aria-label="Generator settings">
          <div className="generator-setting-heading">
            <label htmlFor="password-length">Length</label>
            <output htmlFor="password-length">{options.length}</output>
          </div>
          <input
            aria-valuetext={`${options.length} characters`}
            className="generator-range"
            id="password-length"
            max={MAX_PASSWORD_LENGTH}
            min={MIN_PASSWORD_LENGTH}
            onChange={(event) =>
              updateOptions({
                ...options,
                length: Number(event.target.value),
              })
            }
            type="range"
            value={options.length}
          />
          <div className="generator-range-labels" aria-hidden="true">
            <span>{MIN_PASSWORD_LENGTH}</span>
            <span>{MAX_PASSWORD_LENGTH}</span>
          </div>

          <fieldset className="generator-character-types">
            <legend>Character types</legend>
            <div className="generator-options">
              {CHARACTER_TYPE_OPTIONS.map(({ key, label, example }) => (
                <label className="generator-option" key={key}>
                  <input
                    checked={options[key]}
                    disabled={options[key] && enabledTypeCount === 1}
                    onChange={(event) =>
                      updateOptions({
                        ...options,
                        [key]: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{example}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <p className="generator-note">
          Every enabled character type appears at least once. The entropy
          estimate reflects the selected length and character types.
        </p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

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
