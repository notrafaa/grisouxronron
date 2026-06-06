"use client";

import {
  Cat,
  Coins,
  Flame,
  Gem,
  KeyRound,
  LogIn,
  LogOut,
  MousePointer2,
  Music2,
  PawPrint,
  Save,
  Sparkles,
  Trophy,
  Volume2,
  UserPlus,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CatId,
  GameProfile,
  isSupabaseConfigured,
  isSupabaseMisconfigured,
  supabase,
} from "@/lib/supabase";

type UpgradeId =
  | "paw"
  | "cushion"
  | "gloss"
  | "snack"
  | "laser"
  | "yarn"
  | "nap"
  | "chef"
  | "portal"
  | "crown"
  | "factory"
  | "constellation";
type AuthMode = "login" | "create";
type TabId = "play" | "shop" | "stats";

type Upgrade = {
  id: UpgradeId;
  name: string;
  icon: typeof PawPrint;
  description: string;
  baseCost: number;
  growth: number;
  tint: string;
  effect: (level: number) => string;
};

type Pop = {
  id: number;
  value: number;
  x: number;
  y: number;
  hue: string;
};

type RemoteCursor = {
  id: string;
  username: string;
  x: number;
  y: number;
  color: string;
  lastSeen: number;
};

const cats: Record<CatId, { name: string; src: string; accent: string; glow: string; vibe: string }> = {
  grisou: {
    name: "Grisou",
    src: "/cats/grisou.jpg",
    accent: "#ff8c32",
    glow: "rgba(255, 140, 50, 0.38)",
    vibe: "moelleux cosmique",
  },
  ronron: {
    name: "Ronron",
    src: "/cats/ronron.jpg",
    accent: "#ff5577",
    glow: "rgba(255, 85, 119, 0.34)",
    vibe: "squeechie solaire",
  },
};

const upgrades: Upgrade[] = [
  { id: "paw",           name: "Patte turbo",          icon: PawPrint,  description: "Plus de croquettes a chaque pression.",       baseCost: 25,      growth: 1.22, tint: "#ff8c32", effect: (l) => `+${l + 1}/clic` },
  { id: "cushion",       name: "Coussin aimant",        icon: Sparkles,  description: "Production douce meme sans cliquer.",          baseCost: 90,      growth: 1.28, tint: "#ffcc00", effect: (l) => `+${(l * 0.8 + 0.8).toFixed(1)}/s` },
  { id: "gloss",         name: "Brillance squeechie",   icon: Gem,       description: "Multiplie tous tes gains.",                   baseCost: 220,     growth: 1.34, tint: "#4ade80", effect: (l) => `x${(1 + (l + 1) * 0.15).toFixed(2)}` },
  { id: "snack",         name: "Snack premium",         icon: Zap,       description: "Rend chaque clic plus explosif.",              baseCost: 650,     growth: 1.42, tint: "#ff5577", effect: (l) => `+${(l + 1) * 8}%` },
  { id: "laser",         name: "Laser hypnotique",      icon: Zap,       description: "Grosses pointes de puissance au clic.",        baseCost: 1400,    growth: 1.5,  tint: "#ff3322", effect: (l) => `+${(l + 1) * 5}% clic` },
  { id: "yarn",          name: "Pelote quantique",      icon: Sparkles,  description: "Ameliore la production automatique.",          baseCost: 3200,    growth: 1.55, tint: "#65b8ff", effect: (l) => `+${(l + 1) * 3}/s` },
  { id: "nap",           name: "Sieste royale",         icon: Cat,       description: "Bonus global doux mais infini.",               baseCost: 7200,    growth: 1.6,  tint: "#c084fc", effect: (l) => `x${(1 + (l + 1) * 0.04).toFixed(2)}` },
  { id: "chef",          name: "Chef croquette",        icon: Coins,     description: "Multiplie les croquettes gagnees.",            baseCost: 18000,   growth: 1.66, tint: "#ffcc00", effect: (l) => `x${(1 + (l + 1) * 0.06).toFixed(2)}` },
  { id: "portal",        name: "Portail miaou",         icon: Sparkles,  description: "La ferme attire des croquettes d'ailleurs.",   baseCost: 52000,   growth: 1.72, tint: "#a78bfa", effect: (l) => `+${(l + 1) * 18}/s` },
  { id: "crown",         name: "Couronne du goat",      icon: Trophy,    description: "Booste les niveaux de chats.",                 baseCost: 140000,  growth: 1.78, tint: "#ffcc00", effect: (l) => `+${(l + 1) * 7}% chats` },
  { id: "factory",       name: "Usine a ronrons",       icon: Gem,       description: "Production passive massive.",                  baseCost: 400000,  growth: 1.84, tint: "#4ade80", effect: (l) => `+${(l + 1) * 60}/s` },
  { id: "constellation", name: "Constellation",         icon: Flame,     description: "Bonus final qui scale pour toujours.",         baseCost: 1200000, growth: 1.92, tint: "#ff5577", effect: (l) => `x${(1 + (l + 1) * 0.1).toFixed(2)}` },
];

const emptyUpgrades: Record<UpgradeId, number> = {
  paw: 0, cushion: 0, gloss: 0, snack: 0, laser: 0, yarn: 0,
  nap: 0, chef: 0, portal: 0, crown: 0, factory: 0, constellation: 0,
};

const emptyCatLevels: Record<CatId, number> = { grisou: 1, ronron: 1 };

const demoKey = "squeechie-clicker-demo-profile";
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function freshProfile(username: string, id = "demo-user"): GameProfile {
  return {
    id, username, selected_cat: "grisou", treats: 0, total_clicks: 0,
    click_power: 1, auto_rate: 0, multiplier: 1,
    upgrades: { ...emptyUpgrades }, rebirths: 0, lifetime_treats: 0,
    cat_levels: { ...emptyCatLevels },
  };
}

function usernameToAuthEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `user_${(hash >>> 0).toString(16)}@grisouxronron.local`;
}

function upgradeCost(u: Upgrade, level: number) {
  return Math.floor(u.baseCost * Math.pow(u.growth, level));
}

function catLevelCost(level: number, rebirths: number) {
  return Math.floor(450 * Math.pow(1.42, level - 1) * (1 + rebirths * 0.12));
}

function rebirthCost(rebirths: number) {
  return Math.floor(100000 * Math.pow(3.2, rebirths));
}

function normalizeProfile(profile: GameProfile): GameProfile {
  return {
    ...profile,
    selected_cat: profile.selected_cat ?? "grisou",
    treats: Number(profile.treats ?? 0),
    total_clicks: Number(profile.total_clicks ?? 0),
    click_power: Number(profile.click_power ?? 1),
    auto_rate: Number(profile.auto_rate ?? 0),
    multiplier: Number(profile.multiplier ?? 1),
    upgrades: { ...emptyUpgrades, ...(profile.upgrades ?? {}) },
    rebirths: Number(profile.rebirths ?? 0),
    lifetime_treats: Number(profile.lifetime_treats ?? profile.treats ?? 0),
    cat_levels: { ...emptyCatLevels, ...(profile.cat_levels ?? {}) },
  };
}

function profileSavePayload(profile: GameProfile) {
  return {
    id: profile.id, username: profile.username, selected_cat: profile.selected_cat,
    treats: profile.treats, total_clicks: profile.total_clicks,
    click_power: profile.click_power, auto_rate: profile.auto_rate,
    multiplier: profile.multiplier, upgrades: profile.upgrades,
    rebirths: profile.rebirths, lifetime_treats: profile.lifetime_treats,
    cat_levels: profile.cat_levels, updated_at: new Date().toISOString(),
  };
}

function legacyProfileSavePayload(profile: GameProfile) {
  return {
    id: profile.id, username: profile.username, selected_cat: profile.selected_cat,
    treats: profile.treats, total_clicks: profile.total_clicks,
    click_power: profile.click_power, auto_rate: profile.auto_rate,
    multiplier: profile.multiplier, upgrades: profile.upgrades,
    updated_at: new Date().toISOString(),
  };
}

export default function ClickerGame() {
  const [profile, setProfile] = useState<GameProfile | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [pops, setPops] = useState<Pop[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [leaderboard, setLeaderboard] = useState<GameProfile[]>([]);
  const [pressed, setPressed] = useState(false);
  const [combo, setCombo] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>("play");
  const [shaking, setShaking] = useState(false);
  const popId = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorSent = useRef(0);

  const currentCat = profile ? cats[profile.selected_cat] : cats.grisou;
  const activeCatLevel = profile ? profile.cat_levels[profile.selected_cat] ?? 1 : 1;
  const rebirthMultiplier = profile ? 1 + profile.rebirths * 0.35 : 1;
  const catMultiplier = profile ? 1 + (activeCatLevel - 1) * 0.12 + (profile.upgrades.crown ?? 0) * 0.07 : 1;
  const globalMultiplier = profile
    ? (1 + (profile.upgrades.gloss ?? 0) * 0.15)
      * (1 + (profile.upgrades.nap ?? 0) * 0.04)
      * (1 + (profile.upgrades.chef ?? 0) * 0.06)
      * (1 + (profile.upgrades.constellation ?? 0) * 0.1)
      * rebirthMultiplier * catMultiplier
    : 1;
  const treatsPerClick = profile
    ? (1 + (profile.upgrades.paw ?? 0) + (profile.upgrades.laser ?? 0) * 0.05 * (profile.upgrades.paw + 1)) * globalMultiplier
    : 1;
  const passiveGain = profile
    ? ((profile.upgrades.cushion ?? 0) * 0.8
      + (profile.upgrades.yarn ?? 0) * 3
      + (profile.upgrades.portal ?? 0) * 18
      + (profile.upgrades.factory ?? 0) * 60) * globalMultiplier
    : 0;
  const totalUpgradeLevels = profile
    ? Object.values({ ...emptyUpgrades, ...profile.upgrades }).reduce((s, v) => s + v, 0)
    : 0;

  // ---- SOUND SYSTEM ----

  const playMeow = useCallback(() => {
    if (!soundOn || typeof window === "undefined") return;
    const ctx = audio.current ?? new AudioContext();
    audio.current = ctx;
    const now = ctx.currentTime;

    // 4 meow variants: [freqStart, freqMid, freqEnd, duration, volume]
    const variants: [number, number, number, number, number][] = [
      [920,  570, 810, 0.28, 0.090],  // mew (standard)
      [780,  490, 710, 0.42, 0.085],  // meow (longer)
      [1180, 820, 1060, 0.21, 0.080], // mew! (high)
      [860,  590, 760, 0.36, 0.092],  // mrow (deep)
    ];
    const [f0, f1, f2, dur, vol] = variants[Math.floor(Math.random() * variants.length)];
    const pitch = 0.88 + Math.random() * 0.24; // ±14% pitch variation

    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const mainOsc = ctx.createOscillator();
    const vibOsc = ctx.createOscillator();
    const vibGain = ctx.createGain();

    // Vibrato (~6 Hz, kicks in after attack)
    vibOsc.frequency.value = 5.5 + Math.random() * 2;
    vibGain.gain.setValueAtTime(0, now);
    vibGain.gain.linearRampToValueAtTime(32, now + dur * 0.18);
    vibGain.gain.setValueAtTime(32, now + dur * 0.72);
    vibGain.gain.linearRampToValueAtTime(0, now + dur);
    vibOsc.connect(vibGain);
    vibGain.connect(mainOsc.frequency);

    // Main oscillator — meow frequency sweep
    mainOsc.type = "sine";
    mainOsc.frequency.setValueAtTime(f0 * pitch, now);
    mainOsc.frequency.exponentialRampToValueAtTime(f1 * pitch, now + dur * 0.48);
    mainOsc.frequency.exponentialRampToValueAtTime(f2 * pitch, now + dur * 0.86);

    // Peaking filter to add vowel formant quality
    filter.type = "peaking";
    filter.frequency.setValueAtTime(1350, now);
    filter.frequency.exponentialRampToValueAtTime(880, now + dur * 0.5);
    filter.Q.value = 2.2;
    filter.gain.value = 9;

    // Amplitude envelope: quick attack, sustain, decay
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(vol, now + 0.018);
    gainNode.gain.setValueAtTime(vol, now + dur * 0.62);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + dur);

    mainOsc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    vibOsc.start(now);
    mainOsc.start(now);
    vibOsc.stop(now + dur + 0.05);
    mainOsc.stop(now + dur + 0.05);
  }, [soundOn]);

  const playTone = useCallback(
    (kind: "buy" | "error" | "save") => {
      if (!soundOn || typeof window === "undefined") return;
      const ctx = audio.current ?? new AudioContext();
      audio.current = ctx;
      const now = ctx.currentTime;
      const gain = ctx.createGain();

      if (kind === "buy") {
        // Cat chirp: two quick high pips
        for (let i = 0; i < 2; i++) {
          const t = now + i * 0.09;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(1200 + i * 280, t);
          osc.frequency.exponentialRampToValueAtTime(1700 + i * 200, t + 0.06);
          g.gain.setValueAtTime(0.001, t);
          g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.12);
        }
      } else if (kind === "error") {
        // Low cat growl
        const osc = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(140, now + 0.22);
        f.type = "lowpass";
        f.frequency.value = 800;
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.connect(f);
        f.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        // Purr: low AM tone
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 90;
        lfo.frequency.value = 24;
        lfoG.gain.value = 0.038;
        lfo.connect(lfoG);
        lfoG.connect(gain.gain);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.setValueAtTime(0.05, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        lfo.start(now);
        osc.start(now);
        lfo.stop(now + 0.6);
        osc.stop(now + 0.6);
      }
    },
    [soundOn],
  );

  const loadLeaderboard = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("rebirths", { ascending: false })
      .order("lifetime_treats", { ascending: false })
      .order("treats", { ascending: false })
      .limit(8);
    if (data) setLeaderboard(data.map((item) => normalizeProfile(item as GameProfile)));
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!supabase) {
        const cached = window.localStorage.getItem(demoKey);
        if (cached) setProfile(normalizeProfile(JSON.parse(cached)));
        setLoading(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) { setLoading(false); await loadLeaderboard(); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (data) {
        const remote = normalizeProfile(data as GameProfile);
        const cached = window.localStorage.getItem(demoKey);
        if (cached) {
          const cp = normalizeProfile(JSON.parse(cached));
          if (cp.id === remote.id && (cp.lifetime_treats > remote.lifetime_treats || cp.rebirths > remote.rebirths))
            setProfile(cp);
          else setProfile(remote);
        } else setProfile(remote);
      }
      setLoading(false);
      await loadLeaderboard();
    }
    loadProfile();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (!profile || !supabase) return;
    const client = supabase;
    const ap = profile;
    const color = ap.selected_cat === "grisou" ? "#ff8c32" : "#ff5577";
    const channel = client.channel("clicker-cursors")
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const c = payload as RemoteCursor;
        if (!c.id || c.id === ap.id) return;
        setRemoteCursors((cur) => ({ ...cur, [c.id]: { ...c, lastSeen: Date.now() } }));
      })
      .subscribe();

    function sendCursor(e: PointerEvent) {
      const now = Date.now();
      if (now - lastCursorSent.current < 50) return;
      lastCursorSent.current = now;
      channel.send({ type: "broadcast", event: "cursor", payload: { id: ap.id, username: ap.username, x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, color } });
    }
    const staleTimer = window.setInterval(() => {
      setRemoteCursors((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => Date.now() - v.lastSeen < 2500)));
    }, 1000);
    window.addEventListener("pointermove", sendCursor);
    return () => { window.removeEventListener("pointermove", sendCursor); window.clearInterval(staleTimer); client.removeChannel(channel); };
  }, [profile]);

  const saveProfile = useCallback(
    async (nextProfile: GameProfile, quiet = true) => {
      window.localStorage.setItem(demoKey, JSON.stringify(nextProfile));
      if (!supabase) return;
      setSaving(true);
      const { error } = await supabase.from("profiles").upsert(profileSavePayload(nextProfile));
      setSaving(false);
      if (error) {
        const legacy = await supabase.from("profiles").upsert(legacyProfileSavePayload(nextProfile));
        if (legacy.error) { setMessage(`Sauvegarde locale ok, Supabase refuse: ${legacy.error.message}`); playTone("error"); return; }
        setMessage("Sauvegarde locale ok. Reexecute supabase/schema.sql pour sauvegarder rebirths et niveaux."); return;
      }
      if (!quiet) { setMessage("Sauvegarde parfaite."); playTone("save"); }
      await loadLeaderboard();
    },
    [loadLeaderboard, playTone],
  );

  const queueSave = useCallback((p: GameProfile) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveProfile(p), 450);
  }, [saveProfile]);

  const updateProfile = useCallback((producer: (p: GameProfile) => GameProfile) => {
    setProfile((cur) => {
      if (!cur) return cur;
      const next = normalizeProfile(producer(cur));
      queueSave(next);
      return next;
    });
  }, [queueSave]);

  useEffect(() => {
    if (!profile || passiveGain <= 0) return;
    const timer = setInterval(() => {
      updateProfile((cur) => ({ ...cur, treats: cur.treats + passiveGain, lifetime_treats: cur.lifetime_treats + passiveGain }));
    }, 1000);
    return () => clearInterval(timer);
  }, [passiveGain, profile, updateProfile]);

  async function handleStart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (authLoading) return;
    const clean = username.trim().replace(/\s+/g, " ");
    if (clean.length < 3 || clean.length > 18) { setMessage("Pseudo entre 3 et 18 caracteres."); playTone("error"); return; }
    if (password.length < 6) { setMessage("Mot de passe: 6 caracteres minimum."); playTone("error"); return; }
    if (isSupabaseMisconfigured) { setMessage("URL Supabase incorrecte: utilise l'URL du projet Supabase, pas l'URL Vercel."); playTone("error"); return; }
    setAuthLoading(true); setMessage("");

    if (!supabase) {
      const cached = window.localStorage.getItem(demoKey);
      if (authMode === "login" && cached) {
        const ex = normalizeProfile(JSON.parse(cached));
        if (ex.username.toLowerCase() === clean.toLowerCase()) { setProfile(ex); setAuthLoading(false); return; }
      }
      if (authMode === "login") { setAuthLoading(false); setMessage("Aucun compte local avec ce pseudo. Cree-le d'abord."); playTone("error"); return; }
      const next = freshProfile(clean);
      setProfile(next);
      window.localStorage.setItem(demoKey, JSON.stringify(next));
      setAuthLoading(false); return;
    }

    const email = usernameToAuthEmail(clean);
    const loadExistingProfile = async (userId: string) => {
      const { data, error } = await supabase!.from("profiles").select("*").eq("id", userId).single();
      if (error || !data) return false;
      setProfile(normalizeProfile(data as GameProfile)); await loadLeaderboard(); playTone("save"); return true;
    };

    if (authMode === "create") {
      const existingAuth = await supabase.auth.signInWithPassword({ email, password });
      if (existingAuth.data.user) { const loaded = await loadExistingProfile(existingAuth.data.user.id); setAuthLoading(false); if (!loaded) { setMessage("Compte trouve, mais sauvegarde introuvable."); playTone("error"); } return; }
      const { data: ep } = await supabase.from("profiles").select("id").ilike("username", clean).maybeSingle();
      if (ep) { setAuthLoading(false); setMessage("Ce pseudo existe deja. Utilise Se connecter."); playTone("error"); return; }
    }

    const auth = authMode === "create"
      ? await supabase.auth.signUp({ email, password, options: { data: { username: clean } } })
      : await supabase.auth.signInWithPassword({ email, password });

    if (auth.error || !auth.data.user) {
      setAuthLoading(false);
      const s = auth.error?.status;
      setMessage(s === 429 ? "Trop de creations de comptes. Attends un peu." : authMode === "create" ? "Impossible de creer le compte. Le pseudo existe peut-etre deja." : "Pseudo ou mot de passe incorrect.");
      playTone("error"); return;
    }

    if (authMode === "login") { const loaded = await loadExistingProfile(auth.data.user.id); setAuthLoading(false); if (!loaded) { setMessage("Compte trouve, mais sauvegarde introuvable."); playTone("error"); } return; }
    if (!auth.data.session) { setAuthLoading(false); setMessage("Desactive la confirmation email dans Supabase Auth pour les comptes par pseudo."); playTone("error"); return; }

    const next = freshProfile(clean, auth.data.user.id);
    const { error } = await supabase.from("profiles").insert(next);
    setAuthLoading(false);
    if (error) { setMessage(error.code === "23505" ? "Ce pseudo est deja pris." : "Impossible de creer le profil."); await supabase.auth.signOut(); playTone("error"); return; }
    setProfile(next); await loadLeaderboard(); playTone("save");
  }

  function handleClick(e: React.PointerEvent<HTMLButtonElement>) {
    if (!profile) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nextCombo = combo + 1;
    const comboBoost = 1 + Math.min(nextCombo, 60) * 0.006;
    const snackBoost = 1 + (profile.upgrades.snack ?? 0) * 0.08;
    const value = treatsPerClick * snackBoost * comboBoost;
    const hue = nextCombo % 5 === 0 ? "#ffcc00" : currentCat.accent;

    setCombo(nextCombo);
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => setCombo(0), 1100);

    // Screen shake at combo milestones
    if (nextCombo === 10 || nextCombo === 25 || nextCombo % 50 === 0) {
      setShaking(true);
      setTimeout(() => setShaking(false), 380);
    }

    setPressed(true);
    window.setTimeout(() => setPressed(false), 120);
    setPops((cur) => [...cur, { id: popId.current++, value, x, y, hue }].slice(-18));
    window.setTimeout(() => setPops((cur) => cur.slice(1)), 800);
    updateProfile((cur) => ({
      ...cur,
      treats: cur.treats + value,
      lifetime_treats: cur.lifetime_treats + value,
      total_clicks: cur.total_clicks + 1,
    }));
    playMeow();
  }

  function buyUpgrade(upgrade: Upgrade) {
    if (!profile) return;
    const level = profile.upgrades[upgrade.id] ?? 0;
    const cost = upgradeCost(upgrade, level);
    if (profile.treats < cost) { setMessage("Pas assez de croquettes 🐾"); playTone("error"); return; }
    updateProfile((cur) => {
      const levels = { ...cur.upgrades, [upgrade.id]: level + 1 };
      return { ...cur, treats: cur.treats - cost, upgrades: levels, click_power: 1 + levels.paw + levels.laser * 0.25, auto_rate: levels.cushion * 0.8 + levels.yarn * 3 + levels.portal * 18 + levels.factory * 60, multiplier: 1 + levels.gloss * 0.15 + levels.nap * 0.04 + levels.chef * 0.06 + levels.constellation * 0.1 };
    });
    setMessage(`${upgrade.name} niveau ${level + 1} !`);
    playTone("buy");
  }

  function switchCat(catId: CatId) {
    updateProfile((cur) => ({ ...cur, selected_cat: catId }));
    playTone("buy");
  }

  function levelUpCurrentCat() {
    if (!profile) return;
    const curLevel = profile.cat_levels[profile.selected_cat] ?? 1;
    const cost = catLevelCost(curLevel, profile.rebirths);
    if (profile.treats < cost) { setMessage("Pas assez de croquettes pour level up."); playTone("error"); return; }
    updateProfile((cur) => ({ ...cur, treats: cur.treats - cost, cat_levels: { ...cur.cat_levels, [cur.selected_cat]: (cur.cat_levels[cur.selected_cat] ?? 1) + 1 } }));
    setMessage(`${cats[profile.selected_cat].name} gagne un niveau ! 🐾`);
    playTone("buy");
  }

  function rebirth() {
    if (!profile) return;
    const cost = rebirthCost(profile.rebirths);
    if (profile.treats < cost) { setMessage(`Rebirth disponible a ${fmt.format(cost)} croquettes.`); playTone("error"); return; }
    updateProfile((cur) => ({ ...cur, treats: 0, click_power: 1, auto_rate: 0, multiplier: 1, rebirths: cur.rebirths + 1, upgrades: { ...emptyUpgrades }, cat_levels: { ...emptyCatLevels } }));
    setMessage(`Rebirth +1 ! Multiplicateur permanent x${(1 + (profile.rebirths + 1) * 0.35).toFixed(2)} 🔥`);
    playTone("save");
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    window.localStorage.removeItem(demoKey);
    setProfile(null); setUsername(""); setPassword(""); setMessage(""); setCombo(0);
  }

  const nextUpgrade = useMemo(() => {
    if (!profile) return null;
    return upgrades.map((u) => ({ upgrade: u, level: profile.upgrades[u.id] ?? 0, cost: upgradeCost(u, profile.upgrades[u.id] ?? 0) })).sort((a, b) => a.cost - b.cost)[0];
  }, [profile]);

  const nextProgress = nextUpgrade && profile ? Math.min(100, (profile.treats / nextUpgrade.cost) * 100) : 0;

  // ---- LOADING ----
  if (loading) {
    return (
      <main className="cat-shell grid place-items-center">
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="text-6xl animate-[gentleBob_1.4s_ease-in-out_infinite]">🐱</div>
          <p className="cat-panel rounded-full px-6 py-3 text-sm font-black uppercase tracking-widest text-[#fef0d0]">
            Chargement de la ferme...
          </p>
        </div>
      </main>
    );
  }

  // ---- LOGIN SCREEN ----
  if (!profile) {
    return (
      <main className="cat-shell">
        <div className="relative z-10 flex h-full flex-col overflow-y-auto">
          <div className="flex-1 grid place-items-center px-4 py-6">
            <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-[1fr_400px]">

              {/* Left: branding + cat previews */}
              <div className="flex flex-col justify-center gap-5">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">🐾</span>
                  <span className="cat-panel rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-[#ff8c32]">
                    Le meilleur jeu de chats
                  </span>
                </div>
                <h1 className="text-5xl font-black leading-[0.88] text-[#fef0d0] sm:text-7xl lg:text-8xl">
                  Grisou
                  <span className="block bg-[linear-gradient(90deg,#ff8c32,#ff5577,#ffcc00,#c084fc)] bg-clip-text text-transparent">
                    X Ronron
                  </span>
                </h1>
                <p className="text-sm font-bold text-[#fef0d0]/55 max-w-sm">
                  Clique sur tes chats, collecte des croquettes, domine le classement.
                </p>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  {Object.entries(cats).map(([id, cat]) => (
                    <div key={id} className="cat-panel group overflow-hidden rounded-[24px] p-2.5">
                      <div className="overflow-hidden rounded-[18px]">
                        <Image
                          src={cat.src} alt={cat.name} width={400} height={400}
                          className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                          priority
                        />
                      </div>
                      <div className="flex items-center justify-between px-2 pt-2.5 text-xs font-black">
                        <span className="text-[#fef0d0]">{cat.name}</span>
                        <span style={{ color: cat.accent }}>{cat.vibe}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="cat-btn rounded-2xl px-5 py-2.5 text-sm" href="/clicker">Mode clicker</Link>
                  <Link className="cat-btn-pink rounded-2xl px-5 py-2.5 text-sm" href="/duel">Mode duel</Link>
                </div>
              </div>

              {/* Right: login form */}
              <form onSubmit={handleStart} className="cat-panel rounded-[28px] p-4 flex flex-col gap-3">
                <div className="rounded-[20px] border border-[#ff8c32]/12 bg-black/40 p-4">
                  <p className="cat-eyebrow mb-3">Connexion 🐱</p>

                  <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-white/8 p-1 mb-4">
                    {(["login", "create"] as const).map((mode) => (
                      <button key={mode} type="button" onClick={() => { setAuthMode(mode); setMessage(""); }}
                        className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-black transition ${authMode === mode ? "bg-[#ff8c32] text-[#1c0800]" : "text-[#fef0d0]/60"}`}>
                        {mode === "login" ? <><LogIn className="h-4 w-4" />Se connecter</> : <><UserPlus className="h-4 w-4" />Creer</>}
                      </button>
                    ))}
                  </div>

                  <label htmlFor="username" className="block text-2xl font-black leading-tight text-[#fef0d0] mb-3">
                    {authMode === "login" ? "Retrouve ta ferme" : "Cree ta ferme"}
                  </label>

                  <input
                    id="username" value={username} onChange={(e) => setUsername(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[#ff8c32]/20 bg-[#fef0d0]/92 px-4 text-lg font-black text-[#1c0800] outline-none ring-[#ff8c32] transition focus:ring-2 mb-2.5"
                    maxLength={18} placeholder="Pseudo" autoComplete="username"
                  />
                  <div className="relative mb-3">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b5030]" />
                    <input
                      id="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className="h-12 w-full rounded-xl border border-[#ff8c32]/20 bg-[#fef0d0]/92 px-10 text-lg font-black text-[#1c0800] outline-none ring-[#ff8c32] transition focus:ring-2"
                      minLength={6} type="password" placeholder="Mot de passe"
                      autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    />
                  </div>

                  <button disabled={authLoading}
                    className="cat-btn flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base disabled:cursor-wait disabled:opacity-70">
                    {authMode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {authLoading ? "Chargement..." : authMode === "login" ? "Jouer 🐾" : "Creer le compte"}
                  </button>
                </div>

                <p className="rounded-2xl bg-[#ff8c32]/8 border border-[#ff8c32]/12 px-3 py-2.5 text-xs font-bold text-[#fef0d0]/60">
                  {isSupabaseMisconfigured
                    ? "URL Supabase incorrecte."
                    : isSupabaseConfigured
                      ? "Supabase actif — pseudos uniques, classement global."
                      : "Mode demo local — ajoute Supabase pour le multi."}
                </p>
                {message && (
                  <p className="rounded-2xl bg-[#ff3322]/16 border border-[#ff3322]/20 px-3 py-2.5 text-sm font-black text-[#ffccc0]">
                    {message}
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ---- GAME SCREEN ----

  const comboIntense = combo >= 25;
  const comboMid = combo >= 10;

  return (
    <main className={`cat-shell ${shaking ? "screen-shake" : ""}`}>
      {/* Remote cursors */}
      {Object.values(remoteCursors).map((cursor) => (
        <div key={cursor.id}
          className="pointer-events-none fixed z-50 rounded-full px-2.5 py-1 text-xs font-black text-[#1c0800] shadow-xl transition-transform duration-75"
          style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, backgroundColor: cursor.color, transform: "translate(10px,10px)" }}>
          <MousePointer2 className="mr-1 inline h-3 w-3" />
          {cursor.username}
        </div>
      ))}

      <div className="relative z-10 flex h-full flex-col">

        {/* ======== HEADER ======== */}
        <header className="cat-panel shrink-0 flex items-center gap-2 border-0 border-b border-[#ff8c32]/18 rounded-none px-3 py-2">
          {/* Left: player name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg shrink-0">🐱</span>
            <span className="truncate text-sm font-black text-[#ff8c32]">{profile.username}</span>
          </div>

          {/* Center: treats counter */}
          <div className="flex flex-col items-center shrink-0">
            <span className="text-xl font-black leading-none text-[#fef0d0] sm:text-3xl">
              {fmt.format(Math.floor(profile.treats))}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#ff8c32]/70">croquettes 🐾</span>
          </div>

          {/* Combo badge */}
          <div className="hidden sm:flex items-center min-w-[80px] justify-center">
            {combo > 1 && (
              <div className={`rounded-xl px-2.5 py-1 text-xs font-black transition-all ${comboIntense ? "bg-[#ffcc00] text-[#1c0800] animate-[affordPulse_0.5s_ease-in-out_infinite]" : comboMid ? "bg-[#ff8c32] text-[#1c0800]" : "bg-[#ff8c32]/20 text-[#ff8c32]"}`}>
                ×{combo} {comboIntense ? "🔥🔥" : comboMid ? "🔥" : ""}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Link className="cat-panel rounded-xl px-3 py-1.5 text-xs font-black text-[#fef0d0] hover:bg-[#ff8c32]/10 transition hidden sm:block" href="/clicker">Clicker</Link>
            <Link className="cat-panel rounded-xl px-3 py-1.5 text-xs font-black text-[#fef0d0] hover:bg-[#ff5577]/10 transition hidden sm:block" href="/duel">Duel</Link>
            <button title="Son" onClick={() => setSoundOn((v) => !v)} className="cat-icon-btn">
              {soundOn ? <Volume2 className="h-4 w-4" /> : <Music2 className="h-4 w-4" />}
            </button>
            <button title="Sauvegarder" onClick={() => saveProfile(profile, false)} className="cat-icon-btn">
              <Save className="h-4 w-4" />
            </button>
            <button title="Quitter" onClick={signOut} className="cat-icon-btn">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ======== BODY ======== */}
        <div className="flex-1 flex overflow-hidden">

          {/* ==== LEFT SIDEBAR: cats + stats ==== */}
          <aside className={`flex-col overflow-y-auto overflow-x-hidden w-full lg:w-52 lg:shrink-0 border-r border-[#ff8c32]/12 p-3 gap-3 bg-[#0c0906]/60
            ${activeTab === "stats" ? "flex" : "hidden"} lg:flex`}>

            {/* Cat selection */}
            <div className="cat-panel rounded-[20px] p-3">
              <p className="cat-eyebrow mb-2.5">Chats</p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                {Object.entries(cats).map(([id, cat]) => (
                  <button key={id} onClick={() => switchCat(id as CatId)}
                    className={`grid grid-cols-[48px_1fr] lg:grid-cols-[56px_1fr] items-center gap-2.5 rounded-[16px] border p-2 text-left font-black transition
                      ${profile.selected_cat === id
                        ? "border-[#ff8c32]/60 bg-[#ff8c32]/14 shadow-[0_0_20px_rgba(255,140,50,.18)]"
                        : "border-[#ff8c32]/12 bg-[#ff8c32]/05 hover:bg-[#ff8c32]/10"
                      }`}>
                    <Image src={cat.src} alt={cat.name} width={100} height={100} className="aspect-square w-full rounded-[12px] object-cover" />
                    <span>
                      <span className="block text-xs text-[#fef0d0]">{cat.name}</span>
                      <span className="block text-[10px] text-[#fef0d0]/50">lvl {fmt.format(profile.cat_levels[id as CatId] ?? 1)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="cat-panel rounded-[20px] p-3">
              <p className="cat-eyebrow mb-2.5">Stats</p>
              <div className="grid grid-cols-2 gap-1.5">
                <StatChip label="Clics" value={fmt.format(profile.total_clicks)} />
                <StatChip label="Niveaux" value={fmt.format(totalUpgradeLevels)} />
                <StatChip label="Rebirths" value={fmt.format(profile.rebirths)} />
                <StatChip label={`${currentCat.name} niv`} value={fmt.format(activeCatLevel)} />
                <StatChip label="/clic" value={fmt.format(Math.floor(treatsPerClick))} />
                <StatChip label="auto/s" value={passiveGain.toFixed(1)} />
              </div>
              {(saving || message) && (
                <div className="mt-2">
                  {saving && <p className="text-[10px] font-black text-[#ff8c32]/60 text-center">Sauvegarde...</p>}
                  {message && <p className="mt-1 rounded-xl bg-[#ff3322]/12 px-2.5 py-2 text-[11px] font-black text-[#ffccc0]">{message}</p>}
                </div>
              )}
            </div>

            {/* Leaderboard */}
            <div className="cat-panel rounded-[20px] p-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Trophy className="h-4 w-4 text-[#ffcc00]" />
                <p className="cat-eyebrow">Classement</p>
              </div>
              <div className="grid gap-1.5">
                {(leaderboard.length ? leaderboard : [profile]).slice(0, 5).map((item, i) => (
                  <div key={item.id} className={`grid grid-cols-[1fr_auto] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-black
                    ${item.id === profile.id ? "bg-[#ff8c32]/16 border border-[#ff8c32]/30" : "bg-[#ff8c32]/06"}`}>
                    <span className="truncate text-[#fef0d0]">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {item.username}
                    </span>
                    <span className="text-[#ffcc00]">{fmt.format(item.treats)}</span>
                  </div>
                ))}
              </div>
            </div>

            {!isSupabaseConfigured && (
              <p className="rounded-2xl bg-[#ff8c32]/06 border border-[#ff8c32]/10 px-3 py-2 text-[10px] font-bold text-[#fef0d0]/40">
                Classement global disponible avec Supabase.
              </p>
            )}
          </aside>

          {/* ==== CENTER: main click area ==== */}
          <section className={`flex-1 flex-col overflow-hidden px-3 py-2 gap-2
            ${activeTab === "play" ? "flex" : "hidden"} lg:flex`}>

            {/* Mini stats row */}
            <div className="cat-card shrink-0 rounded-[16px] px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-[#ff8c32]/70">Croquettes</span>
                <p className="text-2xl font-black leading-none text-[#fef0d0] sm:text-4xl">{fmt.format(Math.floor(profile.treats))}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <MiniStat label="clic" value={`+${fmt.format(Math.floor(treatsPerClick))}`} />
                <MiniStat label="auto" value={`${passiveGain.toFixed(1)}/s`} />
                {combo > 1 && <MiniStat label="combo" value={`×${combo}${comboIntense ? "🔥" : ""}`} accent="#ff8c32" />}
              </div>
            </div>

            {/* Cat button — fills available space */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden min-h-0">
              {/* Glow orb behind cat */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: "min(55vw, 420px)", height: "min(55vw, 420px)",
                  background: `radial-gradient(circle, ${currentCat.glow} 0%, transparent 70%)`,
                  animation: "glowPulse 2.5s ease-in-out infinite",
                }}
              />

              {/* The cat button itself */}
              <button
                onPointerDown={handleClick}
                className="relative max-h-full max-w-full outline-none select-none"
                style={{ width: "min(70vw, min(calc(100vh - 16rem), 460px))", aspectRatio: "1/1" }}
              >
                <Image
                  src={currentCat.src}
                  alt={currentCat.name}
                  width={920} height={920}
                  priority
                  draggable={false}
                  className={`relative z-10 w-full h-full object-cover rounded-[28px] select-none
                    shadow-[0_20px_60px_rgba(0,0,0,0.5)]
                    transition-all duration-[110ms]
                    ${pressed
                      ? "scale-[.91] rotate-[-1.5deg] brightness-125 saturate-150"
                      : "hover:scale-[1.02] animate-[gentleBob_3.2s_ease-in-out_infinite]"
                    }`}
                  style={{ boxShadow: `0 0 0 4px ${currentCat.accent}55` }}
                />

                {/* Number pops */}
                {pops.map((pop) => (
                  <span
                    key={pop.id}
                    className="pointer-events-none absolute z-20 animate-[floatUp_800ms_cubic-bezier(.15,.9,.2,1)_forwards] rounded-full px-3 py-1.5 text-lg font-black text-[#1c0800] shadow-lg"
                    style={{ left: pop.x, top: pop.y, backgroundColor: pop.hue }}
                  >
                    +{fmt.format(Math.floor(pop.value))} 🐾
                  </span>
                ))}
              </button>
            </div>

            {/* Progress bar + cat info */}
            <div className="cat-card shrink-0 rounded-[16px] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                <p className="font-black text-[#fef0d0]">{currentCat.name} — {currentCat.vibe} — lvl {activeCatLevel}</p>
                {nextUpgrade && <p className="font-black text-[#fef0d0]/50">Prochain : {fmt.format(nextUpgrade.cost)} 🐾</p>}
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#ff8c32]/15">
                <div className="h-full rounded-full bg-[#ff8c32] transition-all duration-300" style={{ width: `${nextProgress}%` }} />
              </div>
            </div>
          </section>

          {/* ==== RIGHT SIDEBAR: shop ==== */}
          <aside className={`flex-col w-full lg:w-72 lg:shrink-0 border-l border-[#ff8c32]/12 overflow-hidden bg-[#0c0906]/60
            ${activeTab === "shop" ? "flex" : "hidden"} lg:flex`}>

            {/* Shop header */}
            <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-3 pb-2 border-b border-[#ff8c32]/10">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛒</span>
                <p className="cat-eyebrow">Boutique</p>
              </div>
              <Coins className="h-5 w-5 text-[#ffcc00]" />
            </div>

            {/* Scrollable shop items */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <div className="grid gap-2">

                {/* Level up cat */}
                <button onClick={levelUpCurrentCat}
                  className={`rounded-[18px] border p-3 text-left transition active:translate-y-0.5
                    ${profile.treats >= catLevelCost(activeCatLevel, profile.rebirths)
                      ? "can-afford border-[#65b8ff]/40 bg-[#65b8ff]/10"
                      : "border-[#65b8ff]/18 bg-[#65b8ff]/06"
                    }`}>
                  <div className="grid grid-cols-[40px_1fr_auto] items-center gap-2.5">
                    <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#65b8ff] text-[#060c18]">
                      <Cat className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-black text-[#fef0d0]">Level up {currentCat.name}</span>
                      <span className="block text-[11px] font-bold text-[#fef0d0]/50">niv {activeCatLevel} — +12% bonus</span>
                    </span>
                    <span className="rounded-xl bg-black/50 px-2.5 py-1.5 text-xs font-black text-[#fef0d0]">
                      {fmt.format(catLevelCost(activeCatLevel, profile.rebirths))}
                    </span>
                  </div>
                </button>

                {/* Rebirth */}
                <button onClick={rebirth}
                  className={`rounded-[18px] border p-3 text-left transition active:translate-y-0.5
                    ${profile.treats >= rebirthCost(profile.rebirths)
                      ? "can-afford border-[#ffcc00]/50 bg-[#ffcc00]/10"
                      : "border-[#ffcc00]/18 bg-[#ffcc00]/06"
                    }`}>
                  <div className="grid grid-cols-[40px_1fr_auto] items-center gap-2.5">
                    <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#ffcc00] text-[#1c0800]">
                      <Flame className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-black text-[#fef0d0]">Rebirth 🔥</span>
                      <span className="block text-[11px] font-bold text-[#fef0d0]/50">reset — +35% permanent</span>
                    </span>
                    <span className="rounded-xl bg-black/50 px-2.5 py-1.5 text-xs font-black text-[#fef0d0]">
                      {fmt.format(rebirthCost(profile.rebirths))}
                    </span>
                  </div>
                </button>

                {/* Upgrades */}
                {upgrades.map((upgrade) => {
                  const level = profile.upgrades[upgrade.id] ?? 0;
                  const cost = upgradeCost(upgrade, level);
                  const affordable = profile.treats >= cost;
                  const progress = Math.min(100, (profile.treats / cost) * 100);
                  const Icon = upgrade.icon;
                  return (
                    <button key={upgrade.id} onClick={() => buyUpgrade(upgrade)}
                      className={`rounded-[18px] border p-3 text-left transition active:translate-y-0.5 ${
                        affordable
                          ? "can-afford border-[#ff8c32]/45 bg-[#ff8c32]/09"
                          : "border-[#ff8c32]/12 bg-[#ff8c32]/04"
                      }`}>
                      <div className="grid grid-cols-[40px_1fr_auto] items-center gap-2.5">
                        <span className="grid h-10 w-10 place-items-center rounded-[14px]" style={{ backgroundColor: upgrade.tint }}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-[#fef0d0]">{upgrade.name}</span>
                          <span className="block text-[11px] font-bold text-[#fef0d0]/50">
                            niv {level} — {upgrade.effect(level)}
                          </span>
                        </span>
                        <span className="rounded-xl bg-black/50 px-2.5 py-1.5 text-xs font-black text-[#fef0d0]">{fmt.format(cost)}</span>
                      </div>
                      <p className="mt-2 text-[11px] font-bold text-[#fef0d0]/44">{upgrade.description}</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: upgrade.tint }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        {/* ======== MOBILE TAB BAR ======== */}
        <nav className="cat-tab-bar lg:hidden shrink-0 grid grid-cols-3">
          {(
            [
              { id: "play" as const,  icon: "🐱", label: "Jouer"  },
              { id: "shop" as const,  icon: "🛒", label: "Shop"   },
              { id: "stats" as const, icon: "🏆", label: "Stats"  },
            ] as const
          ).map(({ id, icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-black transition
                ${activeTab === id
                  ? "text-[#ff8c32] border-t-2 border-[#ff8c32]"
                  : "text-[#fef0d0]/40 border-t-2 border-transparent"
                }`}>
              <span className="text-xl">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

      </div>
    </main>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#ff8c32]/12 bg-[#ff8c32]/06 px-2.5 py-2">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ff8c32]/60">{label}</p>
      <p className="truncate text-sm font-black" style={{ color: accent ?? "#fef0d0" }}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#ff8c32]/14 bg-[#ff8c32]/08 px-3 py-1.5 text-center">
      <p className="text-[9px] font-black uppercase tracking-wider text-[#ff8c32]/60">{label}</p>
      <p className="text-sm font-black" style={{ color: accent ?? "#fef0d0" }}>{value}</p>
    </div>
  );
}
