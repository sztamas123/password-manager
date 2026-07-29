import type { IdentityData, IdentityFillMode } from "../lib/types";
import { isOneTimeCodeInput } from "./form-detection";

export type IdentityFieldKey =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "phone"
  | "country"
  | "addressLine1"
  | "addressLine2"
  | "region"
  | "city"
  | "postalCode";

export type IdentityControl =
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface DetectedIdentityField {
  control: IdentityControl;
  key: IdentityFieldKey;
}

export interface IdentityFillResult {
  detected: number;
  filled: number;
}

const AUTOCOMPLETE_FIELDS: Record<string, IdentityFieldKey> = {
  "given-name": "firstName",
  "family-name": "lastName",
  name: "fullName",
  email: "email",
  tel: "phone",
  "tel-national": "phone",
  country: "country",
  "country-name": "country",
  "street-address": "addressLine1",
  "address-line1": "addressLine1",
  "address-line2": "addressLine2",
  "address-level1": "region",
  "address-level2": "city",
  "postal-code": "postalCode",
};

const PAYMENT_FIELD =
  /\b(?:card|cardholder|credit|debit|cvv|cvc|iban|payment|plata|expir|cc-number|cc-name|cc-exp|cc-csc)\b/u;

export function detectIdentityFields(
  root: ParentNode = document,
): DetectedIdentityField[] {
  const controls = Array.from(
    root.querySelectorAll<IdentityControl>("input, select, textarea"),
  );
  const classified = controls
    .map((control) => {
      const key = classifyIdentityControl(control);
      return key ? { control, key } : null;
    })
    .filter((field): field is DetectedIdentityField => field !== null);
  const candidates = fieldsFromBestForm(classified);
  const seen = new Set<IdentityFieldKey>();
  const detected: DetectedIdentityField[] = [];

  for (const field of candidates) {
    if (seen.has(field.key)) continue;
    seen.add(field.key);
    detected.push(field);
  }

  return detected;
}

export function hasIdentityForm(root: ParentNode = document): boolean {
  return isIdentityFieldGroup(detectIdentityFields(root));
}

export function identityFillModeForControl(
  control: IdentityControl,
  root: ParentNode = document,
): IdentityFillMode | null {
  if (classifyIdentityControl(control) !== "email") return null;

  // A page can contain several unrelated forms. Determine whether this email
  // belongs to a full identity form using its own form rather than whichever
  // form received the highest page-wide identity score.
  const fields = detectIdentityFields(control.form ?? root);
  if (
    fields.some((field) => field.control === control) &&
    isIdentityFieldGroup(fields)
  ) {
    return "identity";
  }
  return "email";
}

export async function fillIdentity(
  identity: IdentityData,
  root: ParentNode = document,
): Promise<IdentityFillResult> {
  const initiallyDetected = detectIdentityFields(root);
  const filled = new Set<IdentityFieldKey>();
  const orderedKeys: IdentityFieldKey[] = [
    "country",
    "region",
    "city",
    "firstName",
    "lastName",
    "fullName",
    "addressLine1",
    "addressLine2",
    "postalCode",
    "phone",
    "email",
  ];

  for (const key of orderedKeys) {
    const field = detectIdentityFields(root).find(
      (candidate) => candidate.key === key,
    );
    const value = valueForField(identity, key);
    if (!field || !value) continue;

    const changed =
      field.control instanceof HTMLSelectElement
        ? await fillSelect(field.control, value)
        : fillTextControl(field.control, value);
    if (changed) filled.add(key);
  }

  // Some checkout frameworks replace their input elements after dependent
  // country/region updates. Re-read and fill current text controls once more.
  await delay(180);
  for (const key of orderedKeys) {
    const field = detectIdentityFields(root).find(
      (candidate) => candidate.key === key,
    );
    const value = valueForField(identity, key);
    if (!field || !value || field.control instanceof HTMLSelectElement) {
      continue;
    }
    if (fillTextControl(field.control, value)) filled.add(key);
  }

  return { detected: initiallyDetected.length, filled: filled.size };
}

export function fillIdentityEmail(
  identity: IdentityData,
  preferredControl: IdentityControl | null = null,
  root: ParentNode = document,
): IdentityFillResult {
  const detectedEmails = detectIdentityFields(root).filter(
    ({ key }) => key === "email",
  );
  const preferredEmail =
    preferredControl && classifyIdentityControl(preferredControl) === "email"
      ? preferredControl
      : null;
  const control = preferredEmail ?? detectedEmails[0]?.control ?? null;
  if (
    !control ||
    control instanceof HTMLSelectElement ||
    !identity.email.trim()
  ) {
    return { detected: detectedEmails.length, filled: 0 };
  }

  return {
    detected: Math.max(detectedEmails.length, 1),
    filled: fillTextControl(control, identity.email) ? 1 : 0,
  };
}

export function classifyIdentityControl(
  control: IdentityControl,
): IdentityFieldKey | null {
  if (!isFillableControl(control)) return null;
  if (control instanceof HTMLInputElement && isOneTimeCodeInput(control)) {
    return null;
  }

  const autocomplete = (control.getAttribute("autocomplete") ?? "")
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/u);
  for (const token of autocomplete.reverse()) {
    const key = AUTOCOMPLETE_FIELDS[token];
    if (key) return key;
  }

  if (control instanceof HTMLInputElement) {
    if (control.type === "email") return "email";
    if (control.type === "tel") return "phone";
  }

  const descriptor = controlDescriptor(control);
  if (!descriptor || PAYMENT_FIELD.test(descriptor)) return null;

  if (matches(descriptor, ["email", "e-mail", "adresă email", "adresa email"]))
    return "email";
  if (matches(descriptor, ["phone", "telephone", "telefon", "mobile", "mobil"]))
    return "phone";
  if (
    matches(descriptor, [
      "address line 2",
      "address2",
      "address_2",
      "apartment",
      "apartament",
      "suite",
      "unit",
      "complex",
    ])
  )
    return "addressLine2";
  if (
    matches(descriptor, [
      "postal",
      "postcode",
      "zip code",
      "zipcode",
      "cod poștal",
      "cod postal",
    ])
  )
    return "postalCode";
  if (
    matches(descriptor, [
      "country",
      "țară",
      "tara",
      "billing_country",
      "shipping_country",
    ])
  )
    return "country";
  if (
    matches(descriptor, [
      "state",
      "county",
      "province",
      "region",
      "județ",
      "judet",
      "billing_state",
      "shipping_state",
    ])
  )
    return "region";
  if (
    matches(descriptor, [
      "city",
      "town",
      "locality",
      "localitate",
      "municipiu",
      "billing_city",
      "shipping_city",
    ])
  )
    return "city";
  if (
    matches(descriptor, [
      "street address",
      "address line 1",
      "address1",
      "address_1",
      "adresă",
      "adresa",
      "stradă",
      "strada",
    ])
  )
    return "addressLine1";
  if (
    matches(descriptor, [
      "first name",
      "firstname",
      "first_name",
      "given name",
      "prenume",
    ])
  )
    return "firstName";
  if (
    matches(descriptor, [
      "last name",
      "lastname",
      "last_name",
      "family name",
      "surname",
      "nume",
    ])
  )
    return "lastName";
  if (matches(descriptor, ["full name", "your name", "nume complet"]))
    return "fullName";

  return null;
}

function isFillableControl(control: IdentityControl): boolean {
  if (control.disabled) return false;
  if (!(control instanceof HTMLSelectElement) && isHiddenFromUser(control)) {
    return false;
  }
  if (control instanceof HTMLInputElement) {
    if (control.readOnly) return false;
    return ![
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "image",
      "password",
      "radio",
      "range",
      "reset",
      "submit",
    ].includes(control.type);
  }
  return !(control instanceof HTMLTextAreaElement && control.readOnly);
}

function fieldsFromBestForm(
  fields: DetectedIdentityField[],
): DetectedIdentityField[] {
  const groups = new Map<HTMLFormElement | null, DetectedIdentityField[]>();
  for (const field of fields) {
    const form = field.control.form;
    const group = groups.get(form) ?? [];
    group.push(field);
    groups.set(form, group);
  }

  const formGroups = Array.from(groups.entries())
    .filter(([form]) => form !== null)
    .map(([, group]) => group)
    .filter(isIdentityFieldGroup)
    .sort(
      (left, right) => identityGroupScore(right) - identityGroupScore(left),
    );

  return formGroups[0] ?? fields;
}

function isIdentityFieldGroup(fields: DetectedIdentityField[]): boolean {
  const keys = new Set(fields.map(({ key }) => key));
  const hasAddress = fields.some(({ key }) =>
    ["country", "addressLine1", "region", "city", "postalCode"].includes(key),
  );
  const hasPerson = fields.some(({ key }) =>
    ["firstName", "lastName", "fullName", "email", "phone"].includes(key),
  );
  return keys.size >= 3 && hasAddress && hasPerson;
}

function identityGroupScore(fields: DetectedIdentityField[]): number {
  const uniqueKeys = new Set(fields.map(({ key }) => key));
  return uniqueKeys.size;
}

function isHiddenFromUser(
  control: HTMLInputElement | HTMLTextAreaElement,
): boolean {
  if (
    control.hidden ||
    control.getAttribute("aria-hidden") === "true" ||
    control.closest('[hidden], [aria-hidden="true"]')
  ) {
    return true;
  }

  const style = window.getComputedStyle(control);
  return style.display === "none" || style.visibility === "hidden";
}

function controlDescriptor(control: IdentityControl): string {
  const labels = Array.from(control.labels ?? []).map(
    (label) => label.textContent ?? "",
  );
  return normalize(
    [
      control.name,
      control.id,
      control.getAttribute("placeholder"),
      control.getAttribute("aria-label"),
      control.getAttribute("data-placeholder"),
      ...labels,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function matches(descriptor: string, candidates: string[]): boolean {
  return candidates.some((candidate) =>
    descriptor.includes(normalize(candidate)),
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[-_.:/[\]()]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function valueForField(identity: IdentityData, key: IdentityFieldKey): string {
  if (key === "fullName") {
    return [identity.firstName, identity.lastName].filter(Boolean).join(" ");
  }
  return identity[key];
}

function fillTextControl(
  control: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): boolean {
  const prototype =
    control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  // Calling the native setter is required for React-controlled fields.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  return control.value === value;
}

async function fillSelect(
  select: HTMLSelectElement,
  value: string,
): Promise<boolean> {
  const option = await waitForMatchingOption(select, value);
  if (!option) return false;
  // Calling the native setter keeps framework-controlled selects in sync.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;
  setter?.call(select, option.value);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await delay(120);
  return select.value === option.value;
}

async function waitForMatchingOption(
  select: HTMLSelectElement,
  value: string,
): Promise<HTMLOptionElement | null> {
  const deadline = Date.now() + 1_800;
  do {
    const match = matchingOption(select, value);
    if (match) return match;
    await delay(60);
  } while (Date.now() < deadline && select.isConnected);
  return null;
}

function matchingOption(
  select: HTMLSelectElement,
  value: string,
): HTMLOptionElement | null {
  const target = normalize(value);
  const aliases = new Set([target]);
  if (target === "romania") aliases.add("ro");

  const options = Array.from(select.options);
  const exact = options.find((option) => {
    const optionValue = normalize(option.value);
    const optionText = normalize(option.textContent ?? "");
    return aliases.has(optionValue) || aliases.has(optionText);
  });
  if (exact) return exact;

  const partial = options.filter((option) => {
    const optionText = normalize(option.textContent ?? "");
    return optionText.includes(target) || target.includes(optionText);
  });
  return partial.length === 1 ? (partial[0] ?? null) : null;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
