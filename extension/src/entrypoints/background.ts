import { browser } from "wxt/browser";
import { isRuntimeRequest, failure, success } from "../lib/protocol";
import type { RuntimeRequest, RuntimeResponse } from "../lib/types";
import { getStatus, lock, login, logout, unlock } from "../background/session";
import {
  clearPendingCredentials,
  clearVaultCache,
  confirmPendingCredential,
  dismissPendingCredential,
  getCredentialForFill,
  getCredentialMatches,
  getIdentityForFill,
  getIdentitySummaries,
  getPendingCredential,
  preparePendingCredential,
  rememberUsernameStep,
} from "../background/vault-service";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    // WXT supports Promise responses despite the legacy listener type.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    (message: unknown, sender): Promise<RuntimeResponse> | undefined => {
      if (!isRuntimeRequest(message)) return undefined;
      return handleRequest(message, sender).catch(failure);
    },
  );
});

async function handleRequest(
  request: RuntimeRequest,
  sender: Browser.runtime.MessageSender,
): Promise<RuntimeResponse> {
  switch (request.type) {
    case "GET_STATUS":
      return success(await getStatus());
    case "LOGIN":
      clearVaultCache();
      await clearPendingCredentials();
      return success(
        await login(request.email, request.password, request.serverUrl),
      );
    case "UNLOCK":
      clearVaultCache();
      return success(await unlock(request.masterPassword));
    case "LOCK":
      clearVaultCache();
      await clearPendingCredentials();
      return success(await lock());
    case "LOGOUT":
      clearVaultCache();
      await clearPendingCredentials();
      return success(await logout());
    case "GET_MATCHES": {
      const pageUrl = trustedPageUrl(sender, request.url);
      return success(await getCredentialMatches(pageUrl, request.usernameHint));
    }
    case "GET_IDENTITIES":
      return success(await getIdentitySummaries());
    case "FILL_CREDENTIAL": {
      const tabId = await trustedTabId(sender, request.tabId);
      const pageUrl = await trustedPageUrlForTab(sender, tabId, request.url);
      const credential = await getCredentialForFill(
        request.vaultId,
        request.entryId,
        pageUrl,
        request.usernameHint,
      );
      await rememberUsernameStep(credential.username, tabId, pageUrl);
      await browser.tabs.sendMessage(tabId, {
        ...credential,
        type: "APPLY_CREDENTIAL",
      });
      return success(undefined);
    }
    case "FILL_GENERATED_PASSWORD": {
      if (!request.password || request.password.length > 4_096) {
        throw new Error("The generated password is invalid");
      }
      const tabId = await trustedTabId(sender, request.tabId);
      await browser.tabs.sendMessage(tabId, {
        password: request.password,
        type: "APPLY_GENERATED_PASSWORD",
      });
      return success(undefined);
    }
    case "FILL_IDENTITY": {
      const tabId = await trustedTabId(sender, request.tabId);
      const tab = await browser.tabs.get(tabId);
      assertSupportedPage(tab.url);
      const identity = await getIdentityForFill(
        request.vaultId,
        request.entryId,
      );
      await browser.tabs.sendMessage(tabId, {
        identity,
        mode: request.mode,
        type: "APPLY_IDENTITY",
      });
      return success(undefined);
    }
    case "USERNAME_STEP_SUBMITTED": {
      const tabId = await trustedTabId(sender);
      const pageUrl = trustedPageUrl(sender, request.url);
      await rememberUsernameStep(request.username, tabId, pageUrl);
      return success(undefined);
    }
    case "CREDENTIAL_SUBMITTED": {
      const tabId = await trustedTabId(sender);
      const pageUrl = trustedPageUrl(sender, request.credential.url);
      return success(
        await preparePendingCredential(request.credential, tabId, pageUrl),
      );
    }
    case "GET_PENDING_CREDENTIAL": {
      const tabId = await trustedTabId(sender);
      return success(await getPendingCredential(tabId));
    }
    case "CONFIRM_PENDING_CREDENTIAL": {
      const tabId = await trustedTabId(sender);
      await confirmPendingCredential(tabId, request.pendingId);
      return success(undefined);
    }
    case "DISMISS_PENDING_CREDENTIAL": {
      const tabId = await trustedTabId(sender);
      await dismissPendingCredential(tabId, request.pendingId);
      return success(undefined);
    }
  }
}

function assertSupportedPage(url: string | undefined): void {
  if (!url) throw new Error("This page cannot receive identity data");
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("This page cannot receive identity data");
  }
}

async function trustedTabId(
  sender: Browser.runtime.MessageSender,
  requestedTabId?: number,
): Promise<number> {
  if (sender.tab?.id !== undefined) return sender.tab.id;
  if (requestedTabId === undefined) {
    throw new Error("This action requires an active browser tab");
  }

  await browser.tabs.get(requestedTabId);
  return requestedTabId;
}

function trustedPageUrl(
  sender: Browser.runtime.MessageSender,
  requestedUrl: string,
): string {
  if (sender.tab?.url) return sender.tab.url;
  const parsed = new URL(requestedUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("This page cannot receive credentials");
  }
  return parsed.href;
}

async function trustedPageUrlForTab(
  sender: Browser.runtime.MessageSender,
  tabId: number,
  requestedUrl: string,
): Promise<string> {
  if (sender.tab?.url) return sender.tab.url;
  const tab = await browser.tabs.get(tabId);
  return tab.url ?? trustedPageUrl(sender, requestedUrl);
}
