function createBrowserSocketBinder({ getBridge, randomUUID, tokenRequired }) {
  return function bindBrowser(browser, phoneToken, threadId, options = {}) {
    const bridge = getBridge(threadId, randomUUID(), options);
    bridge.addClient(browser);

    browser.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (tokenRequired && msg.token !== phoneToken) {
        bridge.emitTo(browser, "error", { text: "Invalid token" });
        browser.close();
        return;
      }
      if (msg.type === "prompt") bridge.prompt(msg.text, msg.attachments, msg.options);
      if (msg.type === "approval") bridge.approval(msg.request, msg.decision);
    });
  };
}

module.exports = {
  createBrowserSocketBinder,
};
