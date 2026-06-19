import { parsePdfToProfile } from "../extractor/pdfParser.js";
import { buildCvHtml } from "../renderer/cvTemplates.js";

// ─── Cross-browser API shim ──────────────────────────────────────────────────
const ext = typeof browser !== "undefined" ? browser : chrome;

// ─── State & element refs ────────────────────────────────────────────────────

const state = {
  profile: null,
  pendingSkills: [],
};

const els = {
  pdfInput: document.getElementById("pdfInput"),
  uploadZone: document.getElementById("uploadZone"),
  uploadZoneContent: document.getElementById("uploadZoneContent"),
  theme: document.getElementById("theme"),
  exportBtn: document.getElementById("exportBtn"),
  status: document.getElementById("status"),
  reviewSkillsCheckbox: document.getElementById("reviewSkillsCheckbox"),
  skillsModal: document.getElementById("skillsModal"),
  skillsList: document.getElementById("skillsList"),
  newSkillInput: document.getElementById("newSkillInput"),
  addSkillBtn: document.getElementById("addSkillBtn"),
  cancelSkillsBtn: document.getElementById("cancelSkillsBtn"),
  doneSkillsBtn: document.getElementById("doneSkillsBtn"),
};

// ─── Status & UI helpers ─────────────────────────────────────────────────────

function setStatus(message) {
  els.status.textContent = message;
}

function setUploadZoneState(zoneState) {
  els.uploadZone.classList.remove("has-file", "error");
  if (zoneState === "file") els.uploadZone.classList.add("has-file");
  if (zoneState === "error") els.uploadZone.classList.add("error");
}

function setUploadZoneLabel(name, summary) {
  els.uploadZoneContent.innerHTML = `
    <span class="upload-icon">✅</span>
    <span class="upload-label">${escapeHtml(name)}</span>
    ${summary ? `<span class="upload-hint">${escapeHtml(summary)}</span>` : ""}
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function usernameFromLinkedInUrl(url = "") {
  const m = url.match(/\/in\/([A-Za-z0-9_%-]+)/i);
  return m
    ? decodeURIComponent(m[1])
        .replace(/[^a-z0-9]+/gi, "")
        .toLowerCase()
        .slice(0, 60)
    : "";
}

function safeFileSlug(profileName = "cv") {
  return (
    (profileName || "cv")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "cv"
  );
}

// ─── PDF parsing ─────────────────────────────────────────────────────────────

async function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
    setStatus("Please select a LinkedIn PDF export file.");
    setUploadZoneState("error");
    return;
  }

  setStatus("Parsing PDF\u2026");

  try {
    const arrayBuffer = await file.arrayBuffer();
    const profile = await parsePdfToProfile(arrayBuffer);

    if (!profile.name) {
      setStatus(
        "Could not read profile from PDF. Make sure it is a LinkedIn export.",
      );
      setUploadZoneState("error");
      return;
    }

    state.profile = profile;
    els.exportBtn.disabled = false;

    const expCount = profile.experience?.length ?? 0;
    const skillCount = profile.skills?.length ?? 0;
    const summary = `${expCount} experience entr${expCount === 1 ? "y" : "ies"} \u00b7 ${skillCount} skill${skillCount === 1 ? "" : "s"}`;

    setUploadZoneState("file");
    setUploadZoneLabel(profile.name, summary);
    setStatus(`Ready \u2014 "${profile.name}" parsed successfully.`);
  } catch (err) {
    setStatus(`Failed to parse PDF: ${err?.message || "Unknown error"}`);
    setUploadZoneState("error");
  }
}

// ─── Profile photo extraction from LinkedIn ──────────────────────────────────

function waitForTabComplete(tabId, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ext.tabs.onUpdated.removeListener(onUpdated);
      resolve(); // photo is optional — never reject
    }, timeoutMs);

    function onUpdated(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        ext.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }

    ext.tabs.onUpdated.addListener(onUpdated);
  });
}

async function fetchProfilePhoto(linkedinUrl) {
  if (!linkedinUrl) return "";

  let tabId = null;
  try {
    const tab = await ext.tabs.create({ url: linkedinUrl, active: false });
    tabId = tab.id;

    await waitForTabComplete(tabId);

    await ext.scripting.executeScript({
      target: { tabId },
      files: ["extractor/photoExtractor.js"],
    });

    const [result] = await ext.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (typeof window.__linkedinToCvExtractPhoto !== "function") return "";
        return window.__linkedinToCvExtractPhoto();
      },
    });

    return result?.result || "";
  } catch {
    return ""; // photo is optional
  } finally {
    if (tabId !== null) {
      ext.tabs.remove(tabId).catch(() => {});
    }
  }
}

// ─── CV generation & PDF export ──────────────────────────────────────────────

function generateCvHtml(profile) {
  return buildCvHtml(profile, els.theme.value);
}

function waitForFrameLoad(iframe) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out while rendering CV.")),
      15000,
    );
    iframe.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    iframe.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Failed to render CV frame."));
    };
  });
}

function dataUrlToBlob(dataUrl) {
  const [meta, data] = dataUrl.split(",");
  const isBase64 = /;base64/i.test(meta);
  const mime =
    (meta.match(/^data:([^;]+)/i) || [])[1] || "application/octet-stream";
  const raw = isBase64 ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function createPdfFromHtmlCanvas(html, fileName) {
  if (!window.jspdf?.jsPDF || typeof window.html2canvas !== "function") {
    throw new Error(
      "PDF libraries did not load. Reload the extension and retry.",
    );
  }

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1000px;height:1400px;border:0";
  iframe.srcdoc = html;
  document.body.appendChild(iframe);

  try {
    await waitForFrameLoad(iframe);

    const frameDoc = iframe.contentDocument;
    if (!frameDoc) throw new Error("CV frame is unavailable.");
    if (frameDoc.fonts?.ready) await frameDoc.fonts.ready;

    const root = frameDoc.querySelector(".sheet") || frameDoc.body;
    const canvas = await window.html2canvas(root, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "p",
      unit: "pt",
      format: "a4",
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const fullImgHeight = (canvas.height * pageWidth) / canvas.width;

    if (fullImgHeight <= pageHeight) {
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,
        0,
        pageWidth,
        fullImgHeight,
      );
    } else {
      const pxPerPt = canvas.width / pageWidth;
      const pageCanvasHeight = Math.floor(pageHeight * pxPerPt);
      let yOffset = 0;
      let pageIndex = 0;

      while (yOffset < canvas.height) {
        const sliceHeight = Math.min(pageCanvasHeight, canvas.height - yOffset);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        if (!ctx)
          throw new Error("Canvas context unavailable while paginating PDF.");
        ctx.drawImage(
          canvas,
          0,
          yOffset,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );

        const pageImgHeight = (sliceHeight * pageWidth) / canvas.width;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(
          pageCanvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          0,
          pageWidth,
          pageImgHeight,
        );

        yOffset += sliceHeight;
        pageIndex += 1;
      }
    }

    const pdfBlob = dataUrlToBlob(pdf.output("datauristring"));
    const pdfUrl = URL.createObjectURL(pdfBlob);
    await ext.downloads.download({
      url: pdfUrl,
      filename: fileName,
      saveAs: true,
    });
    URL.revokeObjectURL(pdfUrl);
  } finally {
    iframe.remove();
  }
}

async function exportCv(profile) {
  els.exportBtn.disabled = true;

  try {
    if (profile.linkedinProfile && !profile.photoUrl) {
      setStatus("Fetching profile photo from LinkedIn\u2026");
      profile.photoUrl = await fetchProfilePhoto(profile.linkedinProfile);
    }

    setStatus("Generating CV\u2026");
    const html = generateCvHtml(profile);

    setStatus("Exporting PDF\u2026");
    const slug =
      usernameFromLinkedInUrl(profile.linkedinProfile) ||
      safeFileSlug(profile.name);
    await createPdfFromHtmlCanvas(html, `${slug}-cv.pdf`);

    setStatus("PDF exported successfully.");
  } catch (err) {
    setStatus(`Export failed: ${err?.message || "Unknown error"}`);
  } finally {
    els.exportBtn.disabled = !state.profile;
  }
}

// ─── Skills modal ────────────────────────────────────────────────────────────

function showSkillsModal(skills) {
  state.pendingSkills = [...skills];
  renderSkillsList();
  els.newSkillInput.value = "";
  els.skillsModal.classList.remove("hidden");
  setTimeout(() => els.newSkillInput.focus(), 100);
}

function hideSkillsModal() {
  els.skillsModal.classList.add("hidden");
  state.pendingSkills = [];
}

function renderSkillsList() {
  els.skillsList.innerHTML = state.pendingSkills
    .map(
      (skill, index) => `
    <div class="skill-item">
      <input type="checkbox" class="skill-checkbox" data-index="${index}" checked />
      <span class="skill-item-text">${escapeHtml(skill)}</span>
      <button class="skill-item-remove" data-index="${index}" title="Remove skill">\u00d7</button>
    </div>`,
    )
    .join("");

  els.skillsList.querySelectorAll(".skill-item-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      state.pendingSkills.splice(parseInt(e.target.dataset.index, 10), 1);
      renderSkillsList();
    });
  });
}

function addNewSkill() {
  const text = els.newSkillInput.value.trim();
  if (!text) return;
  if (state.pendingSkills.includes(text)) {
    alert("Skill already in list");
    return;
  }
  state.pendingSkills.push(text);
  els.newSkillInput.value = "";
  renderSkillsList();
  els.newSkillInput.focus();
}

function getSelectedSkills() {
  return Array.from(
    els.skillsList.querySelectorAll(".skill-checkbox:checked"),
  ).map((cb) => state.pendingSkills[parseInt(cb.dataset.index, 10)]);
}

// ─── Export entry points ─────────────────────────────────────────────────────

async function handleExportClick() {
  if (!state.profile) {
    setStatus("Please upload a LinkedIn PDF first.");
    return;
  }

  if (els.reviewSkillsCheckbox.checked) {
    showSkillsModal(state.profile.skills || []);
    return;
  }

  await exportCv({ ...state.profile });
}

async function handleSkillsDone() {
  const selectedSkills = getSelectedSkills();
  hideSkillsModal();
  await exportCv({ ...state.profile, skills: selectedSkills });
}

// ─── Drag-and-drop ───────────────────────────────────────────────────────────

els.uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  els.uploadZone.classList.add("drag-over");
});

["dragleave", "dragend"].forEach((evt) => {
  els.uploadZone.addEventListener(evt, () => {
    els.uploadZone.classList.remove("drag-over");
  });
});

els.uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  els.uploadZone.classList.remove("drag-over");
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFileSelected(file);
});

// ─── Wire up events ───────────────────────────────────────────────────────────

els.pdfInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) handleFileSelected(file);
});

els.exportBtn.addEventListener("click", handleExportClick);

els.addSkillBtn.addEventListener("click", addNewSkill);
els.newSkillInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") addNewSkill();
});

els.cancelSkillsBtn.addEventListener("click", () => {
  hideSkillsModal();
  setStatus("Export cancelled.");
});

els.doneSkillsBtn.addEventListener("click", handleSkillsDone);
