import { browser } from "wxt/browser";
import type {
  ContentMessage,
  IdentityFillMode,
  IdentitySummary,
  RuntimeRequest,
  RuntimeResponse,
} from "../lib/types";
import {
  detectIdentityFields,
  fillIdentity,
  fillIdentityEmail,
  hasIdentityForm,
  identityFillModeForControl,
  type IdentityControl,
} from "../content/identity-form";
import { identitiesForFillMode } from "../content/identity-options";
import { detectUsernameStep } from "../content/form-detection";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    installIdentityIntegration();
  },
});

function installIdentityIntegration(): void {
  const actionControl = createIdentityActionControl();
  let identities: IdentitySummary[] = [];
  let activeAnchor: IdentityControl | null = null;

  browser.runtime.onMessage.addListener(
    // WXT supports Promise responses despite the legacy listener type.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    (message: unknown) => {
      if (!isIdentityMessage(message)) return undefined;
      if (message.type === "GET_IDENTITY_FORM_STATUS") {
        return Promise.resolve({
          available: hasIdentityForm(),
          fieldCount: detectIdentityFields().length,
        });
      }
      const fill =
        message.mode === "email"
          ? Promise.resolve(fillIdentityEmail(message.identity, activeAnchor))
          : fillIdentity(message.identity);
      return fill.then((result) => {
        if (result.filled > 0) actionControl.hide();
        else actionControl.feedback("Nothing to fill");
        return result;
      });
    },
  );

  document.addEventListener(
    "focusin",
    (event) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        const control = event.target;
        const mode = !(
          control instanceof HTMLInputElement && detectUsernameStep(control)
        )
          ? identityFillModeForControl(control)
          : null;
        if (mode && identities.length === 0) {
          activeAnchor = control;
          void loadIdentities().then(() => {
            if (
              identities.length === 0 ||
              !control.isConnected ||
              activeAnchor !== control
            ) {
              actionControl.hide();
              return;
            }
            showIdentityControl(control, mode);
          });
        } else if (mode) {
          activeAnchor = control;
          showIdentityControl(control, mode);
        } else {
          actionControl.hide();
        }
      } else {
        actionControl.hide();
      }
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target === activeAnchor &&
        identities.length > 0 &&
        (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement)
      ) {
        const mode =
          event.target instanceof HTMLInputElement &&
          detectUsernameStep(event.target)
            ? null
            : identityFillModeForControl(event.target);
        if (mode) showIdentityControl(event.target, mode);
      }
    },
    true,
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.target !== activeAnchor && !actionControl.ownsEvent(event)) {
        actionControl.hide();
      }
    },
    true,
  );

  window.addEventListener(
    "scroll",
    () => {
      actionControl.hide();
    },
    true,
  );
  window.addEventListener("resize", actionControl.hide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void loadIdentities();
    }
  });

  void loadIdentities();

  async function loadIdentities(): Promise<void> {
    const response = await sendMessage<IdentitySummary[]>({
      type: "GET_IDENTITIES",
    });
    identities = response.ok ? response.data : [];
  }

  function showIdentityControl(
    anchor: IdentityControl,
    mode: IdentityFillMode,
  ): void {
    const availableIdentities = identitiesForFillMode(identities, mode);
    if (availableIdentities.length === 0) {
      actionControl.hide();
      return;
    }
    actionControl.show(anchor, availableIdentities, mode, requestFill);
  }

  async function requestFill(
    identity: IdentitySummary,
    mode: IdentityFillMode,
  ): Promise<void> {
    const response = await sendMessage({
      type: "FILL_IDENTITY",
      entryId: identity.entryId,
      mode,
      vaultId: identity.vaultId,
    });
    if (!response.ok) {
      actionControl.feedback(response.error);
    }
  }
}

function createIdentityActionControl(): {
  feedback: (label: string) => void;
  hide: () => void;
  ownsEvent: (event: Event) => boolean;
  reposition: () => void;
  show: (
    anchor: IdentityControl,
    identities: IdentitySummary[],
    mode: IdentityFillMode,
    onSelect: (
      identity: IdentitySummary,
      mode: IdentityFillMode,
    ) => Promise<void>,
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
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 30px;
      max-width: min(280px, calc(100vw - 12px));
      padding: 6px 10px;
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
    .wrap.menu-only {
      width: 100%;
      justify-content: stretch;
    }
    .wrap.menu-only > button { display: none; }
    .wrap.menu-only .menu {
      position: static;
      display: grid;
      width: 100%;
      gap: 4px;
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

  let anchor: IdentityControl | null = null;
  let currentIdentities: IdentitySummary[] = [];
  let fillMode: IdentityFillMode = "identity";
  let selectIdentity:
    | ((identity: IdentitySummary, mode: IdentityFillMode) => Promise<void>)
    | null = null;
  let hideTimer: number | null = null;

  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => {
    if (currentIdentities.length === 1) {
      const identity = currentIdentities[0];
      if (identity) void selectIdentity?.(identity, fillMode);
      return;
    }
    menu.classList.toggle("open");
  });

  function reposition() {
    if (!anchor?.isConnected || host.style.display === "none") return;
    const rect = anchor.getBoundingClientRect();
    if (wrap.classList.contains("menu-only")) {
      const width = Math.min(rect.width, window.innerWidth - 12);
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
    host.style.top = `${Math.max(6, rect.top - 34)}px`;
    host.style.left = `${Math.max(6, rect.right - controlWidth)}px`;
  }

  return {
    feedback(value) {
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      label.textContent = value;
      menu.classList.remove("open");
      wrap.classList.remove("menu-only");
      reposition();
      hideTimer = window.setTimeout(() => {
        host.style.display = "none";
        hideTimer = null;
      }, 1_200);
    },
    hide() {
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      hideTimer = null;
      host.style.display = "none";
      menu.classList.remove("open");
      anchor = null;
    },
    ownsEvent(event) {
      return event.composedPath().includes(host);
    },
    reposition,
    show(field, availableIdentities, mode, onSelect) {
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        host.style.display = "none";
        hideTimer = null;
      }, 8_000);
      anchor = field;
      currentIdentities = availableIdentities;
      fillMode = mode;
      selectIdentity = onSelect;
      wrap.classList.add("menu-only");
      label.textContent = "KeyNest suggestions";
      menu.replaceChildren();
      for (const identity of availableIdentities) {
        const option = document.createElement("button");
        option.type = "button";
        const optionName = document.createElement("strong");
        optionName.textContent = identity.email;
        const optionPreview = document.createElement("small");
        optionPreview.textContent =
          mode === "email"
            ? identity.name
            : `${identity.name} · Email and address`;
        option.append(optionName, optionPreview);
        option.addEventListener("mousedown", (event) => event.preventDefault());
        option.addEventListener("click", () => {
          void onSelect(identity, mode);
        });
        menu.append(option);
      }
      host.style.display = "block";
      menu.classList.add("open");
      reposition();
    },
  };
}

function sendMessage<T = unknown>(
  message: RuntimeRequest,
): Promise<RuntimeResponse<T>> {
  return browser.runtime.sendMessage(message);
}

function isIdentityMessage(
  value: unknown,
): value is Extract<
  ContentMessage,
  { type: "APPLY_IDENTITY" | "GET_IDENTITY_FORM_STATUS" }
> {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<ContentMessage>;
  return (
    message.type === "GET_IDENTITY_FORM_STATUS" ||
    (message.type === "APPLY_IDENTITY" &&
      typeof message.identity === "object" &&
      message.identity !== null &&
      message.identity.type === "identity" &&
      (message.mode === "email" || message.mode === "identity"))
  );
}
