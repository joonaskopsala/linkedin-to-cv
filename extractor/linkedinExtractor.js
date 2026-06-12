(() => {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function titleCaseFromSlug(slug = "") {
    return slug
      .split("-")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function firstText(selectors, root = document) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (!node) {
        continue;
      }

      const value = clean(node.textContent);
      if (value) {
        return value;
      }
    }

    return "";
  }

  function firstAttr(selectors, attrs, root = document) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (!node) {
        continue;
      }

      for (const attr of attrs) {
        const value = clean(node.getAttribute(attr) || "");
        if (value) {
          return value;
        }
      }
    }

    return "";
  }

  function firstImageUrl(selectors, root = document) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (!node) {
        continue;
      }

      const direct = clean(
        node.getAttribute("src") ||
          node.getAttribute("data-delayed-url") ||
          node.getAttribute("data-ghost-url") ||
          node.getAttribute("data-src") ||
          "",
      );
      if (direct) {
        return direct;
      }

      const srcset = clean(node.getAttribute("srcset") || "");
      if (srcset) {
        const firstCandidate =
          srcset.split(",")[0]?.trim()?.split(" ")[0] || "";
        if (firstCandidate) {
          return firstCandidate;
        }
      }
    }

    return "";
  }

  function manyTexts(selector, root = document, limit = 20) {
    return [...root.querySelectorAll(selector)]
      .map((node) => clean(node.textContent))
      .filter(Boolean)
      .slice(0, limit);
  }

  function uniq(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function sectionByIdsOrHeading(ids, heading) {
    for (const id of ids) {
      const marker = document.getElementById(id);
      if (marker) {
        const section = marker.closest("section");
        if (section) {
          return section;
        }
      }

      const byId = document.querySelector(`section[id*='${id}']`);
      if (byId) {
        return byId;
      }
    }

    const headingEls = [...document.querySelectorAll("h1, h2, h3, span")];
    const match = headingEls.find(
      (el) => clean(el.textContent).toLowerCase() === heading.toLowerCase(),
    );
    return match ? match.closest("section") : null;
  }

  function nameFromMeta() {
    const ogTitle = clean(
      document
        .querySelector("meta[property='og:title']")
        ?.getAttribute("content") || "",
    );
    if (ogTitle && ogTitle.toLowerCase() !== "linkedin") {
      return clean(ogTitle.replace(/\s*\|\s*linkedin\s*$/i, ""));
    }

    const title = clean(document.title || "");
    if (title && title.toLowerCase() !== "linkedin") {
      return clean(title.replace(/\s*\|\s*linkedin\s*$/i, ""));
    }

    return "";
  }

  function nameFromJsonLd() {
    const scripts = [
      ...document.querySelectorAll("script[type='application/ld+json']"),
    ];
    for (const script of scripts) {
      try {
        const raw = JSON.parse(script.textContent || "{}");
        const nodes = Array.isArray(raw)
          ? raw
          : [raw, ...(Array.isArray(raw?.["@graph"]) ? raw["@graph"] : [])];

        for (const node of nodes) {
          const type = Array.isArray(node?.["@type"])
            ? node["@type"].join(" ")
            : node?.["@type"] || "";
          if (/person/i.test(String(type)) && clean(node?.name)) {
            return clean(node.name);
          }
        }
      } catch {
        // Ignore malformed JSON-LD blocks.
      }
    }

    return "";
  }

  function nameFromUrlPath() {
    const match = window.location.pathname.match(/^\/in\/([^/]+)\/?/i);
    if (!match?.[1]) {
      return "";
    }

    const decoded = decodeURIComponent(match[1]).replace(
      /[^a-zA-Z0-9-]+/g,
      "-",
    );
    return titleCaseFromSlug(decoded);
  }

  function stripMoreButtonText(text) {
    return clean(text)
      .replace(/\s*(?:\.\.\.|…)\s*$/i, "")
      .replace(/\s*\.\.\.\s*more$/i, "")
      .replace(/\s*more\s*$/i, "")
      .trim();
  }

  function detectEmailFromText() {
    const bodyText = clean(document.body?.innerText || "");
    const match = bodyText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? clean(match[0]) : "";
  }

  function findContactInfoTrigger() {
    const candidates = [...document.querySelectorAll("button, a, span, div")];
    return (
      candidates.find((node) => {
        const text = clean(node.textContent).toLowerCase();
        const aria = clean(node.getAttribute("aria-label") || "").toLowerCase();
        return text === "contact info" || aria.includes("contact info");
      }) || null
    );
  }

  function extractEmailFromDialog(dialog) {
    if (!dialog) {
      return "";
    }

    const mailto = firstAttr(["a[href^='mailto:']"], ["href"], dialog).replace(
      /^mailto:/i,
      "",
    );
    if (mailto) {
      return clean(mailto);
    }

    const visibleEmail = clean(
      [...dialog.querySelectorAll("span, div, p, li, a")]
        .map((node) => clean(node.textContent))
        .find((text) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) ||
        "",
    );
    return (
      visibleEmail.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ""
    );
  }

  function closeDialog(dialog) {
    const root = dialog || document;
    const closeButtons = [
      ...root.querySelectorAll(
        "button[aria-label*='close' i], button[aria-label*='dismiss' i], button[aria-label*='cancel' i], button[data-control-name*='overlay.close' i], button[data-test-modal-close-btn]",
      ),
    ];

    closeButtons.forEach((btn) => {
      btn.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
      if (typeof btn.click === "function") {
        btn.click();
      }
    });

    const esc = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(esc);
    window.dispatchEvent(esc);
  }

  async function ensureDialogClosed(maxAttempts = 8) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const dialog = document.querySelector(
        "section[role='dialog'], div[role='dialog']",
      );
      if (!dialog) {
        return;
      }

      closeDialog(dialog);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    // Final fallback pass against document-level close controls.
    closeDialog(null);
  }

  async function openContactInfoDialogAndGetEmail() {
    const trigger = findContactInfoTrigger();
    if (!trigger) {
      return "";
    }

    trigger.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const dialog = document.querySelector(
        "section[role='dialog'], div[role='dialog']",
      );
      const email = extractEmailFromDialog(dialog);
      if (email) {
        closeDialog(dialog);
        await ensureDialogClosed();
        return email;
      }
    }

    await ensureDialogClosed();

    return "";
  }

  function detectPhotoFromJsonLd() {
    const scripts = [
      ...document.querySelectorAll("script[type='application/ld+json']"),
    ];

    for (const script of scripts) {
      try {
        const raw = JSON.parse(script.textContent || "{}");
        const nodes = Array.isArray(raw)
          ? raw
          : [raw, ...(Array.isArray(raw?.["@graph"]) ? raw["@graph"] : [])];

        for (const node of nodes) {
          const type = Array.isArray(node?.["@type"])
            ? node["@type"].join(" ")
            : node?.["@type"] || "";
          if (/person/i.test(String(type))) {
            const image =
              typeof node?.image === "string"
                ? node.image
                : typeof node?.image?.url === "string"
                  ? node.image.url
                  : "";
            if (clean(image)) {
              return clean(image);
            }
          }
        }
      } catch {
        // Ignore malformed JSON-LD blocks.
      }
    }

    return "";
  }

  function parseProfilePhoto() {
    const imageUrl = firstImageUrl(
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

    if (imageUrl) {
      return imageUrl;
    }

    const fromJsonLd = detectPhotoFromJsonLd();
    if (fromJsonLd) {
      return fromJsonLd;
    }

    return firstAttr(["meta[property='og:image']"], ["content"]);
  }

  function profileUsername() {
    const usernameMatch = window.location.pathname.match(/^\/in\/([^/?#]+)/i);
    return usernameMatch?.[1] || "";
  }

  async function parseContact() {
    const email =
      clean(
        firstAttr(["a[href^='mailto:']"], ["href"]).replace(/^mailto:/i, ""),
      ) ||
      (await openContactInfoDialogAndGetEmail()) ||
      detectEmailFromText();
    const phone = clean(
      firstAttr(["a[href^='tel:']"], ["href"]).replace(/^tel:/i, ""),
    );
    const profileTemplate = "https://www.linkedin.com/in/{username}";
    const username = profileUsername();
    const linkedin = username
      ? profileTemplate.replace("{username}", username)
      : clean(window.location.href);

    // Ensure no contact modal is left open after extraction completes.
    await ensureDialogClosed();

    return {
      email,
      phone,
      linkedin,
    };
  }

  function parseAbout() {
    const aboutSection = sectionByIdsOrHeading(["about"], "About");
    if (!aboutSection) {
      return "";
    }

    const fullText = firstText(
      [
        "[data-testid='expandable-text-box']",
        "span[data-testid='expandable-text-box']",
      ],
      aboutSection,
    );

    if (fullText) {
      return stripMoreButtonText(fullText);
    }

    return firstText(
      [
        ".inline-show-more-text span[aria-hidden='true']",
        ".inline-show-more-text",
        "p",
      ],
      aboutSection,
    );
  }

  function parseExperience() {
    const section =
      sectionByIdsOrHeading(["experience"], "Experience") || document;
    const cards = [
      ...section.querySelectorAll(
        "div[componentkey^='entity-collection-item'], li.artdeco-list__item, li.pvs-list__paged-list-item, .pvs-list__item--line-separated, li",
      ),
    ];

    const result = [];

    cards.forEach((card) => {
      const title = firstText(
        [
          "p[data-testid='entity-list-item-title']",
          "p._893f12ae",
          "p._0d982122._893f12ae",
          ".t-bold span[aria-hidden='true']",
          ".mr1.t-bold span[aria-hidden='true']",
          "span[aria-hidden='true']",
        ],
        card,
      );

      const meta = manyTexts(
        ".t-14 span[aria-hidden='true'], .t-14, .t-black--light",
        card,
        8,
      );
      const company =
        firstText(
          [
            "p._13695d89._6784db7f",
            "p._93a2f9d1",
            "p[data-testid='entity-list-item-subtitle']",
          ],
          card,
        ) ||
        meta[0] ||
        "";
      const date =
        meta.find((line) =>
          /(\d{4}|present|presente|now|currently|\-)/i.test(line),
        ) || "";

      const descriptionCandidates = uniq(
        manyTexts(
          "[data-testid='expandable-text-box'], .inline-show-more-text span[aria-hidden='true'], .inline-show-more-text, .pvs-list__outer-container span[aria-hidden='true']",
          card,
          10,
        ),
      );

      const details = descriptionCandidates
        .map(stripMoreButtonText)
        .filter((line) => line !== title && line !== company && line !== date)
        .filter((line) => line.length > 2);

      const description =
        details.find((line) => line.length > 55) || details[0] || "";
      const highlights = details
        .filter((line) => line !== description)
        .slice(0, 3);

      if (title || company || date || description) {
        result.push({ title, company, date, description, highlights });
      }
    });

    return result.slice(0, 10);
  }

  function parseEducation() {
    const section =
      sectionByIdsOrHeading(["education"], "Education") || document;
    const cards = [
      ...section.querySelectorAll(
        "div[componentkey^='entity-collection-item'], li.artdeco-list__item, li.pvs-list__paged-list-item, .pvs-list__item--line-separated, li",
      ),
    ];

    const result = [];

    cards.forEach((card) => {
      const school = firstText(
        [
          "p._893f12ae",
          "p[data-testid='entity-list-item-title']",
          ".t-bold span[aria-hidden='true']",
          ".mr1.t-bold span[aria-hidden='true']",
          "span[aria-hidden='true']",
        ],
        card,
      );

      const meta = manyTexts(".t-14 span[aria-hidden='true'], .t-14", card, 5);
      const degree =
        firstText(
          [
            "p._13695d89._6784db7f",
            "p._93a2f9d1",
            "p[data-testid='entity-list-item-subtitle']",
          ],
          card,
        ) ||
        meta[0] ||
        "";
      const date = meta.find((line) => /(\d{4}|\-)/.test(line)) || "";

      if (school || degree || date) {
        result.push({ school, degree, date });
      }
    });

    return result.slice(0, 6);
  }

  function parseSkills() {
    return [];
  }

  function extractSkillsFromCurrentPage() {
    // Get skills container - on /details/skills/ page, target the main content area
    // Avoid "Who viewed your profile" sections by excluding certain containers
    const mainContent = document.querySelector("main");

    if (!mainContent) {
      return [];
    }

    // Get all potential skill elements, but exclude "Who viewed" sections
    const allElements = mainContent.querySelectorAll(
      "p._0d982122._893f12ae span, p._893f12ae span",
    );

    const skills = [];
    for (const span of allElements) {
      const text = clean(span.textContent);

      // Skip empty text
      if (!text || text.length < 1 || text.length > 60) {
        continue;
      }

      // Skip entries that look like job titles: "Job Title at Company"
      if (/\bat\b/i.test(text)) {
        continue;
      }

      // Skip entries that look like "someone at Company" or similar viewer patterns
      if (
        /^(someone|a person|an employee)\s+at\s+/i.test(text) ||
        /viewed.*profile/i.test(text) ||
        /profile.*view/i.test(text)
      ) {
        continue;
      }

      // Skip entries with emoji or viewer indicators
      if (/👀|viewed|viewer/i.test(text)) {
        continue;
      }

      skills.push(text);
    }

    return uniq(skills);
  }

  async function extractProfile() {
    const primaryName = firstText([
      "h1",
      ".pv-text-details__left-panel h1",
      ".top-card-layout__title",
    ]);

    const name =
      primaryName || nameFromJsonLd() || nameFromMeta() || nameFromUrlPath();

    const headline = firstText([
      "div.text-body-medium.break-words",
      ".pv-text-details__left-panel .text-body-medium",
      ".top-card-layout__headline",
      "p[data-testid='entity-list-item-title']",
      "p._0d982122._893f12ae",
    ]);

    const location = firstText([
      "span.text-body-small.inline.t-black--light.break-words",
      ".pv-text-details__left-panel .text-body-small",
      ".top-card-layout__first-subline",
    ]);

    const summary =
      parseAbout() ||
      manyTexts(
        "main p[data-testid='expandable-text-box'], main p, main span",
        document,
        200,
      )
        .map(stripMoreButtonText)
        .find((line) => line.length > 100 && line.length < 600) ||
      "";

    const profile = {
      name,
      headline,
      location,
      summary,
      photoUrl: parseProfilePhoto(),
      contact: await parseContact(),
      experience: parseExperience(),
      education: parseEducation(),
      skills: [],
      linkedinProfile: clean(window.location.href),
    };

    return profile;
  }

  window.__linkedinToCvExtract = extractProfile;
  window.__linkedinToCvExtractSkills = extractSkillsFromCurrentPage;
})();
