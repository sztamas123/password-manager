import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectCredentialForm,
  detectUsernameStep,
  fillCredential,
  fillGeneratedPassword,
  fillUsernameStep,
  isOneTimeCodeInput,
  isRegistrationStep,
  readCredential,
  readVisibleAccountIdentifier,
} from "./form-detection";

describe("credential form detection", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("finds a username and password login form", () => {
    document.body.innerHTML = `
      <form>
        <input name="email" type="email" value="user@example.com">
        <input id="password" type="password" value="secret">
      </form>
    `;
    const password = document.querySelector<HTMLInputElement>("#password");
    const detected = password ? detectCredentialForm(password) : null;

    expect(detected?.registration).toBe(false);
    expect(detected?.usernameInput?.name).toBe("email");
    expect(detected && readCredential(detected)).toEqual({
      password: "secret",
      username: "user@example.com",
    });
  });

  it("recognizes registration forms and fills confirmation fields", () => {
    document.body.innerHTML = `
      <form aria-label="Create account">
        <input autocomplete="username" value="new-user">
        <input autocomplete="new-password" id="password" type="password">
        <input autocomplete="new-password" id="confirm" type="password">
      </form>
    `;
    const password = document.querySelector<HTMLInputElement>("#password");
    const confirm = document.querySelector<HTMLInputElement>("#confirm");
    const detected = password ? detectCredentialForm(password) : null;

    expect(detected?.registration).toBe(true);
    if (!detected) throw new Error("Expected a detected form");
    fillGeneratedPassword(detected, "generated-password");

    expect(password?.value).toBe("generated-password");
    expect(confirm?.value).toBe("generated-password");
  });

  it("ignores Google's hidden password trap on a login form", () => {
    document.body.innerHTML = `
      <form>
        <input
          class="hidden-password"
          type="password"
          name="hiddenPassword"
          tabindex="-1"
          aria-hidden="true"
        >
        <input id="Passwd" type="password" name="Passwd">
      </form>
    `;
    const password = document.querySelector<HTMLInputElement>("#Passwd");
    const detected = password ? detectCredentialForm(password) : null;

    expect(detected?.registration).toBe(false);
    expect(detected?.passwordInputs).toEqual([password]);
  });

  it("reads Google's visible account identifier on a password step", () => {
    document.body.innerHTML = `
      <button data-profile-identifier="user@gmail.com">
        user@gmail.com
      </button>
    `;

    expect(readVisibleAccountIdentifier()).toBe("user@gmail.com");
  });

  it("fills controlled inputs using input and change events", () => {
    document.body.innerHTML = `
      <form>
        <input autocomplete="username">
        <input autocomplete="current-password" type="password">
      </form>
    `;
    const password = document.querySelector<HTMLInputElement>(
      'input[type="password"]',
    );
    const detected = password ? detectCredentialForm(password) : null;
    const listener = vi.fn();
    password?.addEventListener("input", listener);

    if (!detected) throw new Error("Expected a detected form");
    fillCredential(detected, "alice", "correct-password");

    expect(detected.usernameInput?.value).toBe("alice");
    expect(password?.value).toBe("correct-password");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("offers username filling on a combined GitHub-style login form", () => {
    document.body.innerHTML = `
      <form action="/session">
        <label for="login_field">Username or email address</label>
        <input id="login_field" name="login" type="text" autocomplete="username">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password">
      </form>
    `;
    const username = document.querySelector<HTMLInputElement>("#login_field");
    const usernameStep = username ? detectUsernameStep(username) : null;

    expect(usernameStep?.usernameInput).toBe(username);
    if (!usernameStep) throw new Error("Expected a detected username field");
    fillUsernameStep(usernameStep, "octocat");
    expect(username?.value).toBe("octocat");
  });

  it("does not integrate with master-password unlock forms", () => {
    document.body.innerHTML = `
      <form aria-label="Unlock vault">
        <label>Master password <input id="master" type="password"></label>
      </form>
    `;
    const password = document.querySelector<HTMLInputElement>("#master");

    expect(password ? detectCredentialForm(password) : null).toBeNull();
  });

  it("detects and fills a multi-step email sign-in form", () => {
    document.body.innerHTML = `
      <form aria-label="Sign in">
        <input id="identifier" type="email" autocomplete="username">
        <button type="submit">Next</button>
      </form>
    `;
    const username = document.querySelector<HTMLInputElement>("#identifier");
    const detected = username ? detectUsernameStep(username) : null;

    expect(detected?.usernameInput).toBe(username);
    if (!detected) throw new Error("Expected a detected username step");
    fillUsernameStep(detected, "user@gmail.com");
    expect(username?.value).toBe("user@gmail.com");
  });

  it("leaves registration email fields to identity suggestions", () => {
    document.body.innerHTML = `
      <form aria-label="Create account">
        <label>Email <input id="email" type="email" autocomplete="email"></label>
        <label>Password <input type="password" autocomplete="new-password"></label>
      </form>
    `;
    const email = document.querySelector<HTMLInputElement>("#email")!;

    expect(isRegistrationStep(email)).toBe(true);
    expect(detectUsernameStep(email)).toBeNull();
  });

  it("recognizes localized multi-step registration forms", () => {
    document.body.innerHTML = `
      <form action="/inregistrare">
        <h1>Creează un cont</h1>
        <label>Adresă e-mail <input id="email" type="email"></label>
        <button type="submit">Continuă</button>
      </form>
    `;
    const email = document.querySelector<HTMLInputElement>("#email")!;

    expect(isRegistrationStep(email)).toBe(true);
    expect(detectUsernameStep(email)).toBeNull();
  });

  it("does not treat a newsletter email field as a login step", () => {
    document.body.innerHTML = `
      <form aria-label="Newsletter">
        <input id="newsletter" type="email" name="email" autocomplete="email">
        <button type="submit">Subscribe</button>
      </form>
    `;
    const email = document.querySelector<HTMLInputElement>("#newsletter");

    expect(email ? detectUsernameStep(email) : null).toBeNull();
  });

  it("does not treat a standalone contact email as a login step", () => {
    document.body.innerHTML = `
      <form aria-label="Contact us">
        <label>Email address <input id="email" type="email"></label>
      </form>
    `;
    const email = document.querySelector<HTMLInputElement>("#email")!;

    expect(detectUsernameStep(email)).toBeNull();
  });

  it("does not treat a localized email verification code as a username", () => {
    document.body.innerHTML = `
      <form>
        <h1>Autentificare în 2 pași</h1>
        <p>Am trimis un cod unic de verificare din 6 cifre pe adresa e-mail.</p>
        <label>
          Cod unic e-mail*
          <input id="email-code" name="email">
        </label>
      </form>
    `;
    const code = document.querySelector<HTMLInputElement>("#email-code");

    expect(code && isOneTimeCodeInput(code)).toBe(true);
    expect(code ? detectUsernameStep(code) : null).toBeNull();
  });

  it("recognizes standard and short numeric one-time-code fields", () => {
    document.body.innerHTML = `
      <form aria-label="Verify your account">
        <input id="standard" autocomplete="one-time-code">
        <label>
          Security code
          <input id="numeric" inputmode="numeric" maxlength="6">
        </label>
      </form>
    `;
    const standard = document.querySelector<HTMLInputElement>("#standard")!;
    const numeric = document.querySelector<HTMLInputElement>("#numeric")!;

    expect(isOneTimeCodeInput(standard)).toBe(true);
    expect(isOneTimeCodeInput(numeric)).toBe(true);
    expect(detectUsernameStep(standard)).toBeNull();
    expect(detectUsernameStep(numeric)).toBeNull();
  });

  it("rejects password-styled verification codes as credential forms", () => {
    document.body.innerHTML = `
      <form aria-label="Two factor authentication">
        <label>
          Verification code
          <input id="code" type="password" autocomplete="one-time-code">
        </label>
      </form>
    `;
    const code = document.querySelector<HTMLInputElement>("#code")!;

    expect(detectCredentialForm(code)).toBeNull();
  });

  it("still recognizes an actual email field on a verification page", () => {
    document.body.innerHTML = `
      <form aria-label="Verify your email">
        <label>Email address <input id="email" type="email"></label>
        <button type="submit">Continue</button>
      </form>
    `;
    const email = document.querySelector<HTMLInputElement>("#email")!;

    expect(isOneTimeCodeInput(email)).toBe(false);
    expect(detectUsernameStep(email)?.usernameInput).toBe(email);
  });
});
