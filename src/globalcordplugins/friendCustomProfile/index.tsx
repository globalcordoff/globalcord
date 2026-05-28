/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../customProfile/styles.css";

import { ProfileBadge } from "@api/Badges";
import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { DataStore } from "@api/index";
import { isPanelHidden, addPanelHideListener, removePanelHideListener } from "@globalcordplugins/panelHide";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { FluxDispatcher, IconUtils, Menu, React, SnowflakeUtils, UserStore } from "@webpack/common";

import { t } from "../autoTranslateGlobalcord";

// ── Shared constants (copied from customProfile to avoid circular imports) ──
const FLAG = {
    STAFF: 1, PARTNER: 2, HYPESQUAD: 4, BUG_HUNTER_1: 8,
    BRAVERY: 64, BRILLIANCE: 128, BALANCE: 256, EARLY_SUPPORTER: 512,
    BUG_HUNTER_2: 16384, DEV_VERIFIED: 131072, MOD_ALUMNI: 262144, ACTIVE_DEVELOPER: 4194304,
};
const BADGES = [
    { label: t("Staff Discord"), flag: FLAG.STAFF, icon: "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png" },
    { label: t("Partenaire"), flag: FLAG.PARTNER, icon: "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png" },
    { label: t("HypeSquad Events"), flag: FLAG.HYPESQUAD, icon: "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png" },
    { label: t("Bug Hunter Lvl 1"), flag: FLAG.BUG_HUNTER_1, icon: "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png" },
    { label: t("HypeSquad Bravery"), flag: FLAG.BRAVERY, icon: "https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png" },
    { label: t("HypeSquad Brilliance"), flag: FLAG.BRILLIANCE, icon: "https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png" },
    { label: t("HypeSquad Balance"), flag: FLAG.BALANCE, icon: "https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png" },
    { label: t("Early Supporter"), flag: FLAG.EARLY_SUPPORTER, icon: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png" },
    { label: t("Former Moderator"), flag: FLAG.MOD_ALUMNI, icon: "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png" },
    { label: t("Bug Hunter Lvl 2"), flag: FLAG.BUG_HUNTER_2, icon: "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png" },
    { label: t("Verified Developer"), flag: FLAG.DEV_VERIFIED, icon: "https://cdn.discordapp.com/badge-icons/6df5892e0f35b051f8b61eace34f4967.png" },
    { label: t("Active Developer"), flag: FLAG.ACTIVE_DEVELOPER, icon: "https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png" },
];
const OLD_NAME_BADGE_ICON = "https://cdn.discordapp.com/badge-icons/6de6d34650760ba5551a79732e98ed60.png";
const NITRO_LEVELS = [
    { label: t("Nitro (0 mois)"), icon: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png" },
    { label: t("Bronze (1 mois)"), icon: "https://cdn.discordapp.com/badge-icons/4f33c4a9c64ce221936bd256c356f91f.png" },
    { label: t("Argent (2 mois)"), icon: "https://cdn.discordapp.com/badge-icons/4514fab914bdbfb4ad2fa23df76121a6.png" },
    { label: t("Or (3 mois)"), icon: "https://cdn.discordapp.com/badge-icons/2895086c18d5531d499862e41d1155a6.png" },
    { label: t("Platine (6 mois)"), icon: "https://cdn.discordapp.com/badge-icons/0334688279c8359120922938dcb1d6f8.png" },
    { label: t("Diamant (12 mois)"), icon: "https://cdn.discordapp.com/badge-icons/0d61871f72bb9a33a7ae568c1fb4f20a.png" },
    { label: t("Émeraude (24 mois)"), icon: "https://cdn.discordapp.com/badge-icons/11e2d339068b55d3a506cff34d3780f3.png" },
    { label: t("Rubis (36 mois)"), icon: "https://cdn.discordapp.com/badge-icons/cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4.png" },
    { label: t("Opale (72 mois)"), icon: "https://cdn.discordapp.com/badge-icons/5b154df19c53dce2af92c9b61e6be5e2.png" },
];
const BOOST_LABELS = ["1 Mois", "2 Mois", "3 Mois", "6 Mois", "9 Mois", "12 Mois", "15 Mois", "18 Mois", "24 Mois"].map(l => t(l));
const BOOST_ICONS = [
    "https://cdn.discordapp.com/badge-icons/51040c70d4f20a921ad6674ff86fc95c.png",
    "https://cdn.discordapp.com/badge-icons/0e4080d1d333bc7ad29ef6528b6f2fb7.png",
    "https://cdn.discordapp.com/badge-icons/72bed924410c304dbe3d00a6e593ff59.png",
    "https://cdn.discordapp.com/badge-icons/df199d2050d3ed4ebf84d64ae83989f8.png",
    "https://cdn.discordapp.com/badge-icons/996b3e870e8a22ce519b3a50e6bdd52f.png",
    "https://cdn.discordapp.com/badge-icons/991c9f39ee33d7537d9f408c3e53141e.png",
    "https://cdn.discordapp.com/badge-icons/cb3ae83c15e970e8f3d410bc62cb8b99.png",
    "https://cdn.discordapp.com/badge-icons/7142225d31238f6387d9f09efaa02759.png",
    "https://cdn.discordapp.com/badge-icons/ec92202290b48d0879b7413d2dde3bab.png",
];
const AVATAR_DECORATIONS = [
    { id: "1144307957425778779", label: "Hearts" }, { id: "1144308196723408958", label: "Hearts Animated" },
    { id: "1212569433839636530", label: "Lofi Cafe" }, { id: "1481387347642810480", label: "Winter" },
    { id: "1343751617362661526", label: "Magic Orb" }, { id: "1373015260465987705", label: "Dragon" },
    { id: "1333866045303423026", label: "Ghost" }, { id: "1144308439720394944", label: "Sakura Drift" },
    { id: "1432550258126229565", label: "Neon" }, { id: "1462116613632426014", label: "Cyber City" },
    { id: "1462116613682757888", label: "Retro" }, { id: "1144307629225672846", label: "Fire" },
    { id: "1341506443718688768", label: "Void" }, { id: "1447654090640330763", label: "Celestial" },
    { id: "1483857762890022923", label: "Snowy" }, { id: "1479561706672885811", label: "Ice" },
    { id: "1212569856189407352", label: "Cozy" }, { id: "1485784028710830242", label: "New Year" },
    { id: "1341506444150702080", label: "Abyss" }, { id: "1232071712695386162", label: "Spring" },
    { id: "1220514048068812901", label: "Summer" }, { id: "1427463138634109026", label: "Autumn" },
    { id: "1341506443865489408", label: "Darkness" },
];
function getDecorationUrl(assetId: string): string {
    return `https://cdn.discordapp.com/media/v1/collectibles-shop/${assetId}/static`;
}

// ── Data types ──
interface FriendProfileData {
    username?: string;
    globalName?: string;
    avatar?: string;
    banner?: string;
    bio?: string;
    accentColor?: number;
    accentColor2?: number;
    pronouns?: string;
    badgeFlags?: number;
    createdAt?: string;
    nitro?: boolean;
    nitroLevel?: number;
    boostMonths?: number;
    customBadgeIds?: string[];
    oldName?: string;
    decorationAsset?: string;
}

const DS_KEY = "friendCustomProfile_data";

// userId → profile data
let friendProfiles: Record<string, FriendProfileData> = {};
// per-user clone cache
const cloneCache = new Map<string, { orig: any; clone: any; version: number; }>();
let _version = 0;

async function loadProfiles() {
    try {
        const saved = await DataStore.get<Record<string, FriendProfileData>>(DS_KEY);
        if (saved && typeof saved === "object") friendProfiles = saved;
    } catch { }
}

async function saveProfiles() {
    try { await DataStore.set(DS_KEY, friendProfiles); } catch { }
}

function forceRerender() {
    try {
        const WP = (Vencord as any).Webpack;
        WP?.findByStoreName?.("UserStore")?.emitChange?.();
        WP?.findByStoreName?.("UserProfileStore")?.emitChange?.();
        FluxDispatcher.dispatch({ type: "USER_SETTINGS_PROTO_UPDATE", settings: { type: 1, proto: {} } });
    } catch { }
}

function fakeUserForId(user: any): any {
    if (!user) return user;
    const uid: string = user?.id ?? user?.userId;
    if (!uid) return user;
    const data = friendProfiles[uid];
    if (!data) return user;

    const cached = cloneCache.get(uid);
    if (cached && cached.orig === user && cached.version === _version) return cached.clone;

    const clone = Object.create(Object.getPrototypeOf(user));
    for (const key of Reflect.ownKeys(user)) {
        const desc = Object.getOwnPropertyDescriptor(user, key);
        if (desc) Object.defineProperty(clone, key, desc);
    }

    if (data.username) clone.username = data.username;
    if (data.globalName) clone.globalName = data.globalName;
    if (data.globalName) clone.displayName = data.globalName;
    if (data.globalName) clone.getGlobalName = () => data.globalName;

    if (data.avatar) {
        clone.avatar = data.avatar;
        clone._fcp_avatarUrl = data.avatar;
    }

    if (data.createdAt) {
        const fakeDate = new Date(data.createdAt + "T12:00:00Z");
        Object.defineProperty(clone, "createdAt", { get: () => fakeDate, configurable: true, enumerable: true });
    }

    if (data.badgeFlags != null) {
        clone.publicFlags = data.badgeFlags;
        clone.flags = data.badgeFlags;
    }

    if (data.nitro) {
        clone.premiumType = 2;
        const LEVEL_MONTHS = [1, 2, 3, 6, 12, 24, 36, 72];
        const since = new Date();
        since.setMonth(since.getMonth() - (LEVEL_MONTHS[data.nitroLevel ?? 0] ?? 1));
        clone.premiumSince = since;
        if ((data.boostMonths ?? -1) >= 0) {
            const BOOST_M = [1, 2, 3, 6, 9, 12, 15, 18, 24];
            const bSince = new Date();
            bSince.setMonth(bSince.getMonth() - (BOOST_M[data.boostMonths!] ?? 1));
            clone.premiumGuildSince = bSince;
        }
    } else {
        clone.premiumType = 0;
        clone.premiumSince = null;
        clone.premiumGuildSince = null;
    }

    if (data.decorationAsset) {
        clone.avatarDecoration = null;
        clone.avatarDecorationData = { asset: data.decorationAsset, skuId: data.decorationAsset };
    }

    cloneCache.set(uid, { orig: user, clone, version: _version });
    return clone;
}

// ── UI helpers (same as customProfile) ──
function EditIcon({ size = 18 }: { size?: number; }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>;
}
function FolderIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z" /></svg>;
}
function CloseIcon() {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function TrashIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2h4a1 1 0 1 1 0 2h-1.1l-.9 12.1A3 3 0 0 1 17 23H7a3 3 0 0 1-3-2.9L3.1 8H2a1 1 0 0 1 0-2h4V4Zm2 0v2h6V4H9ZM5.1 8l.9 11.9a1 1 0 0 0 1 .1h6a1 1 0 0 0 1-.1L14.9 8H5.1Z" /></svg>;
}
function SaveIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm3-10H5V5h10v4Z" /></svg>;
}
function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties; }) {
    return <div className="cp-section-label" style={style}>{children}</div>;
}
function Field({ label, value, placeholder, onChange, type = "text" }: {
    label: string; value: string; placeholder?: string; onChange: (v: string) => void; type?: string;
}) {
    return (
        <div className="cp-field">
            <SectionLabel>{label}</SectionLabel>
            <input className="cp-input" type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        </div>
    );
}
function ImageUpload({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void; }) {
    const fileRef = React.useRef<HTMLInputElement>(null);
    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => { if (ev.target?.result) onChange(ev.target.result as string); };
        reader.readAsDataURL(file);
    }
    return (
        <div className="cp-field">
            <SectionLabel>{label}</SectionLabel>
            <div className="cp-image-row">
                <input className="cp-input cp-url-input" placeholder={t("Image URL...")} value={value.startsWith("data:") ? "" : value} onChange={e => onChange(e.target.value)} />
                <button className="cp-file-btn" onClick={() => fileRef.current?.click()} title={t("Choose a file")}><FolderIcon /></button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
                {value && <>
                    <img src={value} alt="" className="cp-preview-avatar" />
                    <button className="cp-clear-btn" onClick={() => onChange("")} title={t("Delete")}><CloseIcon /></button>
                </>}
            </div>
        </div>
    );
}
function Toggle({ label, checked, onChange, sublabel }: { label: string; checked: boolean; onChange: (v: boolean) => void; sublabel?: string; }) {
    return (
        <div className="cp-toggle-row" onClick={() => onChange(!checked)}>
            <div className="cp-toggle-text">
                <span className="cp-toggle-label">{label}</span>
                {sublabel && <span className="cp-toggle-sub">{sublabel}</span>}
            </div>
            <div className={`cp-toggle ${checked ? "cp-toggle--on" : ""}`}><div className="cp-toggle-thumb" /></div>
        </div>
    );
}
function BadgeBtn({ label, icon, active, onClick }: { label: string; icon?: string; active: boolean; onClick: () => void; }) {
    return (
        <button onClick={onClick} className={`cp-badge ${active ? "cp-badge--on" : ""}`} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {icon && <img src={icon} alt="" style={{ width: 16, height: 16, objectFit: "contain", flexShrink: 0 }} />}
            <span>{label}</span>
        </button>
    );
}

function BadgePicker({ selected, onChange, nitroType, onNitroType, boostLevel, onBoostLevel, customIds, onCustomIds, oldName, onOldName }: {
    selected: number; onChange: (v: number) => void;
    nitroType: number; onNitroType: (v: number) => void;
    boostLevel: number; onBoostLevel: (v: number) => void;
    customIds: string[]; onCustomIds: (v: string[]) => void;
    oldName: string; onOldName: (v: string) => void;
}) {
    const hasOldName = customIds.includes("oldname");
    return (
        <div className="cp-field">
            <SectionLabel>{t("Badges")}</SectionLabel>
            <div className="cp-badges">
                {BADGES.map(b => (
                    <BadgeBtn key={b.flag} label={b.label} icon={b.icon}
                        active={!!(selected & b.flag)} onClick={() => onChange(selected ^ b.flag)} />
                ))}
            </div>
            <SectionLabel style={{ marginTop: 8 }}>{t("Evolving Nitro Badge")}</SectionLabel>
            <div className="cp-badges">
                <BadgeBtn label={t("None")} active={nitroType === -1} onClick={() => onNitroType(-1)} />
                {NITRO_LEVELS.map((n, i) => (
                    <BadgeBtn key={i} label={n.label} icon={n.icon} active={nitroType === i} onClick={() => onNitroType(i)} />
                ))}
            </div>
            <SectionLabel style={{ marginTop: 8 }}>{t("Special Badges")}</SectionLabel>
            <div className="cp-badges">
                <BadgeBtn label={t("Completed a quest")}
                    icon="https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png"
                    active={customIds.includes("quest")}
                    onClick={() => onCustomIds(customIds.includes("quest") ? customIds.filter(x => x !== "quest") : [...customIds, "quest"])} />
                <BadgeBtn label={t("Orbs — Apprentice")}
                    icon="https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png"
                    active={customIds.includes("orbs")}
                    onClick={() => onCustomIds(customIds.includes("orbs") ? customIds.filter(x => x !== "orbs") : [...customIds, "orbs"])} />
                <BadgeBtn label={t("Old username")} icon={OLD_NAME_BADGE_ICON} active={hasOldName}
                    onClick={() => onCustomIds(hasOldName ? customIds.filter(x => x !== "oldname") : [...customIds, "oldname"])} />
            </div>
            {hasOldName && (
                <div className="cp-field" style={{ marginTop: 6 }}>
                    <SectionLabel style={{ marginTop: 0 }}>{t("Old username displayed in tooltip")}</SectionLabel>
                    <input className="cp-input" value={oldName} placeholder="OldUser#0000" onChange={e => onOldName(e.target.value)} />
                </div>
            )}
            <SectionLabel style={{ marginTop: 8 }}>{t("Boost Badge (Server Booster)")}</SectionLabel>
            <div className="cp-badges">
                <BadgeBtn label={t("None")} active={boostLevel === -1} onClick={() => onBoostLevel(-1)} />
                {BOOST_LABELS.map((lbl, i) => (
                    <BadgeBtn key={i} label={lbl} icon={BOOST_ICONS[i]} active={boostLevel === i} onClick={() => onBoostLevel(i)} />
                ))}
            </div>
        </div>
    );
}

// ── Friend Profile Modal ──
function FriendProfileModal({ rootProps, userId }: { rootProps: any; userId: string; }) {
    const user = UserStore.getUser(userId) as any;
    const existing = friendProfiles[userId] ?? {};
    const [data, setData] = React.useState<FriendProfileData>({ ...existing });
    const [saving, setSaving] = React.useState(false);
    const nitroLevel = data.nitroLevel ?? -1;
    const boostLevel = data.boostMonths ?? -1;
    const customIds = data.customBadgeIds ?? [];
    const oldName = data.oldName ?? "";

    function set<K extends keyof FriendProfileData>(key: K, val: FriendProfileData[K]) {
        setData(d => ({ ...d, [key]: val }));
    }

    async function save() {
        setSaving(true);
        friendProfiles[userId] = { ...data };
        _version++;
        cloneCache.delete(userId);
        await saveProfiles();
        forceRerender();
        setSaving(false);
        rootProps.onClose();
    }

    async function reset() {
        delete friendProfiles[userId];
        _version++;
        cloneCache.delete(userId);
        await saveProfiles();
        forceRerender();
        rootProps.onClose();
    }

    const displayName = user?.globalName || user?.username || userId;
    const accentHex = data.accentColor != null ? "#" + data.accentColor.toString(16).padStart(6, "0") : "";

    return (
        <ModalRoot {...rootProps} size="medium">
            <ModalHeader separator={false}>
                <div className="cp-header">
                    <EditIcon size={16} />
                    <span className="cp-header-title">{t("Friend Custom Profile")} — {displayName}</span>
                </div>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent className="cp-content">
                <Field label={t("Username")} value={data.username ?? ""} placeholder="my_username_00" onChange={v => set("username", v)} />
                <Field label={t("Display name")} value={data.globalName ?? ""} placeholder="My Name" onChange={v => set("globalName", v)} />
                <ImageUpload label={t("Profile picture")} value={data.avatar ?? ""} onChange={v => set("avatar", v)} />
                <Toggle label={t("Simulate Nitro")} sublabel={t("Enables banner and profile color")} checked={data.nitro ?? false} onChange={v => set("nitro", v)} />
                {data.nitro && <ImageUpload label={t("Banner")} value={data.banner ?? ""} onChange={v => set("banner", v)} />}
                <div className="cp-divider" />
                <Field label={t("Bio")} value={data.bio ?? ""} placeholder={t("My description...")} onChange={v => set("bio", v)} />
                <Field label={t("Pronouns")} value={data.pronouns ?? ""} placeholder={t("he/him")} onChange={v => set("pronouns", v)} />
                <div className="cp-field">
                    <SectionLabel>{t("Profile color (Nitro — gradient possible)")}</SectionLabel>
                    <div className="cp-color-row" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 6 }}>{t("Color 1")}</span>
                        <input type="color" value={accentHex || "#5865f2"} onChange={e => { const n = parseInt(e.target.value.replace("#", ""), 16); if (!isNaN(n)) set("accentColor", n); }} className="cp-color-swatch" />
                        <input value={accentHex} placeholder="#5865f2" onChange={e => { const h = e.target.value.replace("#", ""); const n = parseInt(h, 16); if (!isNaN(n) && h.length === 6) set("accentColor", n); else if (!e.target.value || e.target.value === "#") set("accentColor", undefined); }} className="cp-input cp-color-input" />
                        {data.accentColor != null && <button className="cp-clear-btn" onClick={() => set("accentColor", undefined)}><CloseIcon /></button>}
                    </div>
                    <div className="cp-color-row">
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 6 }}>{t("Color 2")}</span>
                        {(() => {
                            const hex2 = data.accentColor2 != null ? "#" + data.accentColor2.toString(16).padStart(6, "0") : "";
                            return (<>
                                <input type="color" value={hex2 || "#eb459e"} onChange={e => { const n = parseInt(e.target.value.replace("#", ""), 16); if (!isNaN(n)) set("accentColor2", n); }} className="cp-color-swatch" />
                                <input value={hex2} placeholder="#eb459e (optional)" onChange={e => { const h = e.target.value.replace("#", ""); const n = parseInt(h, 16); if (!isNaN(n) && h.length === 6) set("accentColor2", n); else if (!e.target.value || e.target.value === "#") set("accentColor2", undefined); }} className="cp-input cp-color-input" />
                                {data.accentColor2 != null && <button className="cp-clear-btn" onClick={() => set("accentColor2", undefined)}><CloseIcon /></button>}
                            </>);
                        })()}
                    </div>
                </div>
                <Field label={t("Account creation date")} value={data.createdAt ?? ""} placeholder="2010-06-29" type="date" onChange={v => set("createdAt", v)} />
                <div className="cp-divider" />
                <BadgePicker
                    selected={data.badgeFlags ?? 0} onChange={v => set("badgeFlags", v)}
                    nitroType={nitroLevel} onNitroType={v => { set("nitroLevel", v as any); if (v >= 1) set("nitro", true); }}
                    boostLevel={boostLevel} onBoostLevel={v => set("boostMonths", v)}
                    customIds={customIds} onCustomIds={v => set("customBadgeIds", v)}
                    oldName={oldName} onOldName={v => set("oldName", v)}
                />
                <div className="cp-divider" />
                <SectionLabel>{t("Avatar decoration")}</SectionLabel>
                <div className="cp-badges" style={{ flexWrap: "wrap", gap: 6 }}>
                    <button onClick={() => set("decorationAsset", undefined)} className={`cp-badge ${!data.decorationAsset ? "cp-badge--on" : ""}`} style={{ minWidth: 60 }}>{t("None")}</button>
                    {AVATAR_DECORATIONS.map(dec => (
                        <button key={dec.id} onClick={() => set("decorationAsset", data.decorationAsset === dec.id ? undefined : dec.id)}
                            className={`cp-badge ${data.decorationAsset === dec.id ? "cp-badge--on" : ""}`}
                            title={dec.label} style={{ padding: 3, lineHeight: 0, width: 52, height: 52, borderRadius: 6 }}>
                            <img src={getDecorationUrl(dec.id)} alt={dec.label} style={{ width: 46, height: 46, objectFit: "contain", display: "block" }} />
                        </button>
                    ))}
                </div>
                <div className="cp-hint">{t("Visual and local modifications only — persistent between restarts.")}</div>
            </ModalContent>
            <ModalFooter className="cp-footer">
                <button className="cp-btn cp-btn-ghost" onClick={rootProps.onClose}>{t("Cancel")}</button>
                <button className="cp-btn cp-btn-danger" onClick={reset}><TrashIcon /><span>{t("Reset")}</span></button>
                <button className="cp-btn cp-btn-primary" onClick={save} disabled={saving}><SaveIcon /><span>{saving ? t("Saving...") : t("Save")}</span></button>
            </ModalFooter>
        </ModalRoot>
    );
}

// ── Manager Modal (list of all configured friends) ──
function ManagerModal({ rootProps }: { rootProps: any; }) {
    const [profiles, setProfiles] = React.useState<Record<string, FriendProfileData>>({ ...friendProfiles });
    const [newId, setNewId] = React.useState("");

    function refresh() { setProfiles({ ...friendProfiles }); }

    function openEdit(uid: string) {
        openModal(p => <FriendProfileModal rootProps={p} userId={uid} />);
    }

    async function removeProfile(uid: string) {
        delete friendProfiles[uid];
        _version++;
        cloneCache.delete(uid);
        await saveProfiles();
        forceRerender();
        refresh();
    }

    function addNew() {
        const id = newId.trim();
        if (!id) return;
        setNewId("");
        openEdit(id);
    }

    const entries = Object.entries(profiles);

    return (
        <ModalRoot {...rootProps} size="medium">
            <ModalHeader separator={false}>
                <div className="cp-header">
                    <EditIcon size={16} />
                    <span className="cp-header-title">{t("Friend Custom Profiles")}</span>
                </div>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent className="cp-content">
                <div className="cp-field">
                    <SectionLabel>{t("Add user by ID")}</SectionLabel>
                    <div className="cp-image-row">
                        <input className="cp-input" placeholder="123456789012345678" value={newId}
                            onChange={e => setNewId(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") addNew(); }} />
                        <button className="cp-btn cp-btn-primary" style={{ flexShrink: 0 }} onClick={addNew}>{t("Add")}</button>
                    </div>
                </div>
                {entries.length === 0 && (
                    <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                        {t("No friend profiles configured yet.")}
                    </div>
                )}
                {entries.map(([uid, prof]) => {
                    const user = UserStore.getUser(uid) as any;
                    const name = prof.globalName || prof.username || user?.globalName || user?.username || uid;
                    const avatar = prof.avatar || (user ? IconUtils.getUserAvatarURL(user, false, 32) : null);
                    return (
                        <div key={uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            {avatar && <img src={avatar} alt="" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: "#fff", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{uid}</div>
                            </div>
                            <button className="cp-btn cp-btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => openEdit(uid)}>{t("Edit")}</button>
                            <button className="cp-btn cp-btn-danger" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => removeProfile(uid)}><TrashIcon /></button>
                        </div>
                    );
                })}
            </ModalContent>
            <ModalFooter className="cp-footer">
                <button className="cp-btn cp-btn-ghost" onClick={rootProps.onClose}>{t("Close")}</button>
            </ModalFooter>
        </ModalRoot>
    );
}

// ── Header bar button ──
function FriendProfileButton() {
    const [hidden, setHidden] = React.useState(isPanelHidden());
    React.useEffect(() => {
        const listener = () => setHidden(isPanelHidden());
        addPanelHideListener(listener);
        window.addEventListener("globalcord-panel-hide-change", listener);
        return () => {
            removePanelHideListener(listener);
            window.removeEventListener("globalcord-panel-hide-change", listener);
        };
    }, []);
    if (hidden) return null;
    return <HeaderBarButton icon={() => <EditIcon size={18} />} tooltip="Friend Custom Profiles" onClick={() => openModal(p => <ManagerModal rootProps={p} />)} />;
}

// ── Context menu patch ──
const userContextPatch: NavContextMenuPatchCallback = (children, { user }: any) => {
    if (isPanelHidden()) return;
    if (!children || !Array.isArray(children) || !user?.id) return;
    const me = UserStore.getCurrentUser();
    if (!me || user.id === me.id) return;

    const hasProfile = !!friendProfiles[user.id];
    children.push(
        <Menu.MenuGroup key="fcp-group">
            <Menu.MenuItem
                id="fcp-edit"
                label={hasProfile ? t("Edit friend profile") : t("Set friend profile")}
                action={() => openModal(p => <FriendProfileModal rootProps={p} userId={user.id} />)}
            />
            {hasProfile && (
                <Menu.MenuItem
                    id="fcp-remove"
                    label={t("Remove friend profile")}
                    color="danger"
                    action={async () => {
                        delete friendProfiles[user.id];
                        _version++;
                        cloneCache.delete(user.id);
                        await saveProfiles();
                        forceRerender();
                    }}
                />
            )}
        </Menu.MenuGroup>
    );
};

// ── Plugin ──
export default definePlugin({
    name: "FriendCustomProfile",
    enabledByDefault: true,
    description: "Visually customize how other users appear to you (username, PFP, banner, badges...) — local only.",
    authors: [{ name: "Globalcord", id: 0n }],
    dependencies: ["HeaderBarAPI", "ContextMenuAPI"],

    _origGetUser: null as any,
    _origGetUserAvatarURL: null as any,
    _origGetUserProfile: null as any,
    _origExtractTimestamp: null as any,

    async start() {
        await loadProfiles();
        addHeaderBarButton("friend-custom-profile-btn", () => <FriendProfileButton />, 9);
        addContextMenuPatch("user-context", userContextPatch);

        // Patch UserStore.getUser
        try {
            const US = (Vencord as any).Webpack?.findByProps?.("getCurrentUser", "getUser");
            if (US && !US._fcp_hook) {
                this._origGetUser = US.getUser.bind(US);
                const origGet = this._origGetUser;
                US.getUser = (id: string) => {
                    const user = origGet(id);
                    if (!user || !friendProfiles[id]) return user;
                    return fakeUserForId(user);
                };
                US._fcp_hook = true;
            }
        } catch { }

        // Patch IconUtils.getUserAvatarURL for custom avatars
        try {
            if (IconUtils?.getUserAvatarURL && !this._origGetUserAvatarURL) {
                this._origGetUserAvatarURL = (IconUtils as any).getUserAvatarURL;
                const orig = this._origGetUserAvatarURL;
                (IconUtils as any).getUserAvatarURL = (user: any, ...args: any[]) => {
                    const uid = user?.id ?? user?.userId;
                    if (uid && friendProfiles[uid]?.avatar) return friendProfiles[uid].avatar!;
                    return orig(user, ...args);
                };
            }
        } catch { }

        // Patch UserProfileStore for banner/bio/accentColor
        try {
            const UPS = (Vencord as any).Webpack?.findByProps?.("getUserProfile", "getGuildMemberProfile");
            if (UPS && !UPS._fcp_hook) {
                this._origGetUserProfile = UPS.getUserProfile.bind(UPS);
                const origProfile = this._origGetUserProfile;
                UPS.getUserProfile = (userId: string) => {
                    const profile = origProfile(userId);
                    const data = friendProfiles[userId];
                    if (!data || !profile) return profile;
                    const patched = Object.create(Object.getPrototypeOf(profile));
                    Object.assign(patched, profile);
                    if (data.bio) patched.bio = data.bio;
                    if (data.pronouns) patched.pronouns = data.pronouns;
                    if (data.accentColor != null) patched.accentColor = data.accentColor;
                    if (data.banner) patched.banner = data.banner;
                    if (data.nitro) {
                        patched.premiumType = 2;
                        const LEVEL_MONTHS = [1, 2, 3, 6, 12, 24, 36, 72];
                        const since = new Date();
                        since.setMonth(since.getMonth() - (LEVEL_MONTHS[data.nitroLevel ?? 0] ?? 1));
                        patched.premiumSince = since;
                    }
                    return patched;
                };
                UPS._fcp_hook = true;
            }
        } catch { }

        // Patch SnowflakeUtils.extractTimestamp for createdAt
        try {
            if (SnowflakeUtils?.extractTimestamp && !this._origExtractTimestamp) {
                this._origExtractTimestamp = SnowflakeUtils.extractTimestamp;
                const origExtract = this._origExtractTimestamp;
                (SnowflakeUtils as any).extractTimestamp = (snowflake: string) => {
                    const data = friendProfiles[snowflake];
                    if (data?.createdAt) return new Date(data.createdAt + "T12:00:00Z").getTime();
                    return origExtract(snowflake);
                };
            }
        } catch { }
    },

    stop() {
        removeHeaderBarButton("friend-custom-profile-btn");
        removeContextMenuPatch("user-context", userContextPatch);
        cloneCache.clear();

        try {
            const US = (Vencord as any).Webpack?.findByProps?.("getCurrentUser", "getUser");
            if (US && this._origGetUser) { US.getUser = this._origGetUser; US._fcp_hook = false; this._origGetUser = null; }
        } catch { }

        try {
            if (this._origGetUserAvatarURL && IconUtils) {
                (IconUtils as any).getUserAvatarURL = this._origGetUserAvatarURL;
                this._origGetUserAvatarURL = null;
            }
        } catch { }

        try {
            const UPS = (Vencord as any).Webpack?.findByProps?.("getUserProfile", "getGuildMemberProfile");
            if (UPS && this._origGetUserProfile) { UPS.getUserProfile = this._origGetUserProfile; UPS._fcp_hook = false; this._origGetUserProfile = null; }
        } catch { }

        try {
            if (this._origExtractTimestamp && SnowflakeUtils) {
                (SnowflakeUtils as any).extractTimestamp = this._origExtractTimestamp;
                this._origExtractTimestamp = null;
            }
        } catch { }
    },

    userProfileBadges: [
        {
            getBadges({ userId, badges: nativeBadges }: { userId: string; guildId: string; badges: ProfileBadge[]; }) {
                const data = friendProfiles[userId];
                if (!data) return nativeBadges || [];

                const badges: ProfileBadge[] = [];
                const style = { borderRadius: "50%", width: "22px", height: "22px" };
                const wantedFlags = data.badgeFlags ?? 0;

                for (const b of BADGES) {
                    if (wantedFlags & b.flag) badges.push({ description: b.label, image: b.icon, key: `fcp-${b.flag}`, props: { style } });
                }

                const nl = data.nitroLevel ?? -1;
                if (nl >= 0 && nl < NITRO_LEVELS.length) {
                    badges.push({ description: NITRO_LEVELS[nl].label, image: NITRO_LEVELS[nl].icon, key: "fcp-nitro", props: { style } });
                }

                const bm = data.boostMonths ?? -1;
                if (bm >= 0 && bm < BOOST_ICONS.length) {
                    badges.push({ description: BOOST_LABELS[bm], image: BOOST_ICONS[bm], key: "fcp-boost", props: { style } });
                }

                const customIds = data.customBadgeIds ?? [];
                if (customIds.includes("quest")) badges.push({ description: "Completed a quest", image: "https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png", key: "fcp-quest", props: { style } });
                if (customIds.includes("orbs")) badges.push({ description: "Orbs — Apprentice", image: "https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png", key: "fcp-orbs", props: { style } });
                if (customIds.includes("oldname")) {
                    const tooltip = data.oldName ? `Old username: ${data.oldName}` : "Old username";
                    badges.push({ description: tooltip, image: OLD_NAME_BADGE_ICON, key: "fcp-oldname", props: { style } });
                }

                return badges.length > 0 ? badges : (nativeBadges || []);
            }
        }
    ],

    settingsAboutComponent() {
        return <button className="cp-btn cp-btn-primary" onClick={() => openModal(p => <ManagerModal rootProps={p} />)}>Open Friend Custom Profiles</button>;
    },
});
