import { generatePassword } from "@password-manager/password-generator";
import { browser } from "wxt/browser";
import type {
  ContentMessage,
  CredentialSummary,
  PendingCredentialSummary,
  RuntimeRequest,
  RuntimeResponse,
} from "../lib/types";
import {
  detectCredentialForm,
  detectUsernameStep,
  fillCredential,
  fillGeneratedPassword,
  fillUsernameStep,
  findFirstCredentialForm,
  findFirstUsernameStep,
  isPasswordInput,
  isPotentialUsernameInput,
  readCredential,
  readVisibleAccountIdentifier,
  type DetectedCredentialForm,
  type DetectedUsernameStep,
} from "../content/form-detection";

const WEB_APP_URL =
  import.meta.env.WXT_PUBLIC_WEB_APP_URL ?? "http://localhost:8080";
const SAME_PAGE_SAVE_PROMPT_DELAY_MS = 2_000;
const CREDENTIAL_ACTION_HINT = /^(?:continue|log ?in|next|sign ?in|submit)$/iu;

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    if (isPasswordManagerWebApp()) return;
    installFormIntegration();
  },
});

function installFormIntegration(): void {
  const actionControl = createActionControl();
  let activeForm: DetectedCredentialForm | null = null;
  let activeUsernameStep: DetectedUsernameStep | null = null;
  let activeMatches: CredentialSummary[] = [];
  let savePromptTimer: number | null = null;
  let lastActiveCaptureAt = 0;
  const capturedAt = new WeakMap<HTMLFormElement, number>();

  document.addEventListener(
    "focusin",
    (event) => activateControlForTarget(event.target),
    true,
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target;
      const isActiveField =
        activeForm?.passwordInputs.includes(target as HTMLInputElement) ===
          true ||
        target === activeForm?.usernameInput ||
        target === activeUsernameStep?.usernameInput;
      if (!isActiveField && !actionControl.ownsEvent(event)) {
        actionControl.hide();
      }
    },
    true,
  );

  document.addEventListener(
    "submit",
    (event) => {
      if (event.target instanceof HTMLFormElement) {
        void captureSubmission(event.target);
      }
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const submitter = event.target.closest<
        HTMLButtonElement | HTMLInputElement
      >('button[type="submit"], input[type="submit"], button:not([type])');
      if (submitter?.form) {
        void captureSubmission(submitter.form);
        return;
      }

      const action = event.target.closest<HTMLElement>(
        'button, input[type="button"], [role="button"]',
      );
      const label = [
        action?.textContent,
        action?.getAttribute("aria-label"),
        action instanceof HTMLInputElement ? action.value : "",
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (action && CREDENTIAL_ACTION_HINT.test(label)) {
        void captureActiveStep();
      }
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" &&
        (isPasswordInput(event.target) ||
          isPotentialUsernameInput(event.target))
      ) {
        void captureActiveStep();
      }
    },
    true,
  );

  window.addEventListener("scroll", () => actionControl.reposition(), true);
  window.addEventListener("resize", () => actionControl.reposition());

  browser.runtime.onMessage.addListener(
    // WXT supports Promise responses despite the legacy listener type.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    (message: unknown) => {
      if (!isContentMessage(message)) return undefined;

      if (message.type === "GET_PAGE_USERNAME_HINT") {
        return Promise.resolve(accountUsernameHint());
      } else if (message.type === "APPLY_CREDENTIAL") {
        const detected = activeForm ?? findFirstCredentialForm();
        if (detected) {
          fillCredential(detected, message.username, message.password);
        } else {
          const usernameStep = activeUsernameStep ?? findFirstUsernameStep();
          if (!usernameStep) return Promise.resolve(false);
          fillUsernameStep(usernameStep, message.username);
        }
        actionControl.feedback("Filled");
      } else if (message.type === "APPLY_GENERATED_PASSWORD") {
        const detected = activeForm ?? findFirstCredentialForm();
        if (!detected) return Promise.resolve(false);
        fillGeneratedPassword(detected, message.password);
        actionControl.feedback("Generated");
      } else {
        return undefined;
      }
      return Promise.resolve(true);
    },
  );

  void getPendingCredential().then((pending) => {
    if (pending) renderSavePrompt(pending);
  });
  window.setTimeout(() => activateControlForTarget(document.activeElement), 0);

  function activateControlForTarget(target: EventTarget | null): void {
    if (isPasswordInput(target)) {
      const detected = detectCredentialForm(target);
      if (!detected) {
        clearActiveControl();
        return;
      }

      activeForm = detected;
      activeUsernameStep = null;
      void loadPasswordControl(target, detected);
      return;
    }

    if (isPotentialUsernameInput(target)) {
      const detected = detectUsernameStep(target);
      if (!detected) {
        clearActiveControl();
        return;
      }

      activeForm = null;
      activeUsernameStep = detected;
      void loadUsernameControl(target, detected);
      return;
    }

    clearActiveControl();
  }

  async function loadPasswordControl(
    field: HTMLInputElement,
    detected: DetectedCredentialForm,
  ): Promise<void> {
    if (detected.registration) {
      activeMatches = [];
      actionControl.show(field, "Generate", generateAndShow);
      return;

      function generateAndShow(): void {
        const password = generatePassword();
        fillGeneratedPassword(detected, password);
        actionControl.showGenerated(field, password, () => {
          const nextPassword = generatePassword();
          fillGeneratedPassword(detected, nextPassword);
          return nextPassword;
        });
      }
    }

    const response = await sendMessage<CredentialSummary[]>({
      type: "GET_MATCHES",
      url: location.href,
      usernameHint: accountUsernameHint(),
    });
    if (!response.ok || response.data.length === 0 || activeForm !== detected) {
      actionControl.hide();
      return;
    }

    activeMatches = response.data;
    actionControl.showChoices(field, activeMatches, (match) => {
      void sendMessage({
        type: "FILL_CREDENTIAL",
        entryId: match.entryId,
        url: location.href,
        usernameHint: accountUsernameHint(),
        vaultId: match.vaultId,
      });
    });
  }

  async function loadUsernameControl(
    field: HTMLInputElement,
    detected: DetectedUsernameStep,
  ): Promise<void> {
    const response = await sendMessage<CredentialSummary[]>({
      type: "GET_MATCHES",
      url: location.href,
      usernameHint: field.value.trim() || accountUsernameHint(),
    });
    if (
      !response.ok ||
      response.data.length === 0 ||
      activeUsernameStep !== detected
    ) {
      actionControl.hide();
      return;
    }

    activeMatches = response.data;
    actionControl.showChoices(field, activeMatches, (match) => {
      void sendMessage({
        type: "FILL_CREDENTIAL",
        entryId: match.entryId,
        url: location.href,
        usernameHint: field.value.trim() || accountUsernameHint(),
        vaultId: match.vaultId,
      });
    });
  }

  function clearActiveControl(): void {
    activeForm = null;
    activeUsernameStep = null;
    actionControl.hide();
  }

  async function captureSubmission(form: HTMLFormElement): Promise<void> {
    const previousCapture = capturedAt.get(form) ?? 0;
    if (Date.now() - previousCapture < 1_000) return;
    capturedAt.set(form, Date.now());

    const detected = Array.from(
      form.querySelectorAll<HTMLInputElement>(
        'input[type="password"], input[autocomplete="current-password"], input[autocomplete="new-password"]',
      ),
    )
      .map((input) => detectCredentialForm(input))
      .find((candidate) => candidate !== null);
    if (!detected) {
      await captureUsernameStep(form);
      return;
    }

    await captureDetectedCredential(detected);
  }

  async function captureActiveStep(): Promise<void> {
    if (Date.now() - lastActiveCaptureAt < 1_000) return;
    lastActiveCaptureAt = Date.now();

    const detected = activeForm ?? findFirstCredentialForm();
    if (detected) {
      await captureDetectedCredential(detected);
      return;
    }

    const usernameStep = activeUsernameStep ?? findFirstUsernameStep();
    const username = usernameStep?.usernameInput.value.trim();
    if (username) await rememberUsername(username);
  }

  async function captureDetectedCredential(
    detected: DetectedCredentialForm,
  ): Promise<void> {
    const credential = readCredential(detected);
    if (!credential) return;

    try {
      const response = await sendMessage<PendingCredentialSummary | null>({
        type: "CREDENTIAL_SUBMITTED",
        credential: {
          pageTitle: document.title,
          password: credential.password,
          url: location.href,
          username:
            credential.username ||
            (location.hostname === "accounts.google.com"
              ? readVisibleAccountIdentifier()
              : ""),
        },
      });

      if (response.ok && response.data) scheduleSavePrompt(response.data);
    } catch {
      // Navigation can destroy this context after the candidate was delivered.
    }
  }

  async function captureUsernameStep(form: HTMLFormElement): Promise<void> {
    const candidates = Array.from(
      form.querySelectorAll<HTMLInputElement>("input"),
    );
    const detected = candidates
      .map((input) => detectUsernameStep(input))
      .find((candidate) => candidate !== null);
    const username = detected?.usernameInput.value.trim();
    if (!username) return;
    await rememberUsername(username);
  }

  async function rememberUsername(username: string): Promise<void> {
    try {
      await sendMessage({
        type: "USERNAME_STEP_SUBMITTED",
        url: location.href,
        username,
      });
    } catch {
      // Navigation can destroy this context after the username was delivered.
    }
  }

  function scheduleSavePrompt(pending: PendingCredentialSummary): void {
    if (savePromptTimer !== null) {
      window.clearTimeout(savePromptTimer);
    }

    // Most successful logins navigate immediately. Waiting avoids briefly
    // rendering a prompt that the old document will destroy. The destination
    // document reads the session-backed pending credential and renders it once.
    savePromptTimer = window.setTimeout(() => {
      savePromptTimer = null;
      void getPendingCredential().then((current) => {
        if (current?.id === pending.id) renderSavePrompt(current);
      });
    }, SAME_PAGE_SAVE_PROMPT_DELAY_MS);
  }
}

function createActionControl(): {
  feedback: (label: string) => void;
  hide: () => void;
  ownsEvent: (event: Event) => boolean;
  reposition: () => void;
  show: (field: HTMLInputElement, label: string, action: () => void) => void;
  showChoices: (
    field: HTMLInputElement,
    matches: CredentialSummary[],
    onSelect: (match: CredentialSummary) => void,
  ) => void;
  showGenerated: (
    field: HTMLInputElement,
    password: string,
    onRegenerate: () => string,
  ) => void;
} {
  const host = document.createElement("div");
  host.style.cssText =
    "all:initial;position:fixed;z-index:2147483647;display:none;";
  document.documentElement.append(host);
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; }
    .wrap {
      position: relative;
      display: flex;
      justify-content: flex-end;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    }
    button {
      all: initial;
      box-sizing: border-box;
      display: inline-flex;
      min-height: 30px;
      max-width: min(280px, calc(100vw - 12px));
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      color: #f8f8f6;
      background: linear-gradient(135deg, #303664, #505ab3);
      border: 1px solid #5964bd;
      border-radius: 8px;
      box-shadow: 0 8px 22px rgb(62 70 145 / 25%);
      cursor: pointer;
      font: 700 12px/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
    }
    button:hover { background: linear-gradient(135deg, #394176, #5a65c2); }
    .button-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .menu {
      position: absolute;
      top: 36px;
      right: 0;
      display: none;
      width: min(260px, calc(100vw - 12px));
      padding: 6px;
      background: white;
      border: 1px solid #d8dcfa;
      border-radius: 10px;
      box-shadow: 0 14px 40px rgb(5 9 18 / 24%);
    }
    .menu.open { display: grid; gap: 4px; }
    .wrap.generated {
      width: 100%;
    }
    .wrap.generated > button {
      display: none;
    }
    .wrap.generated .menu {
      position: static;
      display: grid;
      width: 100%;
      gap: 8px;
      padding: 10px;
    }
    .generated-value {
      display: block;
      padding: 9px 10px;
      overflow-wrap: anywhere;
      color: #202746;
      background: #f1f2ff;
      border: 1px solid #d8dcfa;
      border-radius: 7px;
      user-select: all;
      font: 700 12px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .generated-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
    .menu .generated-actions button {
      display: inline-flex;
      width: auto;
      padding: 6px 9px;
      color: #303664;
      background: #eef0ff;
      border: 1px solid #d8dcfa;
    }
    .menu .generated-actions button:hover {
      background: #e4e7ff;
    }
    .menu .generated-actions .hide-generated {
      color: #f8f8f6;
      background: linear-gradient(135deg, #303664, #505ab3);
      border-color: #5964bd;
    }
    .menu button {
      display: grid;
      width: 100%;
      gap: 2px;
      padding: 8px 9px;
      color: #273044;
      background: #f7f7fc;
      border-color: transparent;
      box-shadow: none;
      text-align: left;
    }
    .menu button:hover { background: #eef0ff; }
    .menu strong,
    .menu small {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .menu strong { color: #303664; font: 700 12px/1.25 Inter, sans-serif; }
    .menu small { color: #70778a; font: 500 10px/1.25 Inter, sans-serif; }
  `;
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  const button = document.createElement("button");
  button.type = "button";
  const icon = document.createElement("span");
  icon.textContent = "◆";
  const label = document.createElement("span");
  label.className = "button-label";
  const menu = document.createElement("div");
  menu.className = "menu";
  button.append(icon, label);
  wrap.append(button, menu);
  shadow.append(style, wrap);

  let anchor: HTMLInputElement | null = null;
  let clickAction: (() => void) | null = null;
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    anchor?.blur();
  });
  button.addEventListener("click", () => {
    clickAction?.();
  });

  function reposition() {
    if (!anchor?.isConnected || host.style.display === "none") return;
    const rect = anchor.getBoundingClientRect();
    if (wrap.classList.contains("generated")) {
      const width = Math.min(Math.max(280, rect.width), window.innerWidth - 12);
      const controlHeight = host.getBoundingClientRect().height;
      const below = rect.bottom + 6;
      const top =
        below + controlHeight <= window.innerHeight - 6
          ? below
          : Math.max(6, rect.top - controlHeight - 6);
      host.style.width = `${width}px`;
      host.style.top = `${top}px`;
      host.style.left = `${Math.min(
        Math.max(6, rect.left),
        window.innerWidth - width - 6,
      )}px`;
      return;
    }

    host.style.width = "auto";
    const controlWidth = host.getBoundingClientRect().width;
    host.style.top = `${Math.max(6, rect.top + (rect.height - 30) / 2)}px`;
    host.style.left = `${Math.max(6, rect.right - controlWidth)}px`;
  }

  function hideControl(): void {
    host.style.display = "none";
    wrap.classList.remove("generated");
    menu.classList.remove("open");
    anchor = null;
    clickAction = null;
  }

  return {
    feedback(value) {
      label.textContent = value;
      wrap.classList.remove("generated");
      menu.classList.remove("open");
      window.setTimeout(() => {
        host.style.display = "none";
      }, 900);
    },
    hide: hideControl,
    ownsEvent(event) {
      return event.composedPath().includes(host);
    },
    reposition,
    show(field, value, action) {
      anchor = field;
      clickAction = action;
      label.textContent = value;
      button.title = "";
      wrap.classList.remove("generated");
      menu.replaceChildren();
      host.style.display = "block";
      reposition();
    },
    showChoices(field, matches, onSelect) {
      anchor = field;
      wrap.classList.remove("generated");
      label.textContent =
        matches.length === 1
          ? `Sign in as ${matches[0]?.username || matches[0]?.name || "saved login"}`
          : "Choose KeyNest login";
      button.title = "Fills the saved username and password";
      menu.replaceChildren();

      for (const match of matches) {
        const option = document.createElement("button");
        option.type = "button";
        const optionName = document.createElement("strong");
        optionName.textContent = match.name;
        const optionPreview = document.createElement("small");
        optionPreview.textContent = match.username
          ? `${match.username} · username + password`
          : "Saved password";
        option.append(optionName, optionPreview);
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
          anchor?.blur();
        });
        option.addEventListener("click", () => {
          menu.classList.remove("open");
          onSelect(match);
        });
        menu.append(option);
      }

      clickAction =
        matches.length === 1
          ? () => {
              const match = matches[0];
              if (match) onSelect(match);
            }
          : () => menu.classList.toggle("open");
      host.style.display = "block";
      reposition();
    },
    showGenerated(field, password, onRegenerate) {
      anchor = field;
      clickAction = null;
      wrap.classList.add("generated");
      menu.replaceChildren();

      const value = document.createElement("code");
      value.className = "generated-value";
      value.textContent = password;

      const actions = document.createElement("div");
      actions.className = "generated-actions";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy";
      const regenerate = document.createElement("button");
      regenerate.type = "button";
      regenerate.textContent = "Regenerate";
      const hide = document.createElement("button");
      hide.type = "button";
      hide.className = "hide-generated";
      hide.textContent = "Hide";
      actions.append(copy, regenerate, hide);
      menu.append(value, actions);

      let currentPassword = password;
      for (const action of [copy, regenerate, hide]) {
        action.addEventListener("mousedown", (event) => event.preventDefault());
      }
      copy.addEventListener("click", () => {
        void navigator.clipboard
          .writeText(currentPassword)
          .then(() => {
            copy.textContent = "Copied";
            window.setTimeout(() => {
              copy.textContent = "Copy";
            }, 1_200);
          })
          .catch(() => {
            copy.textContent = "Copy failed";
          });
      });
      regenerate.addEventListener("click", () => {
        currentPassword = onRegenerate();
        value.textContent = currentPassword;
      });
      hide.addEventListener("click", hideControl);

      host.style.display = "block";
      menu.classList.add("open");
      reposition();
    },
  };
}

function renderSavePrompt(pending: PendingCredentialSummary): void {
  document.querySelector("[data-pm-save-prompt]")?.remove();

  const host = document.createElement("div");
  host.dataset.pmSavePrompt = "";
  host.style.cssText =
    "all:initial;position:fixed;z-index:2147483647;top:18px;right:18px;";
  document.documentElement.append(host);
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; }
    article {
      width: min(340px, calc(100vw - 36px));
      padding: 16px;
      color: #111827;
      background: #fff;
      border: 1px solid #dfe3ea;
      border-radius: 14px;
      box-shadow: 0 18px 55px rgb(5 9 18 / 24%);
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    }
    header { display: flex; align-items: flex-start; gap: 10px; }
    .mark {
      display: grid;
      width: 34px;
      height: 34px;
      flex: 0 0 auto;
      color: #505ab3;
      background: #eef0ff;
      border: 1px solid #d8dcfa;
      border-radius: 9px;
      place-items: center;
      font-size: 15px;
    }
    h2 { margin: 0; font-size: 14px; line-height: 1.3; }
    p {
      margin: 4px 0 0;
      overflow: hidden;
      color: #677083;
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    button {
      all: initial;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      font: 700 12px/1 Inter, ui-sans-serif, system-ui, sans-serif;
    }
    .dismiss { color: #677083; }
    .save {
      color: #f8f8f6;
      background: linear-gradient(135deg, #303664, #505ab3);
    }
    .save:disabled { cursor: wait; opacity: .65; }
    .error { color: #b72e3e; white-space: normal; }
  `;
  const article = document.createElement("article");
  const header = document.createElement("header");
  const mark = document.createElement("span");
  mark.className = "mark";
  mark.textContent = "◆";
  const copy = document.createElement("div");
  const heading = document.createElement("h2");
  heading.textContent =
    pending.action === "update"
      ? `Update password for ${pending.siteName}?`
      : pending.action === "link"
        ? `Save ${pending.siteName} for this website?`
        : `Save login for ${pending.siteName}?`;
  const username = document.createElement("p");
  username.textContent = pending.username || "No username";
  copy.append(heading, username);
  header.append(mark, copy);
  const footer = document.createElement("footer");
  const dismiss = document.createElement("button");
  dismiss.className = "dismiss";
  dismiss.textContent = "Not now";
  const save = document.createElement("button");
  save.className = "save";
  save.textContent = pending.action === "update" ? "Update" : "Save";
  footer.append(dismiss, save);
  article.append(header, footer);
  shadow.append(style, article);

  dismiss.addEventListener("click", () => {
    host.remove();
    void sendMessage({
      type: "DISMISS_PENDING_CREDENTIAL",
      pendingId: pending.id,
    });
  });
  save.addEventListener("click", () => {
    save.disabled = true;
    save.textContent = pending.action === "update" ? "Updating…" : "Saving…";
    void sendMessage({
      type: "CONFIRM_PENDING_CREDENTIAL",
      pendingId: pending.id,
    }).then((response) => {
      if (response.ok) {
        heading.textContent =
          pending.action === "update"
            ? "Password updated"
            : pending.action === "link"
              ? "Login linked to this website"
              : "Login saved";
        footer.remove();
        window.setTimeout(() => host.remove(), 1_200);
        return;
      }

      username.className = "error";
      username.textContent = response.error;
      save.disabled = false;
      save.textContent = pending.action === "update" ? "Update" : "Save";
    });
  });
}

async function getPendingCredential(): Promise<PendingCredentialSummary | null> {
  const response = await sendMessage<PendingCredentialSummary | null>({
    type: "GET_PENDING_CREDENTIAL",
  });
  return response.ok ? response.data : null;
}

function sendMessage<T = unknown>(
  message: RuntimeRequest,
): Promise<RuntimeResponse<T>> {
  return browser.runtime.sendMessage(message);
}

function isContentMessage(
  value: unknown,
): value is Exclude<
  ContentMessage,
  { type: "APPLY_IDENTITY" | "GET_IDENTITY_FORM_STATUS" }
> {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<ContentMessage>;
  return (
    (message.type === "APPLY_CREDENTIAL" &&
      typeof message.username === "string" &&
      typeof message.password === "string") ||
    (message.type === "APPLY_GENERATED_PASSWORD" &&
      typeof message.password === "string") ||
    message.type === "GET_PAGE_USERNAME_HINT"
  );
}

function isPasswordManagerWebApp(): boolean {
  try {
    return location.origin === new URL(WEB_APP_URL).origin;
  } catch {
    return false;
  }
}

function accountUsernameHint(): string {
  return location.hostname === "accounts.google.com"
    ? readVisibleAccountIdentifier()
    : "";
}
