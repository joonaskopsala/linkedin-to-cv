import * as pdfjsLib from "../vendor/pdf.min.mjs";

// Cross-browser API shim
const ext = typeof browser !== "undefined" ? browser : chrome;

// Point the pdfjs worker at the extension's bundled copy.
pdfjsLib.GlobalWorkerOptions.workerSrc = ext.runtime.getURL(
  "vendor/pdf.worker.min.mjs",
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function clean(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

const DATE_RX =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{4})\b.{0,40}(present|\d{4})/i;

function isDateLine(text) {
  return DATE_RX.test(text);
}

function isPageMarker(text) {
  return /^page \d+ of \d+$/i.test(text);
}

// Section headings LinkedIn uses in its PDF export.
const SECTION_NAMES = new Set([
  "contact",
  "top skills",
  "skills",
  "languages",
  "certifications",
  "licenses & certifications",
  "summary",
  "experience",
  "education",
  "volunteer experience",
  "publications",
  "patents",
  "courses",
  "honors & awards",
  "projects",
  "interests",
  "recommendations",
  "organizations",
  "test scores",
]);

// ─── Step 1: extract raw text from all PDF pages ────────────────────────────

async function extractTextLines(pdf) {
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    let lastY = null;
    let currentLine = "";

    for (const item of content.items) {
      if (!("str" in item)) continue;

      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        const trimmed = clean(currentLine);
        if (trimmed) allLines.push(trimmed);
        currentLine = item.str;
      } else {
        currentLine += item.str;
      }
      lastY = y;
    }

    const trimmed = clean(currentLine);
    if (trimmed) allLines.push(trimmed);
  }

  return allLines;
}

// ─── Step 2: split lines into named sections ────────────────────────────────

function splitIntoSections(lines) {
  const sections = {};
  let current = "_pre";
  sections[current] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (SECTION_NAMES.has(lower)) {
      current = lower;
      sections[current] = sections[current] || [];
    } else if (!isPageMarker(line)) {
      sections[current] = sections[current] || [];
      sections[current].push(line);
    }
  }

  return sections;
}

// ─── Step 3: parse individual sections ─────────────────────────────────────

function parseContact(sections) {
  const lines = sections["contact"] || [];
  let email = "";
  let linkedin = "";

  for (const line of lines) {
    if (!email) {
      const m = line.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);
      if (m) email = m[0];
    }
    if (!linkedin && /linkedin\.com\/in\//i.test(line)) {
      const raw = line
        .replace(/\(LinkedIn\)/gi, "")
        .replace(/\(.*\)/g, "")
        .trim();
      const m = raw.match(
        /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s\/?#)]+/i,
      );
      if (m) {
        linkedin = m[0].startsWith("http") ? m[0] : `https://${m[0]}`;
        linkedin = linkedin.replace(/[,.)]+$/, "");
      }
    }
  }

  return { email, linkedin };
}

function parseSkills(sections) {
  return (sections["top skills"] || sections["skills"] || []).filter(Boolean);
}

/**
 * Name, headline and location are embedded in the Languages section text
 * after the actual language entries — LinkedIn's two-column layout means
 * sidebar content comes first in the text stream.
 */
function parseNameHeadlineLocation(sections) {
  // Collect candidates: lines in the Languages (or pre-Summary) section that
  // are NOT language proficiency entries.
  const langSection = sections["languages"] || [];
  const candidates = langSection.filter(
    (l) =>
      !/\([^)]*(?:native|bilingual|professional|elementary|limited|working|basic|fluent)/i.test(
        l,
      ) && !SECTION_NAMES.has(l.toLowerCase()),
  );

  // If the languages section didn't have overflow content, check _pre section
  // (some PDFs may order things differently)
  if (!candidates.length) {
    const pre = sections["_pre"] || [];
    return parseNameFromCandidates(pre);
  }

  return parseNameFromCandidates(candidates);
}

function parseNameFromCandidates(candidates) {
  if (!candidates.length) return { name: "", headline: "", location: "" };

  // First candidate is the name
  const name = candidates[0];

  if (candidates.length === 1) return { name, headline: "", location: "" };

  // Last candidate is the location (short, no | or @, before Summary)
  // Everything in between is the headline (possibly wrapped across lines)
  const location = candidates[candidates.length - 1];
  const headlineParts = candidates.slice(1, -1);

  // Join wrapped headline lines. If a part ends with comma, join without space
  let headline = "";
  for (let i = 0; i < headlineParts.length; i++) {
    const part = headlineParts[i];
    if (i === 0) {
      headline = part;
    } else if (headline.endsWith(",")) {
      headline += " " + part;
    } else {
      headline += " " + part;
    }
  }

  // If there were only 2 candidates the "location" might actually be the
  // headline, not a geographic line. Use the same string as headline.
  if (candidates.length === 2) {
    return { name, headline: location, location: "" };
  }

  return {
    name: clean(name),
    headline: clean(headline),
    location: clean(location),
  };
}

function parseSummary(sections) {
  return (sections["summary"] || []).join(" ").trim();
}

// ─── Experience state machine ───────────────────────────────────────────────

const EXP_STATES = { COMPANY: 0, TITLE_OR_DATE: 1, DATE: 2, BULLETS: 3 };

function parseExperience(sections) {
  const lines = sections["experience"] || [];
  const results = [];

  let state = EXP_STATES.COMPANY;
  let company = "";
  let title = "";
  let date = "";
  const bullets = [];

  function saveEntry() {
    if (company || title) {
      const cleanDate = date.replace(/\s*\([^)]+\)\s*$/, "").trim();
      results.push({
        company: company.replace(/\s*\|.*$/, "").trim(),
        title: clean(title),
        date: cleanDate,
        description: "",
        highlights: [...bullets],
      });
    }
    company = "";
    title = "";
    date = "";
    bullets.length = 0;
  }

  for (const line of lines) {
    if (line.startsWith("•")) {
      // Bullet point — always belongs to current entry regardless of state
      bullets.push(clean(line.replace(/^•\s*/, "")));
      state = EXP_STATES.BULLETS;
      continue;
    }

    if (isDateLine(line)) {
      date = line;
      state = EXP_STATES.BULLETS;
      continue;
    }

    // Plain text line
    switch (state) {
      case EXP_STATES.COMPANY:
        company = line;
        state = EXP_STATES.TITLE_OR_DATE;
        break;

      case EXP_STATES.TITLE_OR_DATE:
        title = line;
        state = EXP_STATES.DATE;
        break;

      case EXP_STATES.DATE:
        // Could be a subtitle / location between title and date — skip
        break;

      case EXP_STATES.BULLETS:
        // Check if this line is a word-wrap continuation of the previous bullet.
        // LinkedIn PDFs wrap long bullets across multiple lines; the continuation
        // line has no "•" prefix. A bullet is incomplete when it doesn't end with
        // sentence-closing punctuation.
        if (bullets.length > 0) {
          const lastBullet = bullets[bullets.length - 1];
          const bulletIsIncomplete = !/[.!?)\]]$/.test(lastBullet);
          const startsLowercase = /^[a-z]/.test(line);
          if (bulletIsIncomplete || startsLowercase) {
            bullets[bullets.length - 1] += " " + line;
            break;
          }
        }

        // Location-like line (e.g. "Oulu Area, Finland") — skip.
        if (/,/.test(line) && line.length < 50) {
          break;
        }

        // Otherwise it's the start of a new experience entry.
        saveEntry();
        company = line;
        state = EXP_STATES.TITLE_OR_DATE;
        break;
    }
  }

  saveEntry();
  return results.slice(0, 10);
}

// ─── Education ──────────────────────────────────────────────────────────────

function parseEducation(sections) {
  const lines = sections["education"] || [];
  const results = [];
  let i = 0;

  while (i < lines.length) {
    const school = lines[i++];
    if (!school) continue;

    const next = lines[i] || "";
    // Degree line typically: "Bachelor of Engineering - BE, IT · (2013 - 2017)"
    const dateMatch = next.match(/\((\d{4}\s*[-–]\s*(?:\d{4}|present))\)/i);
    const degree = next
      ? clean(
          next.replace(/\s*·\s*\(.*\)\s*$/, "").replace(/\s*\(.*\)\s*$/, ""),
        )
      : "";
    const date = dateMatch ? dateMatch[1] : "";

    if (next) i++;

    results.push({ school: clean(school), degree, date });
  }

  return results.slice(0, 6);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function parsePdfToProfile(arrayBuffer) {
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
      .promise;
  } catch {
    throw new Error("Could not read the file. Make sure it is a valid PDF.");
  }

  // Validate that this is a LinkedIn profile PDF export.
  // LinkedIn uses Apache FOP to generate its PDFs — check the Producer metadata.
  const metadata = await pdf.getMetadata().catch(() => ({}));
  const producer = metadata?.info?.Producer || "";
  const author = metadata?.info?.Author || "";
  const isLinkedInMeta =
    /apache fop/i.test(producer) || /linkedin/i.test(author);

  const lines = await extractTextLines(pdf);
  const sections = splitIntoSections(lines);

  const hasLinkedInUrl = (sections["contact"] || []).some((l) =>
    /linkedin\.com\/in\//i.test(l),
  );

  if (!isLinkedInMeta && !hasLinkedInUrl) {
    throw new Error(
      "This does not appear to be a LinkedIn profile export. " +
        "Please use LinkedIn \u2192 Me \u2192 View Profile \u2192 More \u2192 Save to PDF.",
    );
  }

  const contact = parseContact(sections);
  const skills = parseSkills(sections);
  const { name, headline, location } = parseNameHeadlineLocation(sections);
  const summary = parseSummary(sections);
  const experience = parseExperience(sections);
  const education = parseEducation(sections);

  if (!name) {
    throw new Error(
      "Could not extract a profile name from this PDF. " +
        "Please make sure you are uploading a LinkedIn profile PDF export.",
    );
  }

  if (!experience.length && !education.length && !summary) {
    throw new Error(
      "Could not extract any profile content from this PDF. " +
        "Please make sure you are uploading a LinkedIn profile PDF (not a job posting or resume).",
    );
  }

  return {
    name,
    headline,
    city: clean(location).split(",")[0],
    summary,
    photoUrl: "",
    contact,
    experience,
    education,
    skills,
    linkedinProfile: contact.linkedin,
  };
}
