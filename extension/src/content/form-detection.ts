export interface DetectedCredentialForm {
  form: HTMLFormElement | null;
  passwordInputs: HTMLInputElement[];
  registration: boolean;
  usernameInput: HTMLInputElement | null;
}

export interface DetectedUsernameStep {
  form: HTMLFormElement | null;
  usernameInput: HTMLInputElement;
}

const USERNAME_HINT = /(?:email|login|user(?:name)?)/iu;
const LOGIN_HINT = /(?:account|continue|log.{0,3}in|next|sign.{0,3}in)/iu;
const REGISTRATION_HINT =
  /(?:create.{0,12}account|join|register|sign.{0,3}up|signup|creeaza.{0,8}cont|creare.{0,8}cont|inregistrare|crear.{0,8}cuenta|creer.{0,8}compte|konto.{0,8}erstellen|registrieren)/iu;
const MASTER_PASSWORD_HINT = /(?:master password|unlock.{0,12}vault)/iu;
const ONE_TIME_CODE_HINT =
  /\b(?:otp|totp|2fa|mfa|one time (?:code|passcode|password)|single use code|verification code|verify code|security code|authentication code|confirmation code|email code|sms code|passcode|cod unic|cod de verificare|cod autentificare|cod confirmare)\b/u;
const CODE_FIELD_HINT =
  /\b(?:code|codigo|codice|cod|pin|token|otp|passcode)\b/u;
const VERIFICATION_CONTEXT_HINT =
  /\b(?:verify|verification|verificare|verificacion|verifizierung|authenticate|authentication|autentificare|confirm|confirmation|confirmare|two factor|2fa|mfa|one time|single use|sent|trimis)\b/u;

export function detectCredentialForm(
  passwordInput: HTMLInputElement,
): DetectedCredentialForm | null {
  if (
    !isPasswordInput(passwordInput) ||
    !isUsableInput(passwordInput) ||
    isOneTimeCodeInput(passwordInput)
  ) {
    return null;
  }

  const form = passwordInput.form;
  if (
    form &&
    MASTER_PASSWORD_HINT.test(
      [
        form.id,
        form.name,
        form.getAttribute("aria-label") ?? "",
        form.textContent?.slice(0, 500) ?? "",
      ].join(" "),
    )
  ) {
    return null;
  }

  const scope: ParentNode = form ?? document;
  const passwordInputs = Array.from(
    scope.querySelectorAll<HTMLInputElement>(
      'input[type="password"], input[autocomplete="current-password"], input[autocomplete="new-password"]',
    ),
  ).filter(isUsableInput);

  if (passwordInputs.length === 0) return null;

  return {
    form,
    passwordInputs,
    registration: isRegistrationForm(form, passwordInputs),
    usernameInput: findUsernameInput(scope, passwordInputs[0]),
  };
}

export function findFirstCredentialForm(): DetectedCredentialForm | null {
  const passwordInput = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[type="password"], input[autocomplete="current-password"], input[autocomplete="new-password"]',
    ),
  ).find(isUsableInput);

  return passwordInput ? detectCredentialForm(passwordInput) : null;
}

export function detectUsernameStep(
  usernameInput: HTMLInputElement,
): DetectedUsernameStep | null {
  if (
    !isUsableInput(usernameInput) ||
    isOneTimeCodeInput(usernameInput) ||
    !isPotentialUsernameInput(usernameInput)
  ) {
    return null;
  }

  const form = usernameInput.form;
  if (isRegistrationStep(usernameInput)) return null;
  const formHints = form
    ? [
        form.action,
        form.id,
        form.name,
        form.getAttribute("aria-label") ?? "",
        form.textContent?.slice(0, 500) ?? "",
      ].join(" ")
    : "";
  const hasLoginPassword =
    form !== null &&
    Array.from(
      form.querySelectorAll<HTMLInputElement>(
        'input[type="password"], input[autocomplete="current-password"]',
      ),
    ).some(
      (input) =>
        isUsableInput(input) &&
        input.autocomplete !== "new-password" &&
        !isOneTimeCodeInput(input),
    );
  const explicitUsername = usernameInput.autocomplete === "username";

  if (!explicitUsername && !hasLoginPassword && !LOGIN_HINT.test(formHints)) {
    return null;
  }
  return { form, usernameInput };
}

export function findFirstUsernameStep(): DetectedUsernameStep | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="username"], input[autocomplete="email"], input[type="email"]',
    ),
  );

  for (const input of candidates) {
    const detected = detectUsernameStep(input);
    if (detected) return detected;
  }
  return null;
}

export function readCredential(
  detected: DetectedCredentialForm,
): { password: string; username: string } | null {
  const password = selectSubmittedPassword(detected);
  if (!password) return null;

  return {
    password,
    username: detected.usernameInput?.value ?? "",
  };
}

export function fillCredential(
  detected: DetectedCredentialForm,
  username: string,
  password: string,
): void {
  if (detected.usernameInput && username) {
    setInputValue(detected.usernameInput, username);
  }

  const target =
    detected.passwordInputs.find(
      (input) => input.autocomplete === "current-password",
    ) ?? detected.passwordInputs[0];
  if (target) setInputValue(target, password);
}

export function fillUsernameStep(
  detected: DetectedUsernameStep,
  username: string,
): void {
  if (username) setInputValue(detected.usernameInput, username);
}

export function readVisibleAccountIdentifier(
  root: ParentNode = document,
): string {
  const selectors = [
    "[data-profile-identifier]",
    "#profileIdentifier",
    "#email-display",
  ];

  for (const selector of selectors) {
    const element = root.querySelector<HTMLElement>(selector);
    const candidate =
      element?.getAttribute("data-profile-identifier") ??
      element?.textContent ??
      "";
    const email = candidate.match(
      /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
    )?.[0];
    if (email) return email;
  }

  const visibleEmails = Array.from(
    new Set(
      Array.from(
        (root instanceof Document
          ? root.body?.innerText
          : (root.textContent ?? "")
        )?.matchAll(
          /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu,
        ) ?? [],
        (match) => match[0],
      ),
    ),
  );
  if (visibleEmails.length === 1) return visibleEmails[0] ?? "";
  return "";
}

export function fillGeneratedPassword(
  detected: DetectedCredentialForm,
  password: string,
): void {
  const newPasswordInputs = detected.passwordInputs.filter(
    (input) => input.autocomplete === "new-password",
  );
  const targets =
    newPasswordInputs.length > 0
      ? newPasswordInputs
      : detected.registration
        ? detected.passwordInputs
        : [detected.passwordInputs[0]].filter(
            (input): input is HTMLInputElement => input !== undefined,
          );

  for (const input of targets) setInputValue(input, password);
}

export function isPasswordInput(
  value: EventTarget | null,
): value is HTMLInputElement {
  return (
    value instanceof HTMLInputElement &&
    (value.type === "password" ||
      value.autocomplete === "current-password" ||
      value.autocomplete === "new-password")
  );
}

export function isPotentialUsernameInput(
  value: EventTarget | null,
): value is HTMLInputElement {
  if (!(value instanceof HTMLInputElement) || isOneTimeCodeInput(value)) {
    return false;
  }
  return (
    value.autocomplete === "username" ||
    value.autocomplete === "email" ||
    value.type === "email" ||
    (["", "text"].includes(value.type) &&
      USERNAME_HINT.test(
        [value.name, value.id, value.placeholder, value.ariaLabel]
          .filter(Boolean)
          .join(" "),
      ))
  );
}

export function isOneTimeCodeInput(input: HTMLInputElement): boolean {
  const autocompleteTokens = (input.getAttribute("autocomplete") ?? "")
    .toLocaleLowerCase()
    .split(/\s+/u);
  if (autocompleteTokens.includes("one-time-code")) return true;

  const fieldHints = normalizedHints([
    input.name,
    input.id,
    input.placeholder,
    input.ariaLabel,
    ...Array.from(input.labels ?? []).map((label) => label.textContent ?? ""),
  ]);
  if (ONE_TIME_CODE_HINT.test(fieldHints)) return true;

  const contextHints = normalizedHints([
    input.form?.id,
    input.form?.name,
    input.form?.getAttribute("aria-label"),
    input.form?.textContent?.slice(0, 1_000),
    input.closest("fieldset")?.textContent?.slice(0, 600),
  ]);
  const shortInput =
    (input.maxLength > 0 && input.maxLength <= 10) ||
    (input.size > 0 && input.size <= 10);
  const numericInput =
    input.type === "number" ||
    input.inputMode === "numeric" ||
    input.inputMode === "decimal" ||
    /(?:\\d|\[0-9\])/u.test(input.pattern);

  return (
    CODE_FIELD_HINT.test(fieldHints) &&
    (VERIFICATION_CONTEXT_HINT.test(contextHints) ||
      (numericInput && shortInput))
  );
}

export function isRegistrationStep(input: HTMLInputElement): boolean {
  const form = input.form;
  if (!form) return false;
  const passwordInputs = Array.from(
    form.querySelectorAll<HTMLInputElement>(
      'input[type="password"], input[autocomplete="new-password"]',
    ),
  ).filter(isUsableInput);
  return isRegistrationForm(form, passwordInputs);
}

function findUsernameInput(
  scope: ParentNode,
  firstPasswordInput: HTMLInputElement | undefined,
): HTMLInputElement | null {
  const candidates = Array.from(
    scope.querySelectorAll<HTMLInputElement>(
      'input:not([type="password"]):not([type="hidden"])',
    ),
  ).filter(
    (input) =>
      isUsableInput(input) &&
      !isOneTimeCodeInput(input) &&
      ["", "email", "tel", "text"].includes(input.type) &&
      (!firstPasswordInput ||
        !(
          input.compareDocumentPosition(firstPasswordInput) &
          Node.DOCUMENT_POSITION_PRECEDING
        )),
  );

  return (
    candidates
      .map((input, index) => ({
        input,
        score: usernameScore(input) + index / Math.max(candidates.length, 1),
      }))
      .sort((left, right) => right.score - left.score)[0]?.input ?? null
  );
}

function usernameScore(input: HTMLInputElement): number {
  if (input.autocomplete === "username") return 100;
  if (input.autocomplete === "email") return 95;
  if (input.type === "email") return 80;

  const hints = [input.name, input.id, input.placeholder, input.ariaLabel]
    .filter(Boolean)
    .join(" ");
  return USERNAME_HINT.test(hints) ? 60 : 10;
}

function isRegistrationForm(
  form: HTMLFormElement | null,
  passwordInputs: HTMLInputElement[],
): boolean {
  if (
    passwordInputs.some((input) => input.autocomplete === "new-password") ||
    passwordInputs.length > 1
  ) {
    return true;
  }

  if (!form) return false;
  const hints = normalizedHints([
    form.action,
    form.id,
    form.name,
    form.getAttribute("aria-label"),
    form.textContent?.slice(0, 500),
  ]);
  return REGISTRATION_HINT.test(hints);
}

function selectSubmittedPassword(detected: DetectedCredentialForm): string {
  const newPassword = detected.passwordInputs.find(
    (input) => input.autocomplete === "new-password" && input.value,
  );
  if (newPassword) return newPassword.value;

  const populated = detected.passwordInputs.filter((input) => input.value);
  if (detected.registration && populated.length > 1) {
    const last = populated.at(-1);
    const previous = populated.at(-2);
    if (last?.value === previous?.value) return last?.value ?? "";
  }

  return populated[0]?.value ?? "";
}

function setInputValue(input: HTMLInputElement, value: string): void {
  // The native setter lets controlled framework inputs observe the update.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function isUsableInput(input: HTMLInputElement): boolean {
  if (
    input.disabled ||
    input.readOnly ||
    input.type === "hidden" ||
    input.hidden ||
    input.getAttribute("aria-hidden") === "true"
  ) {
    return false;
  }

  const style = input.ownerDocument.defaultView?.getComputedStyle(input);
  return style?.display !== "none" && style?.visibility !== "hidden";
}

function normalizedHints(values: Array<string | null | undefined>): string {
  return values
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[-_.:/[\]()]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
