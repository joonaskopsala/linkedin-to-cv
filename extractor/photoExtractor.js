/**
 * photoExtractor.js — LinkedIn profile photo content script.
 *
 * Injected as a content script into a LinkedIn profile tab to extract the
 * profile photo URL. Exposes a single global function used by the extension
 * popup after injection via chrome.scripting.executeScript.
 */
(() => {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function firstImageUrl(selectors, root = document) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (!node) continue;

      const direct = clean(
        node.getAttribute("src") ||
          node.getAttribute("data-delayed-url") ||
          node.getAttribute("data-ghost-url") ||
          node.getAttribute("data-src") ||
          "",
      );
      if (direct) return direct;

      const srcset = clean(node.getAttribute("srcset") || "");
      if (srcset) {
        const first = srcset.split(",")[0]?.trim()?.split(" ")[0] || "";
        if (first) return first;
      }
    }
    return "";
  }

  function firstAttr(selectors, attrs, root = document) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (!node) continue;
      for (const attr of attrs) {
        const value = clean(node.getAttribute(attr) || "");
        if (value) return value;
      }
    }
    return "";
  }

  function photoFromJsonLd() {
    for (const script of document.querySelectorAll(
      "script[type='application/ld+json']",
    )) {
      try {
        const raw = JSON.parse(script.textContent || "{}");
        const nodes = Array.isArray(raw)
          ? raw
          : [raw, ...(Array.isArray(raw?.["@graph"]) ? raw["@graph"] : [])];
        for (const node of nodes) {
          const type = [].concat(node?.["@type"] || []).join(" ");
          if (/person/i.test(type)) {
            const img =
              typeof node?.image === "string"
                ? node.image
                : (node?.image?.url ?? "");
            if (clean(img)) return clean(img);
          }
        }
      } catch {
        // Ignore malformed JSON-LD.
      }
    }
    return "";
  }

  function extractPhoto() {
    const fromDom = firstImageUrl(
      [
        "[componentkey='topcard-logo-image-referencekey'] img",
        "div[aria-label='Profile photo'] img",
        ".pv-top-card-profile-picture__image--show img",
        ".pv-top-card-profile-picture__image img",
        ".profile-photo-edit__preview",
        ".top-card-layout__entity-image img",
        "img.pv-top-card-profile-picture__image",
        "img[alt*='profile photo' i]",
      ],
      document,
    );
    if (fromDom) return fromDom;

    const fromJsonLd = photoFromJsonLd();
    if (fromJsonLd) return fromJsonLd;

    return firstAttr(["meta[property='og:image']"], ["content"]);
  }

  window.__linkedinToCvExtractPhoto = extractPhoto;
})();
