/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

const STORAGE_KEY = "Globalcord_panelHide";

let _hidden = false;
try { _hidden = localStorage.getItem(STORAGE_KEY) === "1"; } catch { }

const listeners = new Set<() => void>();

export function isPanelHidden(): boolean {
    return _hidden;
}

export function _notifyPanelHideChange() {
    listeners.forEach(fn => fn());
    window.dispatchEvent(new Event("globalcord-panel-hide-change"));
}

export function addPanelHideListener(fn: () => void) { listeners.add(fn); }
export function removePanelHideListener(fn: () => void) { listeners.delete(fn); }

function togglePanelHide() {
    _hidden = !_hidden;
    try { _hidden ? localStorage.setItem(STORAGE_KEY, "1") : localStorage.removeItem(STORAGE_KEY); } catch { }
    _notifyPanelHideChange();
}

function onKeyDown(e: KeyboardEvent) {
    if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.code === "KeyP") {
        e.preventDefault();
        e.stopPropagation();
        togglePanelHide();
    }
}

export default definePlugin({
    name: "PanelHide",
    enabledByDefault: true,
    description: "Hides FakeDM button, Fake Friends context menu entries and Globalcord Settings panel. Toggle with Alt+P.",
    authors: [{ name: "Globalcord", id: 0n }],
    required: true,

    start() {
        document.addEventListener("keydown", onKeyDown, true);
    },

    stop() {
        document.removeEventListener("keydown", onKeyDown, true);
    },
});
