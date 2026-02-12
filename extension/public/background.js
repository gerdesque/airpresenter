const CONTROLLER_PATH = "controller.html";

function getControllerBaseUrl() {
  return chrome.runtime.getURL(CONTROLLER_PATH);
}

function buildControllerUrl(targetTabId) {
  const url = new URL(getControllerBaseUrl());
  if (Number.isInteger(targetTabId) && targetTabId >= 0) {
    url.searchParams.set("targetTabId", String(targetTabId));
  }
  return url.toString();
}

async function openControllerForTab(tab) {
  if (!tab?.id) return;

  const controllerBaseUrl = getControllerBaseUrl();
  if (tab.url?.startsWith(controllerBaseUrl)) return;

  const controllerUrl = buildControllerUrl(tab.id);
  const existing = await chrome.tabs.query({ url: `${controllerBaseUrl}*` });
  const existingTab = existing[0];

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { url: controllerUrl, active: true });
    if (typeof existingTab.windowId === "number") {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    return;
  }

  const createProps = { url: controllerUrl };
  if (typeof tab.index === "number") {
    createProps.index = tab.index + 1;
  }
  await chrome.tabs.create(createProps);
}

chrome.action.onClicked.addListener((tab) => {
  void openControllerForTab(tab);
});
