#!/usr/bin/env node
/*
 * Globalcord — Interactive CLI Installer
 * Navigate with arrow keys, Enter to confirm, Ctrl+C to exit.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const BASE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = join(BASE_DIR, "dist", "desktop");
const PKG      = JSON.parse(readFileSync(join(BASE_DIR, "package.json"), "utf-8"));
const VERSION  = PKG.version ?? "unknown";

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const ESC   = "\x1b[";
const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";

// Purple / violet palette
const PURPLE      = "\x1b[38;5;135m";   // selected item text
const PURPLE_BG   = "\x1b[48;5;55m";    // selected item background
const PURPLE_BOLD = "\x1b[1;38;5;135m";
const CYAN        = "\x1b[38;5;117m";
const GREEN       = "\x1b[38;5;83m";
const RED         = "\x1b[38;5;203m";
const YELLOW      = "\x1b[38;5;220m";
const GRAY        = "\x1b[38;5;245m";
const WHITE       = "\x1b[97m";

function clr(code, text) { return `${code}${text}${RESET}`; }
function hide()  { process.stdout.write("\x1b[?25l"); }
function show()  { process.stdout.write("\x1b[?25h"); }
function clear() { process.stdout.write("\x1b[2J\x1b[H"); }
function moveTo(row, col) { process.stdout.write(`${ESC}${row};${col}H`); }
function clearLine() { process.stdout.write("\x1b[2K"); }

// ── ASCII Banner ──────────────────────────────────────────────────────────────
const BANNER = `
${PURPLE_BOLD}   ██████╗ ██╗      ██████╗ ██████╗  █████╗ ██╗      ██████╗ ██████╗ ██████╗ ██████╗ ${RESET}
${PURPLE_BOLD}  ██╔════╝ ██║     ██╔═══██╗██╔══██╗██╔══██╗██║     ██╔════╝██╔═══██╗██╔══██╗██╔══██╗${RESET}
${PURPLE_BOLD}  ██║  ███╗██║     ██║   ██║██████╔╝███████║██║     ██║     ██║   ██║██████╔╝██║  ██║${RESET}
${PURPLE_BOLD}  ██║   ██║██║     ██║   ██║██╔══██╗██╔══██║██║     ██║     ██║   ██║██╔══██╗██║  ██║${RESET}
${PURPLE_BOLD}  ╚██████╔╝███████╗╚██████╔╝██████╔╝██║  ██║███████╗╚██████╗╚██████╔╝██║  ██║██████╔╝${RESET}
${PURPLE_BOLD}   ╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ ${RESET}
${GRAY}  ─────────────────────────────────────────────────────────────────────────────────${RESET}
${GRAY}  Everything Discord doesn't build, we create.${RESET}${GRAY}                  v${VERSION}${RESET}
`;

// ── Menu renderer ─────────────────────────────────────────────────────────────
function renderMenu(title, items, selected, hint = "") {
    clear();
    process.stdout.write(BANNER + "\n");
    process.stdout.write(`  ${BOLD}${WHITE}${title}${RESET}\n\n`);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item === null) {
            process.stdout.write(`\n`);
            continue;
        }
        const isSelected = i === selected;
        const prefix = isSelected ? `${PURPLE_BG}${PURPLE_BOLD}  ❯ ` : `${GRAY}    `;
        const suffix = isSelected ? `  ${RESET}` : RESET;
        const icon   = item.icon ? `${item.icon}  ` : "   ";
        process.stdout.write(`${prefix}${icon}${item.label}${suffix}\n`);
    }

    if (hint) {
        process.stdout.write(`\n  ${GRAY}${hint}${RESET}\n`);
    }
    process.stdout.write(`\n  ${DIM}↑↓ navigate   Enter select   Ctrl+C exit${RESET}\n`);
}

// ── Keyboard input ────────────────────────────────────────────────────────────
function setupRaw() {
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
}

function teardownRaw() {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
}

function prompt(items, selected = 0) {
    return new Promise(resolve => {
        // skip null separators
        const validIndices = items.map((it, i) => it !== null ? i : -1).filter(i => i >= 0);
        let cur = validIndices.includes(selected) ? selected : validIndices[0];

        function next() {
            const idx = validIndices.indexOf(cur);
            cur = validIndices[(idx + 1) % validIndices.length];
        }
        function prev() {
            const idx = validIndices.indexOf(cur);
            cur = validIndices[(idx - 1 + validIndices.length) % validIndices.length];
        }

        function onKey(key) {
            if (key === "\x03") { show(); teardownRaw(); clear(); process.exit(0); }
            if (key === "\x1b[A" || key === "\x1b[D") { prev(); return; } // up / left
            if (key === "\x1b[B" || key === "\x1b[C") { next(); return; } // down / right
            if (key === "\r" || key === "\n") {
                process.stdin.removeListener("data", onKey);
                resolve(cur);
                return;
            }
        }

        process.stdin.on("data", onKey);
    });
}

// ── Text input ────────────────────────────────────────────────────────────────
async function promptText(question) {
    teardownRaw();
    show();
    return new Promise(resolve => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`\n  ${PURPLE_BOLD}?${RESET} ${WHITE}${question}${RESET} ${GRAY}›${RESET} `, answer => {
            rl.close();
            setupRaw();
            hide();
            resolve(answer.trim());
        });
    });
}

// ── Discord detection ─────────────────────────────────────────────────────────
const DISCORD_CHANNELS = [
    { id: "Discord",            label: "Discord Stable",   icon: "💬" },
    { id: "DiscordPTB",         label: "Discord PTB",      icon: "🔧" },
    { id: "DiscordCanary",      label: "Discord Canary",   icon: "🐤" },
    { id: "DiscordDevelopment", label: "Discord Dev",      icon: "⚗️ " },
];

function findDiscordInstalls() {
    const found = [];
    if (process.platform !== "win32") return found;
    const base = process.env.LOCALAPPDATA || "";

    for (const ch of DISCORD_CHANNELS) {
        const chPath = join(base, ch.id);
        if (!existsSync(chPath)) continue;
        try {
            const versions = readdirSync(chPath)
                .filter(d => /^app-\d+\.\d+\.\d+$/.test(d))
                .sort().reverse();
            for (const ver of versions) {
                const res = join(chPath, ver, "resources");
                if (existsSync(res)) {
                    const isInjected = existsSync(join(res, "app", "package.json")) &&
                        (() => { try { return JSON.parse(readFileSync(join(res, "app", "package.json"), "utf-8")).name === "globalcord"; } catch { return false; } })();
                    found.push({ ...ch, version: ver, resourcesDir: res, isInjected });
                    break; // only latest version per channel
                }
            }
        } catch { }
    }
    return found;
}

// ── Inject / Uninject ─────────────────────────────────────────────────────────
function doInject(resourcesDir) {
    const appAsarPath = join(resourcesDir, "app.asar");
    const backupPath  = join(resourcesDir, "_app.asar");
    const appDirPath  = join(resourcesDir, "app");

    if (existsSync(appDirPath)) {
        try {
            const pkg = JSON.parse(readFileSync(join(appDirPath, "package.json"), "utf-8"));
            if (pkg.name === "globalcord") return { ok: false, msg: "Already injected. Uninstall first." };
        } catch { }
        return { ok: false, msg: "Another mod is installed. Uninstall it first." };
    }

    if (existsSync(appAsarPath) && !existsSync(backupPath)) {
        if (statSync(appAsarPath).isDirectory())
            return { ok: false, msg: "app.asar is a directory — another mod may be installed." };
        renameSync(appAsarPath, backupPath);
    } else if (!existsSync(backupPath)) {
        return { ok: false, msg: "No app.asar found in resources." };
    }

    if (existsSync(appAsarPath)) rmSync(appAsarPath, { recursive: true, force: true });

    mkdirSync(appDirPath, { recursive: true });
    writeFileSync(join(appDirPath, "package.json"), JSON.stringify({ name: "globalcord", main: "index.js" }, null, 2));
    const patcher = join(DIST_DIR, "patcher.js").replace(/\\/g, "\\\\");
    writeFileSync(join(appDirPath, "index.js"), `"use strict";\nrequire("${patcher}");\n`);
    return { ok: true };
}

function doUninject(resourcesDir) {
    const appAsarPath = join(resourcesDir, "app.asar");
    const backupPath  = join(resourcesDir, "_app.asar");
    const appDirPath  = join(resourcesDir, "app");

    if (existsSync(appDirPath)) rmSync(appDirPath, { recursive: true, force: true });

    if (existsSync(backupPath)) {
        if (existsSync(appAsarPath)) rmSync(appAsarPath, { recursive: true, force: true });
        renameSync(backupPath, appAsarPath);
        return { ok: true };
    }
    return { ok: false, msg: "No backup found — Globalcord may not be installed here." };
}

// ── Result screen ─────────────────────────────────────────────────────────────
function showResult(success, lines) {
    clear();
    process.stdout.write(BANNER + "\n");
    const color = success ? GREEN : RED;
    const icon  = success ? "✓" : "✗";
    process.stdout.write(`  ${color}${BOLD}${icon} ${lines[0]}${RESET}\n`);
    for (let i = 1; i < lines.length; i++) {
        process.stdout.write(`    ${GRAY}${lines[i]}${RESET}\n`);
    }
    process.stdout.write(`\n  ${DIM}Press any key to exit...${RESET}\n`);
    return new Promise(res => {
        process.stdin.once("data", () => res());
    });
}

// ── Main flow ─────────────────────────────────────────────────────────────────
async function main() {
    setupRaw();
    hide();

    // ── Step 1: Install / Uninstall ──────────────────────────────────────────
    const mainItems = [
        { label: "Install Globalcord",   icon: "⬇️ " },
        { label: "Uninstall Globalcord", icon: "🗑️ " },
    ];

    let actionIdx;
    while (true) {
        renderMenu("What do you want to do?", mainItems, actionIdx ?? 0);
        actionIdx = await prompt(mainItems, actionIdx ?? 0);
        break;
    }
    const isInstall = actionIdx === 0;

    // ── Step 2: Check build for install ─────────────────────────────────────
    if (isInstall && !existsSync(join(DIST_DIR, "patcher.js"))) {
        show(); teardownRaw();
        await showResult(false, [
            "Build not found!",
            "Run  pnpm build  first, then try again.",
            `Expected: ${join(DIST_DIR, "patcher.js")}`,
        ]);
        process.exit(1);
    }

    // ── Step 3: Choose Discord target ────────────────────────────────────────
    const installs = findDiscordInstalls();

    const targetItems = [];
    for (const inst of installs) {
        const tag = inst.isInjected ? clr(GREEN, " [installed]") : "";
        targetItems.push({ label: `${inst.label}  ${GRAY}${inst.version}${RESET}${tag}`, icon: inst.icon, _data: inst });
    }
    if (targetItems.length > 0) targetItems.push(null); // separator
    targetItems.push({ label: "Manual path...", icon: "📁", _data: null });

    let targetIdx;
    while (true) {
        renderMenu(
            isInstall ? "Select Discord to install into:" : "Select Discord to uninstall from:",
            targetItems,
            targetIdx ?? 0,
            installs.length === 0 ? "No Discord installations detected automatically." : ""
        );
        targetIdx = await prompt(targetItems, targetIdx ?? 0);
        break;
    }

    const chosen = targetItems[targetIdx];
    let resourcesDir;

    if (chosen._data === null) {
        // Manual path
        const raw = await promptText("Enter the full path to Discord's resources folder:");
        if (!raw) { show(); teardownRaw(); process.exit(0); }
        resourcesDir = raw;
        if (!existsSync(resourcesDir)) {
            show(); teardownRaw();
            await showResult(false, [`Path not found: ${resourcesDir}`]);
            process.exit(1);
        }
    } else {
        resourcesDir = chosen._data.resourcesDir;
    }

    // ── Step 4: Perform action ───────────────────────────────────────────────
    const result = isInstall ? doInject(resourcesDir) : doUninject(resourcesDir);

    show(); teardownRaw();

    if (result.ok) {
        await showResult(true, [
            isInstall ? "Globalcord installed successfully!" : "Globalcord uninstalled successfully!",
            `Target: ${resourcesDir}`,
            "Restart Discord to apply changes.",
        ]);
    } else {
        await showResult(false, [
            isInstall ? "Installation failed." : "Uninstallation failed.",
            result.msg ?? "Unknown error.",
        ]);
        process.exit(1);
    }
}

main().catch(err => {
    show();
    teardownRaw();
    console.error(clr(RED, "\n  Fatal error: ") + err.message);
    process.exit(1);
});
