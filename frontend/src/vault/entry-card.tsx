import {
  Copy,
  Globe2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
} from "lucide-react";
import { type KeyboardEvent, type MouseEvent, useState } from "react";
import {
  type DecryptedEntry,
  isIdentityData,
  type LoginData,
} from "../lib/types";
import { getSafeExternalUrl } from "../lib/url";

export function EntryCard({
  entry,
  onOpen,
}: {
  entry: DecryptedEntry;
  onOpen: () => void;
}) {
  if (isIdentityData(entry.data)) {
    const address = [
      entry.data.addressLine1,
      entry.data.city,
      entry.data.region,
      entry.data.country,
    ]
      .filter(Boolean)
      .join(", ");

    return (
      <article
        className="entry-card entry-card-identity"
        onClick={onOpen}
        onKeyDown={(event) => handleCardKeyDown(event, onOpen)}
        role="button"
        tabIndex={0}
      >
        <div className="entry-card-top">
          <span className="entry-avatar" aria-hidden="true">
            {entry.data.name.trim().charAt(0).toLocaleUpperCase() || "I"}
          </span>
          <button
            aria-label={`Edit ${entry.data.name}`}
            className="icon-button entry-more"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            type="button"
          >
            <MoreHorizontal />
          </button>
        </div>
        <div className="entry-card-copy">
          <h3>{entry.data.name}</h3>
          <p>
            {[entry.data.firstName, entry.data.lastName]
              .filter(Boolean)
              .join(" ") || "Identity"}
          </p>
        </div>
        {entry.data.email && (
          <div className="entry-site">
            <Mail size={14} />
            <span>{entry.data.email}</span>
          </div>
        )}
        {entry.data.phone && (
          <div className="entry-site">
            <Phone size={14} />
            <span>{entry.data.phone}</span>
          </div>
        )}
        <div className="entry-password">
          <span>
            {address ? (
              <>
                <MapPin size={14} /> {address}
              </>
            ) : (
              "No address"
            )}
          </span>
        </div>
      </article>
    );
  }

  return (
    <LoginEntryCard entry={{ ...entry, data: entry.data }} onOpen={onOpen} />
  );
}

function LoginEntryCard({
  entry,
  onOpen,
}: {
  entry: DecryptedEntry<LoginData>;
  onOpen: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const safeUrl = getSafeExternalUrl(entry.data.url);
  const hostname = safeUrl ? new URL(safeUrl).hostname : entry.data.url;

  async function copyPassword(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!entry.data.password) return;
    try {
      await navigator.clipboard.writeText(entry.data.password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article
      className="entry-card entry-card-login"
      onClick={onOpen}
      onKeyDown={(event) => handleCardKeyDown(event, onOpen)}
      role="button"
      tabIndex={0}
    >
      <div className="entry-card-top">
        <span className="entry-avatar" aria-hidden="true">
          {entry.data.name.trim().charAt(0).toLocaleUpperCase() || <Globe2 />}
        </span>
        <button
          aria-label={`Edit ${entry.data.name}`}
          className="icon-button entry-more"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          type="button"
        >
          <MoreHorizontal />
        </button>
      </div>
      <div className="entry-card-copy">
        <h3>{entry.data.name}</h3>
        <p>{entry.data.username || "No username"}</p>
      </div>
      {hostname && (
        <div className="entry-site">
          <Globe2 size={14} />
          <span>{hostname}</span>
        </div>
      )}
      <div className="entry-password">
        <span>{entry.data.password ? "••••••••••••" : "No password"}</span>
        <button
          aria-label={`Copy password for ${entry.data.name}`}
          className="copy-button"
          disabled={!entry.data.password}
          onClick={(event) => void copyPassword(event)}
          type="button"
        >
          <Copy size={14} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </article>
  );
}

function handleCardKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onOpen: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onOpen();
  }
}
