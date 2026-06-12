function waitForTabComplete(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("Timed out while preparing PDF page."));
    }, timeoutMs);

    function onUpdated(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

function base64ToBlob(base64, type = "application/pdf") {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}

async function exportPdfFromHtml({ html, fileName }) {
  if (!html || !fileName) {
    throw new Error("Missing HTML or filename for PDF export.");
  }

  if (!chrome.debugger || typeof chrome.debugger.attach !== "function") {
    throw new Error(
      "Debugger API is unavailable. Reload the extension and retry.",
    );
  }

  const pageUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  let renderTabId = null;
  let attached = false;

  try {
    const renderTab = await chrome.tabs.create({ url: pageUrl, active: false });
    renderTabId = renderTab?.id;

    if (!renderTabId) {
      throw new Error("Could not create render tab.");
    }

    await waitForTabComplete(renderTabId);

    await chrome.debugger.attach({ tabId: renderTabId }, "1.3");
    attached = true;

    const pdfResult = await chrome.debugger.sendCommand(
      { tabId: renderTabId },
      "Page.printToPDF",
      {
        printBackground: true,
        preferCSSPageSize: true,
      },
    );

    if (!pdfResult?.data) {
      throw new Error("PDF data was empty.");
    }

    const pdfBlob = base64ToBlob(pdfResult.data, "application/pdf");
    const pdfUrl = URL.createObjectURL(pdfBlob);

    await chrome.downloads.download({
      url: pdfUrl,
      filename: fileName,
      saveAs: true,
    });

    URL.revokeObjectURL(pdfUrl);
  } finally {
    if (attached && renderTabId) {
      try {
        await chrome.debugger.detach({ tabId: renderTabId });
      } catch {
        // Ignore detach failures.
      }
    }

    if (renderTabId) {
      try {
        await chrome.tabs.remove(renderTabId);
      } catch {
        // Ignore cleanup failures.
      }
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXPORT_PDF") {
    return;
  }

  exportPdfFromHtml(message.payload)
    .then(() => sendResponse({ ok: true }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error?.message || "PDF export failed.",
      }),
    );

  return true;
});
