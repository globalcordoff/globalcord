#!/usr/bin/env node
// Globalcord CLI Installer
// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const BASE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = join(BASE_DIR, "dist", "desktop");
const PKG      = JSON.parse(readFileSync(join(BASE_DIR, "package.json"), "utf-8"));
const LOCAL_VERSION = PKG.version ?? "0.0.0";
const REPO = "globalcordoff/globalcord";

// ── ANSI ─────────────────────────────────────────────────────────────────────
const R  = "\x1b[0m";
const B  = "\x1b[1m";
const DIM = "\x1b[2m";
const PUR = "\x1b[38;5;141m";   // violet text
const GRN = "\x1b[38;5;83m";
const RED = "\x1b[38;5;203m";
const YEL = "\x1b[38;5;220m";
const GRY = "\x1b[38;5;245m";
const WHT = "\x1b[97m";

const write = s => process.stdout.write(s);
const nl    = ()  => write("\n");
const hide  = ()  => write("\x1b[?25l");
const show  = ()  => write("\x1b[?25h");
const cls   = ()  => write("\x1b[2J\x1b[H");

// ── Banner ────────────────────────────────────────────────────────────────────
function banner(latestVer) {
    cls();
    write(`${PUR}${B}
   ██████╗ ██╗      ██████╗ ██████╗  █████╗ ██╗      ██████╗ ██████╗ ██████╗ ██████╗
  ██╔════╝ ██║     ██╔═══██╗██╔══██╗██╔══██╗██║     ██╔════╝██╔═══██╗██╔══██╗██╔══██╗
  ██║  ███╗██║     ██║   ██║██████╔╝███████║██║     ██║     ██║   ██║██████╔╝██║  ██║
  ██║   ██║██║     ██║   ██║██╔══██╗██╔══██║██║     ██║     ██║   ██║██╔══██╗██║  ██║
  ╚██████╔╝███████╗╚██████╔╝██████╔╝██║  ██║███████╗╚██████╗╚██████╔╝██║  ██║██████╔╝
   ╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝${R}
`);
    const verLine = latestVer
        ? `  ${GRY}local ${WHT}v${LOCAL_VERSION}${R}  ${GRY}latest ${WHT}v${latestVer}${R}`
        : `  ${GRY}v${LOCAL_VERSION}${R}`;
    write(verLine + "\n");
    write(`  ${GRY}${"─".repeat(80)}${R}\n\n`);
}

// ── Menu ──────────────────────────────────────────────────────────────────────
// items: array of strings (or null for blank line)
// returns selected index
function menu(title, items, hint) {
    const valid = items.map((it, i) => it != null ? i : -1).filter(i => i >= 0);
    let cur = valid[0];

    function render() {
        cls();
        banner._last && banner._last();
        write(`  ${B}${WHT}${title}${R}\n\n`);
        for (let i = 0; i < items.length; i++) {
            if (items[i] == null) { nl(); continue; }
            if (i === cur) {
                write(`  ${PUR}${B}> ${items[i]}${R}\n`);
            } else {
                write(`  ${GRY}  ${items[i]}${R}\n`);
            }
        }
        if (hint) write(`\n  ${DIM}${hint}${R}`);
        write(`\n\n  ${DIM}↑ ↓  navigate    Enter  confirm    Ctrl+C  exit${R}\n`);
    }

    return new Promise(resolve => {
        render();

        function onData(buf) {
            const key = buf.toString();
            if (key === "\x03") { show(); process.exit(0); }

            const up   = key === "\x1b[A";
            const down = key === "\x1b[B";
            const enter = key === "\r" || key === "\n";

            if (up) {
                const idx = valid.indexOf(cur);
                cur = valid[(idx - 1 + valid.length) % valid.length];
                render();
            } else if (down) {
                const idx = valid.indexOf(cur);
                cur = valid[(idx + 1) % valid.length];
                render();
            } else if (enter) {
                process.stdin.removeListener("data", onData);
                resolve(cur);
            }
        }

        process.stdin.on("data", onData);
    });
}

// ── Text prompt ───────────────────────────────────────────────────────────────
function ask(question) {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    show();
    return new Promise(resolve => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`  ${PUR}?${R} ${WHT}${question}${R} ${GRY}›${R} `, ans => {
            rl.close();
            if (process.stdin.isTTY) process.stdin.setRawMode(true);
            hide();
            resolve(ans.trim());
        });
    });
}

// ── Wait for keypress ─────────────────────────────────────────────────────────
function waitKey() {
    return new Promise(res => process.stdin.once("data", res));
}

// ── GitHub version check ──────────────────────────────────────────────────────
async function fetchLatestVersion() {
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
            headers: { "User-Agent": "Globalcord-CLI-Installer" }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return (data.tag_name ?? "").replace(/^v/, "");
    } catch { return null; }
}

// ── Progress bar helpers ──────────────────────────────────────────────────────
const BAR_WIDTH = 40;
const SPINNER   = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
let   _spinIdx  = 0;

function fmtBytes(b) {
    if (b < 1024)        return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function fmtSpeed(bps) {
    if (bps < 1024)        return `${bps.toFixed(0)} B/s`;
    if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
    return `${(bps / 1024 / 1024).toFixed(2)} MB/s`;
}

function drawBar(label, received, total, bps) {
    const pct   = total > 0 ? Math.min(received / total, 1) : 0;
    const filled = Math.round(pct * BAR_WIDTH);
    const bar   = `${PUR}${"█".repeat(filled)}${GRY}${"░".repeat(BAR_WIDTH - filled)}${R}`;
    const pctStr = `${Math.round(pct * 100)}%`.padStart(4);
    const sizeStr = total > 0
        ? `${fmtBytes(received)} / ${fmtBytes(total)}`
        : fmtBytes(received);
    const speedStr = bps > 0 ? `  ${fmtSpeed(bps)}` : "";

    // overwrite current line
    process.stdout.write(`\r  ${GRY}${label}${R}  ${bar}  ${WHT}${pctStr}${R}  ${GRY}${sizeStr}${speedStr}${R}  `);
}

function drawSpinner(label) {
    const s = SPINNER[_spinIdx++ % SPINNER.length];
    process.stdout.write(`\r  ${PUR}${s}${R}  ${GRY}${label}...${R}  `);
}

// ── Download with live progress ───────────────────────────────────────────────
async function downloadLatestDist(latestVer) {
    const { execSync } = await import("child_process");
    const { createWriteStream } = await import("fs");

    try {
        // 1. Fetch release info
        write(`\n  ${GRY}Fetching release info...${R}\n`);
        const apiRes = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
            headers: { "User-Agent": "Globalcord-CLI-Installer" }
        });
        if (!apiRes.ok) { write(`  ${RED}GitHub API error: ${apiRes.status}${R}\n`); return false; }
        const data  = await apiRes.json();
        const asset = data.assets?.find(a => a.name === "globalcord-dist.zip");
        if (!asset) { write(`  ${RED}globalcord-dist.zip not found in release.${R}\n`); return false; }

        const totalSize = asset.size ?? 0;
        write(`  ${GRY}File: ${WHT}globalcord-dist.zip${R}  ${GRY}(${fmtBytes(totalSize)})${R}\n\n`);

        // 2. Stream download with progress
        const zipPath = join(BASE_DIR, "_gc_update.zip");
        const dlRes   = await fetch(asset.browser_download_url, {
            headers: { "User-Agent": "Globalcord-CLI-Installer" }
        });
        if (!dlRes.ok) { write(`  ${RED}Download failed: ${dlRes.status}${R}\n`); return false; }

        const contentLength = parseInt(dlRes.headers.get("content-length") ?? "0", 10) || totalSize;
        let received = 0;
        let lastReceived = 0;
        let lastTime = Date.now();
        let bps = 0;

        const fileStream = createWriteStream(zipPath);
        const reader     = dlRes.body.getReader();

        // Redraw progress every 80ms
        const timer = setInterval(() => {
            const now  = Date.now();
            const dt   = (now - lastTime) / 1000;
            if (dt > 0) { bps = (received - lastReceived) / dt; lastReceived = received; lastTime = now; }
            drawBar("Downloading", received, contentLength, bps);
        }, 80);

        // Read stream
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fileStream.write(value);
            received += value.length;
        }
        clearInterval(timer);
        drawBar("Downloading", received, contentLength, 0);
        await new Promise((res, rej) => fileStream.end(err => err ? rej(err) : res()));
        write(`\n  ${GRN}✓ Download complete${R}\n\n`);

        // 3. Extract with spinner
        write(`  `);
        const spinTimer = setInterval(() => drawSpinner("Extracting"), 100);

        if (existsSync(DIST_DIR)) rmSync(DIST_DIR, { recursive: true, force: true });
        mkdirSync(DIST_DIR, { recursive: true });

        if (process.platform === "win32") {
            execSync(
                `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${DIST_DIR}' -Force"`,
                { stdio: "pipe" }
            );
        } else {
            execSync(`unzip -o "${zipPath}" -d "${DIST_DIR}"`, { stdio: "pipe" });
        }

        clearInterval(spinTimer);
        process.stdout.write(`\r  ${GRN}✓ Extracted successfully${R}                          \n`);

        rmSync(zipPath, { force: true });
        return true;

    } catch (e) {
        write(`\n  ${RED}Error: ${e.message}${R}\n`);
        return false;
    }
}

// ── Discord detection ─────────────────────────────────────────────────────────
const CHANNELS = [
    { id: "Discord",            label: "Discord Stable"  },
    { id: "DiscordPTB",         label: "Discord PTB"     },
    { id: "DiscordCanary",      label: "Discord Canary"  },
    { id: "DiscordDevelopment", label: "Discord Dev"     },
];

function findInstalls() {
    if (process.platform !== "win32") return [];
    const base = process.env.LOCALAPPDATA ?? "";
    const found = [];
    for (const ch of CHANNELS) {
        const chPath = join(base, ch.id);
        if (!existsSync(chPath)) continue;
        try {
            const ver = readdirSync(chPath)
                .filter(d => /^app-\d+\.\d+\.\d+$/.test(d))
                .sort().reverse()[0];
            if (!ver) continue;
            const res = join(chPath, ver, "resources");
            if (!existsSync(res)) continue;
            const injected = (() => {
                try { return JSON.parse(readFileSync(join(res, "app", "package.json"), "utf-8")).name === "globalcord"; }
                catch { return false; }
            })();
            found.push({ label: ch.label, version: ver, resourcesDir: res, injected });
        } catch { }
    }
    return found;
}

// ── Inject / Uninject ─────────────────────────────────────────────────────────
function doInject(dir) {
    const asar   = join(dir, "app.asar");
    const backup = join(dir, "_app.asar");
    const appDir = join(dir, "app");

    if (existsSync(appDir)) {
        try {
            const n = JSON.parse(readFileSync(join(appDir, "package.json"), "utf-8")).name;
            if (n === "globalcord") return { ok: false, msg: "Already installed. Uninstall first." };
        } catch { }
        return { ok: false, msg: "Another mod detected. Uninstall it first." };
    }
    if (existsSync(asar) && !existsSync(backup)) {
        if (statSync(asar).isDirectory()) return { ok: false, msg: "app.asar is a directory — another mod may be installed." };
        renameSync(asar, backup);
    } else if (!existsSync(backup)) {
        return { ok: false, msg: "No app.asar found." };
    }
    if (existsSync(asar)) rmSync(asar, { recursive: true, force: true });
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "package.json"), JSON.stringify({ name: "globalcord", main: "index.js" }, null, 2));
    const patcher = join(DIST_DIR, "patcher.js").replace(/\\/g, "\\\\");
    writeFileSync(join(appDir, "index.js"), `"use strict";\nrequire("${patcher}");\n`);
    return { ok: true };
}

function doUninject(dir) {
    const asar   = join(dir, "app.asar");
    const backup = join(dir, "_app.asar");
    const appDir = join(dir, "app");
    if (existsSync(appDir)) rmSync(appDir, { recursive: true, force: true });
    if (existsSync(backup)) {
        if (existsSync(asar)) rmSync(asar, { recursive: true, force: true });
        renameSync(backup, asar);
        return { ok: true };
    }
    return { ok: false, msg: "No backup found — Globalcord may not be installed here." };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
    hide();

    // Check latest version from GitHub
    cls();
    write(`\n  ${GRY}Checking latest version...${R}\n`);
    const latestVer = await fetchLatestVersion();

    // Store banner state for re-renders
    banner._last = () => banner(latestVer);
    banner(latestVer);

    // Notify if update available
    let needsUpdate = false;
    if (latestVer && latestVer !== LOCAL_VERSION) {
        write(`  ${YEL}New version available: ${WHT}v${latestVer}${R}  ${GRY}(local: v${LOCAL_VERSION})${R}\n\n`);
        needsUpdate = true;
    } else if (latestVer) {
        write(`  ${GRN}Up to date.${R}\n\n`);
    }

    // ── Step 1: action ────────────────────────────────────────────────────────
    const actionIdx = await menu("What do you want to do?", [
        "Install Globalcord",
        "Uninstall Globalcord",
    ]);
    const isInstall = actionIdx === 0;

    // ── Step 2: update dist if needed (install only) ──────────────────────────
    if (isInstall) {
        if (needsUpdate || !existsSync(join(DIST_DIR, "patcher.js"))) {
            banner(latestVer);
            const reason = !existsSync(join(DIST_DIR, "patcher.js"))
                ? "Build not found locally."
                : `Update available: v${latestVer}`;
            write(`  ${YEL}${reason}${R}\n`);
            const dlIdx = await menu("Download latest build from GitHub?", [
                `Yes — download v${latestVer ?? "latest"}`,
                "No  — use local build (may fail)",
            ]);
            if (dlIdx === 0) {
                banner(latestVer);
                const ok = await downloadLatestDist(latestVer ?? "latest");
                if (!ok) {
                    write(`\n  ${RED}Download failed. Aborting.${R}\n\n  ${DIM}Press any key...${R}\n`);
                    await waitKey();
                    show(); process.exit(1);
                }
            } else if (!existsSync(join(DIST_DIR, "patcher.js"))) {
                write(`\n  ${RED}No local build found. Run  pnpm build  first.${R}\n\n  ${DIM}Press any key...${R}\n`);
                await waitKey();
                show(); process.exit(1);
            }
        }
    }

    // ── Step 3: choose target ─────────────────────────────────────────────────
    const installs = findInstalls();
    const items = [];
    const meta  = [];

    for (const inst of installs) {
        const tag = inst.injected ? `  ${GRN}[installed]${R}` : "";
        items.push(`${inst.label}  ${GRY}${inst.version}${R}${tag}`);
        meta.push(inst);
    }
    if (items.length) items.push(null), meta.push(null); // separator
    items.push("Manual path...");
    meta.push(null);

    const hint = installs.length === 0 ? "No Discord installations detected automatically." : "";
    const tIdx = await menu(
        isInstall ? "Select Discord to install into:" : "Select Discord to uninstall from:",
        items,
        hint
    );

    let resourcesDir;
    if (meta[tIdx] != null) {
        resourcesDir = meta[tIdx].resourcesDir;
    } else {
        resourcesDir = await ask("Enter full path to Discord's resources folder:");
        if (!resourcesDir) { show(); process.exit(0); }
        if (!existsSync(resourcesDir)) {
            banner(latestVer);
            write(`\n  ${RED}Path not found: ${resourcesDir}${R}\n\n  ${DIM}Press any key...${R}\n`);
            await waitKey();
            show(); process.exit(1);
        }
    }

    // ── Step 4: perform ───────────────────────────────────────────────────────
    banner(latestVer);
    write(`\n`);

    // Spinner during file operations
    const opLabel = isInstall ? "Installing Globalcord" : "Uninstalling Globalcord";
    write(`  `);
    const opTimer = setInterval(() => drawSpinner(opLabel), 80);

    const result = isInstall ? doInject(resourcesDir) : doUninject(resourcesDir);

    clearInterval(opTimer);
    process.stdout.write(`\r  ${result.ok ? GRN : RED}${result.ok ? "✓" : "✗"}  ${opLabel}${R}                    \n\n`);
    if (result.ok) {
        write(`  ${GRY}Target: ${resourcesDir}${R}\n`);
        write(`\n  ${WHT}Restart Discord to apply changes.${R}\n`);
    } else {
        write(`  ${RED}${result.msg ?? "Unknown error."}${R}\n`);
    }

    write(`\n  ${DIM}Press any key to exit...${R}\n`);
    await waitKey();
    show();
    process.exit(result.ok ? 0 : 1);
}

main().catch(err => {
    show();
    if (process.stdin.isTTY) try { process.stdin.setRawMode(false); } catch { }
    console.error(`\n  Fatal: ${err.message}`);
    process.exit(1);
});
