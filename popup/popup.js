import { buildCvHtml } from "../renderer/cvTemplates.js";

const state = {
  profile: null,
  lastHtml: "",
  currentTabId: null,
  pendingSkills: [],
  exportPending: false,
  isExported: false,
};

const els = {
  theme: document.getElementById("theme"),
  exportBtn: document.getElementById("exportBtn"),
  status: document.getElementById("status"),
  urlIndicator: document.getElementById("urlIndicator"),
  urlStatus: document.getElementById("urlStatus"),
  reviewSkillsCheckbox: document.getElementById("reviewSkillsCheckbox"),
  // Modal elements
  skillsModal: document.getElementById("skillsModal"),
  skillsList: document.getElementById("skillsList"),
  newSkillInput: document.getElementById("newSkillInput"),
  addSkillBtn: document.getElementById("addSkillBtn"),
  cancelSkillsBtn: document.getElementById("cancelSkillsBtn"),
  doneSkillsBtn: document.getElementById("doneSkillsBtn"),
};

function setStatus(message) {
  els.status.textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function checkUrlValidity() {
  // Skip checking if export is already complete
  if (state.isExported) {
    return;
  }

  const tab = await getActiveTab();

  if (!tab?.url) {
    updateUrlStatus(false, "No tab found");
    return false;
  }

  state.currentTabId = tab.id;
  const isValid = isValidLinkedInProfileUrl(tab.url);

  if (isValid) {
    updateUrlStatus(true, "✓ Valid LinkedIn profile");
  } else {
    updateUrlStatus(false, "✗ Not a LinkedIn profile");
  }

  return isValid;
}

function updateUrlStatus(isValid, message) {
  if (isValid) {
    els.urlIndicator.className = "indicator valid";
    els.urlStatus.textContent = "Valid url";
    els.exportBtn.disabled = false;
  } else {
    els.urlIndicator.className = "indicator invalid";
    els.urlStatus.textContent = "Not valid url";
    els.exportBtn.disabled = true;
  }
}

function hideUrlIndicator() {
  state.isExported = true;
  els.urlIndicator.style.display = "none";
  els.urlStatus.textContent = "Export complete!";
  // Also hide the entire url-check container
  const urlCheckContainer = document.querySelector(".url-check");
  if (urlCheckContainer) {
    urlCheckContainer.style.display = "none";
  }
}

function isValidLinkedInProfileUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (
      url.hostname !== "www.linkedin.com" &&
      url.hostname !== "linkedin.com"
    ) {
      return false;
    }
    return /^\/in\/[A-Za-z0-9%._-]+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

function generateCv(profile) {
  state.lastHtml = buildCvHtml(profile, els.theme.value);
  return state.lastHtml;
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

function fallbackNameFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/^\/in\/([^/]+)\/?/i);
    if (!match?.[1]) return "Your Name";
    const slug = decodeURIComponent(match[1]).replace(/[^a-zA-Z0-9-]+/g, "-");
    const name = slug
      .split("-")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    return name || "Your Name";
  } catch {
    return "Your Name";
  }
}

async function createPdfFromHtml(html, profileName) {
  const safeName = `${safeFileSlug(profileName)}-cv.pdf`;
  await createPdfFromHtmlCanvas(html, safeName);
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
    throw new Error("PDF libraries did not load. Reload extension and retry.");
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "1000px";
  iframe.style.height = "1400px";
  iframe.style.border = "0";
  iframe.srcdoc = html;
  document.body.appendChild(iframe);

  try {
    await waitForFrameLoad(iframe);

    const frameDoc = iframe.contentDocument;
    if (!frameDoc) {
      throw new Error("CV frame is unavailable.");
    }

    if (frameDoc.fonts?.ready) {
      await frameDoc.fonts.ready;
    }

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
    const imgWidth = pageWidth;
    const fullImgHeight = (canvas.height * imgWidth) / canvas.width;

    if (fullImgHeight <= pageHeight) {
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, fullImgHeight);
    } else {
      const pxPerPt = canvas.width / pageWidth;
      const pageCanvasHeight = Math.floor(pageHeight * pxPerPt);
      let yOffset = 0;
      let pageIndex = 0;

      while (yOffset < canvas.height) {
        const remaining = canvas.height - yOffset;
        const sliceHeight = Math.min(pageCanvasHeight, remaining);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");

        if (!ctx) {
          throw new Error("Canvas context unavailable while paginating PDF.");
        }

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

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
        const pageImgHeight = (sliceHeight * imgWidth) / canvas.width;

        if (pageIndex > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, pageImgHeight);
        yOffset += sliceHeight;
        pageIndex += 1;
      }
    }

    const pdfBlob = dataUrlToBlob(pdf.output("datauristring"));
    const pdfUrl = URL.createObjectURL(pdfBlob);

    await chrome.downloads.download({
      url: pdfUrl,
      filename: fileName,
      saveAs: true,
    });

    URL.revokeObjectURL(pdfUrl);
  } finally {
    iframe.remove();
  }
}

// Modal skill management functions
function showSkillsModal(skills) {
  state.pendingSkills = [...skills];
  state.exportPending = true;

  // Render skill list
  renderSkillsList();

  // Clear input field
  els.newSkillInput.value = "";

  // Show modal
  els.skillsModal.classList.remove("hidden");

  // Focus on input for quick adding
  setTimeout(() => els.newSkillInput.focus(), 100);
}

function hideSkillsModal() {
  els.skillsModal.classList.add("hidden");
  state.exportPending = false;
  state.pendingSkills = [];
}

function renderSkillsList() {
  els.skillsList.innerHTML = state.pendingSkills
    .map(
      (skill, index) => `
    <div class="skill-item">
      <input 
        type="checkbox" 
        class="skill-checkbox" 
        data-index="${index}" 
        checked
      />
      <span class="skill-item-text">${escapeHtml(skill)}</span>
      <button class="skill-item-remove" data-index="${index}" title="Remove skill">×</button>
    </div>
  `,
    )
    .join("");

  // Add event listeners
  els.skillsList.querySelectorAll(".skill-item-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.target.dataset.index, 10);
      state.pendingSkills.splice(index, 1);
      renderSkillsList();
    });
  });
}

function addNewSkill() {
  const text = els.newSkillInput.value.trim();
  if (!text) {
    return;
  }

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
  const checkboxes = els.skillsList.querySelectorAll(".skill-checkbox:checked");
  return Array.from(checkboxes).map(
    (cb) => state.pendingSkills[parseInt(cb.dataset.index, 10)],
  );
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function continueExportWithSkills() {
  const selectedSkills = getSelectedSkills();
  state.profile.skills = selectedSkills;
  hideSkillsModal();

  // Continue with Steps 3-4 (navigate back and generate PDF)
  try {
    setStatus("Step 3: Returning to profile...");
    const username =
      state.profile.linkedinProfile.match(/\/in\/([^/?#]+)/)?.[1];
    if (username) {
      const profileUrl = `https://www.linkedin.com/in/${username}`;
      const tab = await getActiveTab();
      await chrome.tabs.update(tab.id, { url: profileUrl });
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const html = generateCv(state.profile);

    try {
      setStatus("Step 4: Generating PDF...");
      await createPdfFromHtml(html, state.profile.name);
      setStatus("PDF exported successfully.");
      hideUrlIndicator();
    } catch (pdfError) {
      setStatus(`PDF export failed: ${pdfError?.message || "unknown error"}`);
    }
  } catch (error) {
    setStatus(`Export failed: ${error?.message || "Unknown error"}`);
  }
}

async function exportFromCurrentTab() {
  try {
    // Hide URL indicator immediately when download starts
    els.urlIndicator.style.display = "none";
    els.urlStatus.style.display = "none";

    const tab = await getActiveTab();

    if (!tab?.id || !tab?.url) {
      setStatus("No active tab found.");
      // Show indicator again if tab not found
      els.urlIndicator.style.display = "";
      els.urlStatus.style.display = "";
      return;
    }

    if (!isValidLinkedInProfileUrl(tab.url)) {
      setStatus(
        "Invalid URL. Open a profile URL like linkedin.com/in/username.",
      );
      // Show indicator again if URL not valid
      els.urlIndicator.style.display = "";
      els.urlStatus.style.display = "";
      return;
    }

    setStatus("Step 1: Extracting profile data...");

    // Step 1: Inject extractor and extract profile data
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["extractor/linkedinExtractor.js"],
    });

    const [profileResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        if (typeof window.__linkedinToCvExtract !== "function") {
          return { ok: false, error: "Extractor not available." };
        }
        try {
          const profile = await window.__linkedinToCvExtract();
          return { ok: true, profile };
        } catch (error) {
          return { ok: false, error: error?.message || "Extraction failed." };
        }
      },
    });

    if (!profileResult?.result?.ok) {
      setStatus(profileResult?.result?.error || "Profile extraction failed.");
      return;
    }

    const profile = profileResult.result.profile;
    const username = profile.linkedinProfile.match(/\/in\/([^/?#]+)/)?.[1];

    // Step 2: Navigate to skills page and extract
    if (username) {
      setStatus("Step 2: Extracting skills...");
      const skillsUrl = `https://www.linkedin.com/in/${username}/details/skills/`;

      // Navigate to skills page
      await chrome.tabs.update(tab.id, { url: skillsUrl });

      // Wait for page to load
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Inject extractor and extract skills
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["extractor/linkedinExtractor.js"],
      });

      const [skillsResult] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (typeof window.__linkedinToCvExtractSkills !== "function") {
            return { ok: false, skills: [] };
          }
          try {
            const skills = window.__linkedinToCvExtractSkills();
            return { ok: true, skills };
          } catch {
            return { ok: false, skills: [] };
          }
        },
      });

      if (skillsResult?.result?.skills?.length) {
        profile.skills = skillsResult.result.skills;
      }
    }

    // Step 3: Check if user wants to review skills
    if (els.reviewSkillsCheckbox.checked && profile.skills?.length) {
      state.profile = {
        ...profile,
        name: profile.name || fallbackNameFromUrl(tab.url),
      };
      // Show indicator again while waiting for skills review
      els.urlIndicator.style.display = "";
      els.urlStatus.style.display = "";
      showSkillsModal(profile.skills);
      return;
    }

    // Step 3: Navigate back to profile page (normal flow)
    if (username) {
      setStatus("Step 3: Returning to profile...");
      const profileUrl = `https://www.linkedin.com/in/${username}`;
      await chrome.tabs.update(tab.id, { url: profileUrl });
      // Small wait to ensure we're back on the page
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // Step 4: Generate CV and download
    state.profile = {
      ...profile,
      name: profile.name || fallbackNameFromUrl(tab.url),
    };

    const html = generateCv(state.profile);

    try {
      setStatus("Step 4: Generating PDF...");
      await createPdfFromHtml(html, state.profile.name);
      setStatus("PDF exported successfully.");
      hideUrlIndicator();
    } catch (pdfError) {
      setStatus(`PDF export failed: ${pdfError?.message || "unknown error"}`);
      // Show indicator again if export failed
      els.urlIndicator.style.display = "";
      els.urlStatus.style.display = "";
    }
  } catch (error) {
    setStatus(`Export failed: ${error?.message || "Unknown error"}`);
    // Show indicator again if export failed
    els.urlIndicator.style.display = "";
    els.urlStatus.style.display = "";
  }
}

els.exportBtn.addEventListener("click", exportFromCurrentTab);

// Modal event listeners
els.addSkillBtn.addEventListener("click", addNewSkill);
els.newSkillInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addNewSkill();
  }
});
els.cancelSkillsBtn.addEventListener("click", () => {
  hideSkillsModal();
  setStatus("Export cancelled.");
});
els.doneSkillsBtn.addEventListener("click", continueExportWithSkills);

// Check URL validity when popup opens
checkUrlValidity();

// Re-check every second in case user switched tabs
setInterval(checkUrlValidity, 1000);
