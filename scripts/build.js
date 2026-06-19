#!/usr/bin/env node
/**
 * Build script for LinkedIn to CV Builder extension.
 *
 * Usage:
 *   node scripts/build.js chrome    → dist/chrome-v{version}.zip
 *   node scripts/build.js firefox   → dist/firefox-v{version}.zip
 *   node scripts/build.js           → builds both
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const EXTENSION_FILES = [
  "popup",
  "extractor",
  "renderer",
  "vendor",
  "icons",
  "assets",
];

function getVersion() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"),
  );
  return manifest.version;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function build(target) {
  const version = getVersion();
  const manifestSrc = path.join(ROOT, `manifest.${target}.json`);

  if (!fs.existsSync(manifestSrc)) {
    console.error(`Missing manifest.${target}.json`);
    process.exit(1);
  }

  ensureDir(DIST);

  // Copy the target manifest over as manifest.json for zipping
  fs.copyFileSync(manifestSrc, path.join(ROOT, "manifest.json"));

  const outFile = path.join(DIST, `${target}-v${version}.zip`);
  const filesToZip = ["manifest.json", ...EXTENSION_FILES].join(" ");

  // Use PowerShell's Compress-Archive on Windows, zip on Unix
  if (process.platform === "win32") {
    const items = ["manifest.json", ...EXTENSION_FILES]
      .map((f) => `"${path.join(ROOT, f)}"`)
      .join(", ");
    execSync(
      `powershell -Command "Compress-Archive -Force -Path ${items} -DestinationPath '${outFile}'"`,
      { stdio: "inherit", cwd: ROOT },
    );
  } else {
    execSync(`zip -r "${outFile}" ${filesToZip} --exclude "*.DS_Store"`, {
      stdio: "inherit",
      cwd: ROOT,
    });
  }

  console.log(`✓ ${target} → dist/${path.basename(outFile)}`);
}

const target = process.argv[2];
if (target === "chrome" || target === "firefox") {
  build(target);
} else if (!target) {
  build("chrome");
  build("firefox");
} else {
  console.error("Usage: node scripts/build.js [chrome|firefox]");
  process.exit(1);
}
