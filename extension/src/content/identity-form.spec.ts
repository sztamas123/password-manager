import { beforeEach, describe, expect, it } from "vitest";
import type { IdentityData } from "../lib/types";
import {
  classifyIdentityControl,
  detectIdentityFields,
  fillIdentity,
  fillIdentityEmail,
  hasIdentityForm,
  identityFillModeForControl,
} from "./identity-form";

const identity: IdentityData = {
  type: "identity",
  name: "Home",
  firstName: "Tamas",
  lastName: "Szalma",
  email: "tamas@example.com",
  phone: "+40 712 345 678",
  country: "Romania",
  addressLine1: "Strada Exemplu 12",
  addressLine2: "Apartament 4",
  region: "București",
  city: "București",
  postalCode: "010101",
  notes: "",
};

describe("identity form detection and filling", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("uses standard autocomplete field names when available", () => {
    document.body.innerHTML = `
      <input autocomplete="shipping given-name">
      <input autocomplete="shipping family-name">
      <input autocomplete="shipping address-line1">
      <input autocomplete="shipping address-level2">
      <input autocomplete="shipping postal-code">
    `;

    expect(detectIdentityFields().map(({ key }) => key)).toEqual([
      "firstName",
      "lastName",
      "addressLine1",
      "city",
      "postalCode",
    ]);
    expect(hasIdentityForm()).toBe(true);
  });

  it("detects and fills Romanian checkout fields, including dependent selects", async () => {
    document.body.innerHTML = `
      <form>
        <label>Prenume * <input id="first"></label>
        <label>Nume * <input id="last"></label>
        <label>Țară/regiune *
          <select id="country"><option value="">Alege</option><option value="RO">România</option></select>
        </label>
        <label>Adresă * <input id="address"></label>
        <label>Apartament, complex, unitate etc. (opțional) <input id="address2"></label>
        <label>Județ/provincie/stat *
          <select id="region"><option value="">Alege</option></select>
        </label>
        <label>Municipiu/localitate *
          <select id="city"><option value="">Alege</option></select>
        </label>
        <label>Cod poștal <input id="postal"></label>
        <label>Telefon * <input id="phone"></label>
        <label>Adresă email * <input id="email"></label>
        <label>Număr card <input id="card"></label>
      </form>
    `;
    const country = document.querySelector<HTMLSelectElement>("#country")!;
    const region = document.querySelector<HTMLSelectElement>("#region")!;
    country.addEventListener("change", () => {
      region.add(new Option("București", "B"));
    });
    region.addEventListener("change", () => {
      document
        .querySelector<HTMLSelectElement>("#city")!
        .add(new Option("București", "BUC"));
    });

    expect(hasIdentityForm()).toBe(true);
    const result = await fillIdentity(identity);

    expect(result.filled).toBe(10);
    expect(document.querySelector<HTMLInputElement>("#first")!.value).toBe(
      "Tamas",
    );
    expect(document.querySelector<HTMLInputElement>("#last")!.value).toBe(
      "Szalma",
    );
    expect(country.value).toBe("RO");
    expect(region.value).toBe("B");
    expect(document.querySelector<HTMLSelectElement>("#city")!.value).toBe(
      "BUC",
    );
    expect(document.querySelector<HTMLInputElement>("#email")!.value).toBe(
      "tamas@example.com",
    );
    expect(document.querySelector<HTMLInputElement>("#card")!.value).toBe("");
  });

  it("rejects passwords, payment fields, and unrelated inputs", () => {
    document.body.innerHTML = `
      <input id="password" type="password" autocomplete="current-password">
      <label>Cardholder name <input id="cardholder"></label>
      <label>Search <input id="search"></label>
    `;

    expect(
      Array.from(document.querySelectorAll("input")).map((input) =>
        classifyIdentityControl(input),
      ),
    ).toEqual([null, null, null]);
  });

  it("rejects email-labelled one-time verification codes", () => {
    document.body.innerHTML = `
      <form>
        <h2>Autentificare în 2 pași</h2>
        <p>Introdu codul unic de verificare trimis prin e-mail.</p>
        <label>Cod unic e-mail <input id="code" name="email"></label>
      </form>
    `;
    const code = document.querySelector<HTMLInputElement>("#code")!;

    expect(classifyIdentityControl(code)).toBeNull();
    expect(detectIdentityFields()).toEqual([]);
  });

  it("prefers the visible checkout email over a hidden duplicate", async () => {
    document.body.innerHTML = `
      <input id="account-email" autocomplete="email" style="display: none">
      <label>Adresă email * <input id="billing-email" type="email"></label>
    `;

    const fields = detectIdentityFields();
    expect(fields).toHaveLength(1);
    expect(fields[0]?.control.id).toBe("billing-email");

    await fillIdentity(identity);
    expect(
      document.querySelector<HTMLInputElement>("#account-email")!.value,
    ).toBe("");
    expect(
      document.querySelector<HTMLInputElement>("#billing-email")!.value,
    ).toBe("tamas@example.com");
  });

  it("offers email-only filling for a standalone email field", () => {
    document.body.innerHTML = `
      <form>
        <label>Email <input id="email" type="email"></label>
        <label>Message <textarea id="message"></textarea></label>
      </form>
    `;

    const email = document.querySelector<HTMLInputElement>("#email")!;
    const message = document.querySelector<HTMLTextAreaElement>("#message")!;

    expect(identityFillModeForControl(email)).toBe("email");
    expect(identityFillModeForControl(message)).toBeNull();

    const result = fillIdentityEmail(identity, email);
    expect(result).toEqual({ detected: 1, filled: 1 });
    expect(email.value).toBe("tamas@example.com");
    expect(message.value).toBe("");
  });

  it("offers email-only filling when another form wins page-wide detection", () => {
    document.body.innerHTML = `
      <form id="checkout">
        <input autocomplete="given-name">
        <input autocomplete="address-line1">
        <input autocomplete="address-level2">
        <input type="email" autocomplete="email">
      </form>
      <form id="contact">
        <label>Contact email <input id="contact-email" type="email" autocomplete="email"></label>
      </form>
    `;

    const contactEmail =
      document.querySelector<HTMLInputElement>("#contact-email")!;

    expect(
      detectIdentityFields().some(({ control }) => control === contactEmail),
    ).toBe(false);
    expect(identityFillModeForControl(contactEmail)).toBe("email");
  });

  it("keeps identity filling for email fields inside checkout forms", () => {
    document.body.innerHTML = `
      <form>
        <input id="first" autocomplete="given-name">
        <input id="address" autocomplete="address-line1">
        <input id="city" autocomplete="address-level2">
        <input id="email" autocomplete="email">
      </form>
    `;

    const email = document.querySelector<HTMLInputElement>("#email")!;
    const firstName = document.querySelector<HTMLInputElement>("#first")!;
    expect(identityFillModeForControl(email)).toBe("identity");
    expect(identityFillModeForControl(firstName)).toBeNull();
  });

  it("uses the checkout email instead of an earlier newsletter form", () => {
    document.body.innerHTML = `
      <form id="newsletter">
        <label>Email newsletter <input id="newsletter-email" type="email"></label>
      </form>
      <form id="checkout">
        <label>Prenume <input id="first"></label>
        <label>Nume <input id="last"></label>
        <label>Adresă <input id="address"></label>
        <label>Oraș <input id="city" autocomplete="address-level2"></label>
        <label>Adresă email <input id="checkout-email" type="email"></label>
      </form>
    `;

    const email = detectIdentityFields().find(({ key }) => key === "email");
    expect(email?.control.id).toBe("checkout-email");
  });

  it("fills name inputs that are replaced after an address select changes", async () => {
    document.body.innerHTML = `
      <form id="checkout">
        <div id="names">
          <label>Prenume <input id="first"></label>
          <label>Nume <input id="last"></label>
        </div>
        <label>Țară
          <select id="country"><option value="RO">România</option></select>
        </label>
        <label>Adresă <input id="address"></label>
      </form>
    `;
    document
      .querySelector<HTMLSelectElement>("#country")!
      .addEventListener("change", () => {
        window.setTimeout(() => {
          document.querySelector("#names")!.innerHTML = `
            <label>Prenume <input id="replacement-first"></label>
            <label>Nume <input id="replacement-last"></label>
          `;
        }, 20);
      });

    await fillIdentity(identity);

    expect(
      document.querySelector<HTMLInputElement>("#replacement-first")!.value,
    ).toBe("Tamas");
    expect(
      document.querySelector<HTMLInputElement>("#replacement-last")!.value,
    ).toBe("Szalma");
  });
});
