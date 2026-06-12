function escapeHtml(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cleanText(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

function stripTrailingEllipsis(text = "") {
  return cleanText(text)
    .replace(/\s*(?:\.\.\.|…)\s*$/u, "")
    .replace(/\s*\.\.\.\s*more$/i, "")
    .replace(/\s*more\s*$/i, "")
    .trim();
}

function formatSentencesAsLines(text = "") {
  const normalized = stripTrailingEllipsis(text);
  if (!normalized) {
    return "";
  }

  const bulletRows = normalized
    .split(/\s*•\s*/)
    .map((s) => cleanText(s))
    .filter(Boolean);

  if (bulletRows.length > 1) {
    return bulletRows.map((row) => `• ${escapeHtml(row)}`).join("<br />");
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => cleanText(s))
    .filter(Boolean);

  const safeSentences = sentences?.length ? sentences : [normalized];
  return safeSentences.map((s) => escapeHtml(s)).join("<br />");
}

function section(title, body) {
  if (!body) {
    return "";
  }

  return `
    <section class="section">
      <div class="section-head">
        <h2>${escapeHtml(title)}</h2>
      </div>
      ${body}
    </section>
  `;
}

function renderExperience(items) {
  if (!items?.length) {
    return "";
  }

  return `
    <div class="experience-list">
      ${items
        .map(
          (item) => `
        <article class="experience-item">
          <div class="experience-meta">
            <div>
              <h3>${escapeHtml(item.title || "")}</h3>
              <p>${escapeHtml(item.company || "")}</p>
            </div>
            <span>${escapeHtml(item.date || "")}</span>
          </div>
          ${item.description ? `<p class="experience-description">${formatSentencesAsLines(item.description)}</p>` : ""}
          ${(item.highlights || []).length ? `<ul class="experience-highlights">${item.highlights.map((h) => `<li>${escapeHtml(stripTrailingEllipsis(h))}</li>`).join("")}</ul>` : ""}
        </article>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderEducation(items) {
  if (!items?.length) {
    return "";
  }

  return `
    <div class="education-list">
      ${items
        .map(
          (item) => `
        <article class="education-item">
          <h3>${escapeHtml(item.degree || "")}</h3>
          <p>${escapeHtml(item.school || "")}</p>
          <span>${escapeHtml(item.date || "")}</span>
        </article>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderSkills(skills) {
  if (!skills?.length) {
    return "";
  }

  return `
    <ul class="skills">
      ${skills.map((skill) => `<li>${escapeHtml(skill)}</li>`).join("")}
    </ul>
  `;
}

function renderPhoto(photoUrl, name) {
  if (!photoUrl) {
    return "";
  }

  return `<img class="avatar" src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)} profile photo" />`;
}

function renderContact(contact, location) {
  const rows = [
    contact?.email,
    contact?.phone,
    contact?.linkedin,
    location,
  ].filter(Boolean);

  if (!rows.length) {
    return "";
  }

  return `
    <ul class="contact-list">
      ${rows
        .map((item) => {
          const isUrl = /^https?:\/\//i.test(item);
          if (isUrl) {
            return `<li><a href="${escapeHtml(item)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item)}</a></li>`;
          }
          return `<li>${escapeHtml(item)}</li>`;
        })
        .join("")}
    </ul>
  `;
}

function themeClass(theme) {
  if (theme === "editorial") return "theme-editorial";
  if (theme === "executive") return "theme-executive";
  return "theme-harvard";
}

function buildSections(profile) {
  return {
    about: section(
      "About",
      profile.summary
        ? `<p>${escapeHtml(stripTrailingEllipsis(profile.summary))}</p>`
        : "",
    ),
    experience: section(
      "Experience",
      renderExperience(profile.experience || []),
    ),
    education: section("Education", renderEducation(profile.education || [])),
    contact: section(
      "Contact",
      renderContact(profile.contact, profile.location),
    ),
    skills: section("Skills", renderSkills(profile.skills || [])),
  };
}

function harvardLayout(profile, sections) {
  const photo = renderPhoto(profile.photoUrl, profile.name || "Profile");
  return `
    <main class="cv cv-harvard">
      <header class="harvard-masthead">
        <div class="identity-block">
          ${photo}
          <div>
            <h1>${escapeHtml(profile.name || "Your Name")}</h1>
            <p class="headline">${escapeHtml(profile.headline || "Professional Headline")}</p>
            ${profile.location ? `<p class="subline">${escapeHtml(profile.location)}</p>` : ""}
          </div>
        </div>
        <div class="masthead-grid">
          <div>${sections.contact}</div>
          <div>${sections.skills}</div>
        </div>
      </header>

      <div class="harvard-body">
        <aside class="harvard-aside">
          ${sections.about}
          ${sections.education}
        </aside>
        <section class="harvard-main">
          ${sections.experience}
        </section>
      </div>
    </main>
  `;
}

function editorialLayout(profile, sections) {
  const photo = renderPhoto(profile.photoUrl, profile.name || "Profile");
  return `
    <main class="cv cv-editorial">
      <section class="editorial-hero">
        <div class="hero-top">
          ${photo}
          <div>
            <h1>${escapeHtml(profile.name || "Your Name")}</h1>
            <p class="headline">${escapeHtml(profile.headline || "Professional Headline")}</p>
            ${profile.location ? `<p class="subline">${escapeHtml(profile.location)}</p>` : ""}
          </div>
        </div>
        <div class="hero-chips">
          ${profile.contact?.email ? `<span>${escapeHtml(profile.contact.email)}</span>` : ""}
          ${profile.contact?.linkedin ? `<span>${escapeHtml(profile.contact.linkedin)}</span>` : ""}
          ${profile.location ? `<span>${escapeHtml(profile.location)}</span>` : ""}
        </div>
      </section>

      <div class="editorial-grid">
        <section class="editorial-column editorial-column-left">
          ${sections.about}
          ${sections.skills}
          ${sections.education}
        </section>
        <section class="editorial-column editorial-column-right">
          ${sections.experience}
          ${sections.contact}
        </section>
      </div>
    </main>
  `;
}

function executiveLayout(profile, sections) {
  const photo = renderPhoto(profile.photoUrl, profile.name || "Profile");
  return `
    <main class="cv cv-executive">
      <section class="executive-top">
        <div class="identity-row">
          ${photo}
          <div>
            <h1>${escapeHtml(profile.name || "Your Name")}</h1>
            <p class="headline">${escapeHtml(profile.headline || "Professional Headline")}</p>
            ${profile.location ? `<p class="subline">${escapeHtml(profile.location)}</p>` : ""}
          </div>
        </div>
        <div class="executive-bar">
          ${profile.contact?.email ? `<span>${escapeHtml(profile.contact.email)}</span>` : ""}
          ${profile.contact?.phone ? `<span>${escapeHtml(profile.contact.phone)}</span>` : ""}
          ${profile.contact?.linkedin ? `<span>${escapeHtml(profile.contact.linkedin)}</span>` : ""}
        </div>
      </section>

      <section class="executive-body">
        <div class="executive-stack">
          ${sections.about}
          ${sections.experience}
          ${sections.education}
        </div>
        <aside class="executive-side">
          ${sections.skills}
        </aside>
      </section>
    </main>
  `;
}

export function buildCvHtml(profile, theme = "modern") {
  const safeProfile = profile || {};
  const sections = buildSections(safeProfile);

  const styles = `
    :root {
      --ink: #1d252c;
      --muted: #5c6872;
      --line: #d5dbe0;
      --paper: #ffffff;
      --page-bg: #eef2f5;
      --accent: #14324a;
      --accent-soft: #d7e1ea;
      --chip-bg: #ffffff;
      --shadow: 0 18px 42px rgba(12, 20, 24, 0.12);
      --radius: 0;
    }

    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body {
      margin: 0;
      padding: 0;
      color: var(--ink);
      font-size: 17px;
      background:
        radial-gradient(circle at 0% 0%, rgba(20, 50, 74, 0.10), transparent 34%),
        radial-gradient(circle at 100% 100%, rgba(70, 112, 148, 0.10), transparent 34%),
        var(--page-bg);
      font-family: "Aptos", "Segoe UI", sans-serif;
    }

    .page {
      min-height: 100vh;
      padding: 0;
    }

    .cv {
      min-height: 100vh;
      width: 100%;
      display: flex;
      flex-direction: column;
      background: var(--paper);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .section {
      margin-top: 18px;
    }

    .section-head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .section-head h2 {
      margin: 0;
      color: var(--accent);
      font-size: 13px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .avatar {
      width: 92px;
      height: 92px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--line);
      background: #f4f8fa;
      flex: 0 0 auto;
    }

    h1 {
      margin: 0;
      font-size: clamp(30px, 4vw, 42px);
      line-height: 1.02;
      letter-spacing: -0.03em;
    }

    .headline, .subline {
      margin: 6px 0 0;
      color: var(--muted);
      line-height: 1.4;
      font-size: 15px;
    }

    .contact-list {
      margin: 0;
      padding-left: 18px;
    }

    .contact-list li {
      margin-bottom: 6px;
      line-height: 1.4;
      font-size: 14px;
    }

    .contact-list a {
      color: var(--accent);
      text-decoration: none;
      word-break: break-word;
    }

    .skills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .skills li {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 10px;
      background: var(--chip-bg);
      font-size: 13px;
    }

    .experience-list, .education-list {
      display: grid;
      gap: 14px;
    }

    .experience-item, .education-item {
      padding: 14px 0;
      border-top: 1px solid var(--line);
    }

    .experience-item:first-child, .education-item:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .experience-meta {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }

    .experience-meta h3, .education-item h3 {
      margin: 0;
      font-size: 18px;
    }

    .experience-meta p, .education-item p {
      margin: 4px 0 0;
      color: var(--muted);
      line-height: 1.45;
      font-size: 15px;
    }

    .experience-meta span, .education-item span {
      font-size: 13px;
      color: var(--muted);
      white-space: nowrap;
    }

    .experience-description {
      margin: 10px 0 8px;
      line-height: 1.5;
      color: var(--ink);
      font-size: 15px;
    }

    .experience-highlights {
      margin: 0;
      padding-left: 18px;
    }

    .experience-highlights li {
      margin-bottom: 6px;
      line-height: 1.45;
      font-size: 14px;
    }

    .cv-harvard {
      font-family: Georgia, "Times New Roman", serif;
    }

    .cv-harvard .harvard-masthead {
      padding: 24px 28px 18px;
      border-bottom: 2px solid var(--accent);
      display: grid;
      gap: 18px;
    }

    .cv-harvard .identity-block {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .cv-harvard .identity-block .headline,
    .cv-harvard .identity-block .subline {
      font-size: 14px;
    }

    .cv-harvard .masthead-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .cv-harvard .harvard-body {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr 2fr;
    }

    .cv-harvard .harvard-aside {
      padding: 24px 28px 28px;
      border-right: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(18, 43, 66, 0.03), rgba(18, 43, 66, 0.01));
    }

    .cv-harvard .harvard-main {
      padding: 24px 28px 28px;
    }

    .cv-harvard .section {
      margin-top: 22px;
    }

    .cv-harvard .section-head h2 {
      letter-spacing: 0.12em;
    }

    .cv-editorial {
      font-family: "Aptos", "Segoe UI", sans-serif;
    }

    .cv-editorial .editorial-hero {
      padding: 26px 30px 20px;
      background: linear-gradient(135deg, rgba(122, 47, 36, 0.07), rgba(20, 50, 74, 0.04));
      border-bottom: 1px solid var(--line);
    }

    .cv-editorial .hero-top {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .cv-editorial .hero-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }

    .cv-editorial .hero-chips span {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 10px;
      background: rgba(255,255,255,0.8);
      font-size: 12px;
    }

    .cv-editorial .editorial-grid {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr 1.3fr;
    }

    .cv-editorial .editorial-column {
      padding: 24px 28px 28px;
    }

    .cv-editorial .editorial-column-left {
      background: linear-gradient(180deg, rgba(122, 47, 36, 0.03), rgba(122, 47, 36, 0.01));
      border-right: 1px solid var(--line);
    }

    .cv-editorial .section {
      margin-top: 18px;
    }

    .cv-editorial .section-head h2 {
      letter-spacing: 0.08em;
    }

    .cv-editorial .experience-item,
    .cv-editorial .education-item {
      border-top-style: dashed;
    }

    .cv-editorial .skills li {
      border-radius: 10px;
    }

    .cv-executive {
      font-family: "Aptos", "Segoe UI", sans-serif;
    }

    .cv-executive .executive-top {
      padding: 24px 28px 18px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(17, 22, 28, 0.04), rgba(17, 22, 28, 0.01));
    }

    .cv-executive .identity-row {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .cv-executive .executive-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }

    .cv-executive .executive-bar span {
      background: #f8fafc;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
    }

    .cv-executive .executive-body {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 1.45fr 0.85fr;
    }

    .cv-executive .executive-stack {
      padding: 24px 28px 28px;
    }

    .cv-executive .executive-side {
      padding: 24px 26px 28px;
      border-left: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(17, 22, 28, 0.03), rgba(17, 22, 28, 0.01));
    }

    .cv-executive .section {
      margin-top: 18px;
    }

    .cv-executive .skills li {
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-size: 11px;
    }

    .cv-executive .experience-meta h3,
    .cv-executive .education-item h3 {
      font-size: 15px;
    }

    @media (max-width: 760px) {
      .cv-harvard .harvard-body,
      .cv-editorial .editorial-grid,
      .cv-executive .executive-body {
        grid-template-columns: 1fr;
      }

      .cv-harvard .harvard-aside,
      .cv-editorial .editorial-column-left,
      .cv-executive .executive-side {
        border-right: 0;
        border-left: 0;
        border-top: 1px solid var(--line);
      }

      .cv-harvard .masthead-grid,
      .cv-executive .identity-row,
      .cv-editorial .hero-top,
      .cv-harvard .identity-block {
        align-items: flex-start;
      }
    }

    @media print {
      body { background: white; }
      .cv {
        width: 100%;
        min-height: 100vh;
        box-shadow: none;
        border: 0;
      }
      .print-hint { display: none; }
    }
  `;

  const layout =
    theme === "editorial"
      ? editorialLayout(safeProfile, sections)
      : theme === "executive"
        ? executiveLayout(safeProfile, sections)
        : harvardLayout(safeProfile, sections);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(safeProfile.name || "CV")} - CV</title>
        <style>${styles}</style>
      </head>
      <body class="${themeClass(theme)}">
        <div class="page">${layout}</div>
      </body>
    </html>
  `;
}
