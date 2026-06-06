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
    accent: "#65b8ff",
    glow: "rgba(101, 184, 255, .36)",
    vibe: "moelleux cosmique",
  },
  ronron: {
    name: "Ronron",
    src: "/cats/ronron.jpg",
    accent: "#ff8c61",
    glow: "rgba(255, 140, 97, .34)",
    vibe: "squeechie solaire",
  },
};

const upgrades: Upgrade[] = [
  {
    id: "paw",
    name: "Patte turbo",
    icon: PawPrint,
    description: "Plus de croquettes a chaque pression.",
    baseCost: 25,
    growth: 1.22,
    tint: "#69d6ff",
    effect: (level) => `+${level + 1}/clic`,
  },
  {
    id: "cushion",
    name: "Coussin aimant",
    icon: Sparkles,
    description: "Production douce meme sans cliquer.",
    baseCost: 90,
    growth: 1.28,
    tint: "#ffd166",
    effect: (level) => `+${(level * 0.8 + 0.8).toFixed(1)}/s`,
  },
  {
    id: "gloss",
    name: "Brillance squeechie",
    icon: Gem,
    description: "Multiplie tous tes gains.",
    baseCost: 220,
    growth: 1.34,
    tint: "#8df0bf",
    effect: (level) => `x${(1 + (level + 1) * 0.15).toFixed(2)}`,
  },
  {
    id: "snack",
    name: "Snack premium",
    icon: Zap,
    description: "Rend chaque clic plus explosif.",
    baseCost: 650,
    growth: 1.42,
    tint: "#ff8c61",
    effect: (level) => `+${(level + 1) * 8}%`,
  },
  {
    id: "laser",
    name: "Laser hypnotique",
    icon: Zap,
    description: "Grosses pointes de puissance au clic.",
    baseCost: 1400,
    growth: 1.5,
    tint: "#ff5f3d",
    effect: (level) => `+${(level + 1) * 5}% clic`,
  },
  {
    id: "yarn",
    name: "Pelote quantique",
    icon: Sparkles,
    description: "Ameliore la production automatique.",
    baseCost: 3200,
    growth: 1.55,
    tint: "#65b8ff",
    effect: (level) => `+${(level + 1) * 3}/s`,
  },
  {
    id: "nap",
    name: "Sieste royale",
    icon: Cat,
    description: "Bonus global doux mais infini.",
    baseCost: 7200,
    growth: 1.6,
    tint: "#c9f28d",
    effect: (level) => `x${(1 + (level + 1) * 0.04).toFixed(2)}`,
  },
  {
    id: "chef",
    name: "Chef croquette",
    icon: Coins,
    description: "Multiplie les croquettes gagnees.",
    baseCost: 18000,
    growth: 1.66,
    tint: "#ffd166",
    effect: (level) => `x${(1 + (level + 1) * 0.06).toFixed(2)}`,
  },
  {
    id: "portal",
    name: "Portail miaou",
    icon: Sparkles,
    description: "La ferme attire des croquettes d'ailleurs.",
    baseCost: 52000,
    growth: 1.72,
    tint: "#b69cff",
    effect: (level) => `+${(level + 1) * 18}/s`,
  },
  {
    id: "crown",
    name: "Couronne du goat",
    icon: Trophy,
    description: "Booste les niveaux de chats.",
    baseCost: 140000,
    growth: 1.78,
    tint: "#ffcf5a",
    effect: (level) => `+${(level + 1) * 7}% chats`,
  },
  {
    id: "factory",
    name: "Usine a ronrons",
    icon: Gem,
    description: "Production passive massive.",
    baseCost: 400000,
    growth: 1.84,
    tint: "#8df0bf",
    effect: (level) => `+${(level + 1) * 60}/s`,
  },
  {
    id: "constellation",
    name: "Constellation squeechie",
    icon: Flame,
    description: "Bonus final qui scale pour toujours.",
    baseCost: 1200000,
    growth: 1.92,
    tint: "#ff7fbf",
    effect: (level) => `x${(1 + (level + 1) * 0.1).toFixed(2)}`,
  },
];

const emptyUpgrades: Record<UpgradeId, number> = {
  paw: 0,
  cushion: 0,
  gloss: 0,
  snack: 0,
  laser: 0,
  yarn: 0,
  nap: 0,
  chef: 0,
  portal: 0,
  crown: 0,
  factory: 0,
  constellation: 0,
};

const emptyCatLevels: Record<CatId, number> = {
  grisou: 1,
  ronron: 1,
};

const demoKey = "squeechie-clicker-demo-profile";

const numberFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

function freshProfile(username: string, id = "demo-user"): GameProfile {
  return {
    id,
    username,
    selected_cat: "grisou",
    treats: 0,
    total_clicks: 0,
    click_power: 1,
    auto_rate: 0,
    multiplier: 1,
    upgrades: { ...emptyUpgrades },
    rebirths: 0,
    lifetime_treats: 0,
    cat_levels: { ...emptyCatLevels },
  };
}

function usernameToAuthEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `user_${(hash >>> 0).toString(16)}@grisouxronron.local`;
}

function upgradeCost(upgrade: Upgrade, level: number) {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.growth, level));
}

function catLevelCost(level: number, rebirths: number) {
  return Math.floor(450 * Math.pow(1.42, level - 1) * (1 + rebirths * 0.12));
}

function rebirthCost(rebirths: number) {
  return Math.floor(100000 * Math.pow(3.2, rebirths));
}

function normalizeProfile(profile: GameProfile): GameProfile {
  const levels = { ...emptyUpgrades, ...(profile.upgrades ?? {}) };
  const catLevels = { ...emptyCatLevels, ...(profile.cat_levels ?? {}) };
  return {
    ...profile,
    selected_cat: profile.selected_cat ?? "grisou",
    treats: Number(profile.treats ?? 0),
    total_clicks: Number(profile.total_clicks ?? 0),
    click_power: Number(profile.click_power ?? 1),
    auto_rate: Number(profile.auto_rate ?? 0),
    multiplier: Number(profile.multiplier ?? 1),
    upgrades: levels,
    rebirths: Number(profile.rebirths ?? 0),
    lifetime_treats: Number(profile.lifetime_treats ?? profile.treats ?? 0),
    cat_levels: catLevels,
  };
}

function profileSavePayload(profile: GameProfile) {
  return {
    id: profile.id,
    username: profile.username,
    selected_cat: profile.selected_cat,
    treats: profile.treats,
    total_clicks: profile.total_clicks,
    click_power: profile.click_power,
    auto_rate: profile.auto_rate,
    multiplier: profile.multiplier,
    upgrades: profile.upgrades,
    rebirths: profile.rebirths,
    lifetime_treats: profile.lifetime_treats,
    cat_levels: profile.cat_levels,
    updated_at: new Date().toISOString(),
  };
}

function legacyProfileSavePayload(profile: GameProfile) {
  return {
    id: profile.id,
    username: profile.username,
    selected_cat: profile.selected_cat,
    treats: profile.treats,
    total_clicks: profile.total_clicks,
    click_power: profile.click_power,
    auto_rate: profile.auto_rate,
    multiplier: profile.multiplier,
    upgrades: profile.upgrades,
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
      * rebirthMultiplier
      * catMultiplier
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
    ? Object.values({ ...emptyUpgrades, ...profile.upgrades }).reduce((sum, value) => sum + value, 0)
    : 0;

  const playTone = useCallback(
    (kind: "click" | "buy" | "error" | "save") => {
      if (!soundOn || typeof window === "undefined") return;
      const ctx = audio.current ?? new AudioContext();
      audio.current = ctx;
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      const oscillator = ctx.createOscillator();
      const second = ctx.createOscillator();
      const base = { click: 520, buy: 740, error: 140, save: 620 }[kind];

      oscillator.type = kind === "error" ? "sawtooth" : "triangle";
      second.type = "sine";
      oscillator.frequency.setValueAtTime(base, now);
      oscillator.frequency.exponentialRampToValueAtTime(base * 1.55, now + 0.08);
      second.frequency.setValueAtTime(base * 2, now + 0.025);
      gain.gain.setValueAtTime(kind === "error" ? 0.035 : 0.085, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      oscillator.connect(gain);
      second.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      second.start(now + 0.025);
      oscillator.stop(now + 0.18);
      second.stop(now + 0.14);
    },
    [soundOn],
  );

  const playMeow = useCallback(() => {
    if (!soundOn || typeof window === "undefined") return;
    const ctx = audio.current ?? new AudioContext();
    audio.current = ctx;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    const wobble = ctx.createOscillator();
    const wobbleGain = ctx.createGain();

    osc.type = "sine";
    wobble.type = "triangle";
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(430, now + 0.11);
    osc.frequency.exponentialRampToValueAtTime(610, now + 0.22);
    wobble.frequency.setValueAtTime(18, now);
    wobbleGain.gain.setValueAtTime(38, now);
    wobble.connect(wobbleGain);
    wobbleGain.connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.085, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    wobble.start(now);
    osc.start(now);
    wobble.stop(now + 0.3);
    osc.stop(now + 0.3);
  }, [soundOn]);

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
      if (!userId) {
        setLoading(false);
        await loadLeaderboard();
        return;
      }

      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (data) {
        const remoteProfile = normalizeProfile(data as GameProfile);
        const cached = window.localStorage.getItem(demoKey);
        if (cached) {
          const cachedProfile = normalizeProfile(JSON.parse(cached));
          if (
            cachedProfile.id === remoteProfile.id
            && (cachedProfile.lifetime_treats > remoteProfile.lifetime_treats
              || cachedProfile.rebirths > remoteProfile.rebirths)
          ) {
            setProfile(cachedProfile);
          } else {
            setProfile(remoteProfile);
          }
        } else {
          setProfile(remoteProfile);
        }
      }
      setLoading(false);
      await loadLeaderboard();
    }

    loadProfile();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (!profile || !supabase) return;
    const client = supabase;
    const activeProfile = profile;
    const color = activeProfile.selected_cat === "grisou" ? "#65b8ff" : "#ff8c61";
    const channel = client
      .channel("clicker-cursors")
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const cursor = payload as RemoteCursor;
        if (!cursor.id || cursor.id === activeProfile.id) return;
        setRemoteCursors((current) => ({
          ...current,
          [cursor.id]: { ...cursor, lastSeen: Date.now() },
        }));
      })
      .subscribe();

    function sendCursor(event: PointerEvent) {
      const now = Date.now();
      if (now - lastCursorSent.current < 50) return;
      lastCursorSent.current = now;
      channel.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          id: activeProfile.id,
          username: activeProfile.username,
          x: event.clientX / window.innerWidth,
          y: event.clientY / window.innerHeight,
          color,
        },
      });
    }

    const staleTimer = window.setInterval(() => {
      setRemoteCursors((current) =>
        Object.fromEntries(Object.entries(current).filter(([, cursor]) => Date.now() - cursor.lastSeen < 2500)),
      );
    }, 1000);

    window.addEventListener("pointermove", sendCursor);
    return () => {
      window.removeEventListener("pointermove", sendCursor);
      window.clearInterval(staleTimer);
      client.removeChannel(channel);
    };
  }, [profile]);

  const saveProfile = useCallback(
    async (nextProfile: GameProfile, quiet = true) => {
      window.localStorage.setItem(demoKey, JSON.stringify(nextProfile));
      if (!supabase) {
        return;
      }

      setSaving(true);
      const { error } = await supabase.from("profiles").upsert(profileSavePayload(nextProfile));
      setSaving(false);
      if (error) {
        const legacy = await supabase.from("profiles").upsert(legacyProfileSavePayload(nextProfile));
        if (legacy.error) {
          setMessage(`Sauvegarde locale ok, Supabase refuse: ${legacy.error.message}`);
          playTone("error");
          return;
        }
        setMessage("Sauvegarde locale ok. Reexecute supabase/schema.sql pour sauvegarder rebirths et niveaux.");
        return;
      }
      if (!quiet) {
        setMessage("Sauvegarde parfaite.");
        playTone("save");
      }
      await loadLeaderboard();
    },
    [loadLeaderboard, playTone],
  );

  const queueSave = useCallback(
    (nextProfile: GameProfile) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveProfile(nextProfile), 450);
    },
    [saveProfile],
  );

  const updateProfile = useCallback(
    (producer: (profile: GameProfile) => GameProfile) => {
      setProfile((current) => {
        if (!current) return current;
        const next = normalizeProfile(producer(current));
        queueSave(next);
        return next;
      });
    },
    [queueSave],
  );

  useEffect(() => {
    if (!profile || passiveGain <= 0) return;
    const timer = setInterval(() => {
      updateProfile((current) => ({
        ...current,
        treats: current.treats + passiveGain,
        lifetime_treats: current.lifetime_treats + passiveGain,
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [passiveGain, profile, updateProfile]);

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authLoading) return;
    const clean = username.trim().replace(/\s+/g, " ");
    if (clean.length < 3 || clean.length > 18) {
      setMessage("Pseudo entre 3 et 18 caracteres.");
      playTone("error");
      return;
    }
    if (password.length < 6) {
      setMessage("Mot de passe: 6 caracteres minimum.");
      playTone("error");
      return;
    }

    if (isSupabaseMisconfigured) {
      setMessage("URL Supabase incorrecte: utilise l'URL du projet Supabase, pas l'URL Vercel.");
      playTone("error");
      return;
    }

    setAuthLoading(true);
    setMessage("");

    if (!supabase) {
      const cached = window.localStorage.getItem(demoKey);
      if (authMode === "login" && cached) {
        const existing = normalizeProfile(JSON.parse(cached));
        if (existing.username.toLowerCase() === clean.toLowerCase()) {
          setProfile(existing);
          setAuthLoading(false);
          return;
        }
      }
      if (authMode === "login") {
        setAuthLoading(false);
        setMessage("Aucun compte local avec ce pseudo. Cree-le d'abord.");
        playTone("error");
        return;
      }
      const next = freshProfile(clean);
      setProfile(next);
      window.localStorage.setItem(demoKey, JSON.stringify(next));
      setAuthLoading(false);
      return;
    }

    const email = usernameToAuthEmail(clean);
    const client = supabase;
    const loadExistingProfile = async (userId: string) => {
      const { data, error } = await client.from("profiles").select("*").eq("id", userId).single();
      if (error || !data) return false;
      setProfile(normalizeProfile(data as GameProfile));
      await loadLeaderboard();
      playTone("save");
      return true;
    };

    if (authMode === "create") {
      const existingAuth = await supabase.auth.signInWithPassword({ email, password });
      if (existingAuth.data.user) {
        const loaded = await loadExistingProfile(existingAuth.data.user.id);
        setAuthLoading(false);
        if (!loaded) {
          setMessage("Compte trouve, mais sauvegarde introuvable.");
          playTone("error");
        }
        return;
      }

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", clean)
        .maybeSingle();
      if (existingProfile) {
        setAuthLoading(false);
        setMessage("Ce pseudo existe deja. Utilise Se connecter.");
        playTone("error");
        return;
      }
    }

    const auth =
      authMode === "create"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { username: clean } },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (auth.error || !auth.data.user) {
      setAuthLoading(false);
      const status = auth.error?.status;
      setMessage(
        status === 429
          ? "Trop de créations de comptes. Attends un peu avant de reessayer."
          : authMode === "create"
          ? "Impossible de creer le compte. Le pseudo existe peut-etre deja."
          : "Pseudo ou mot de passe incorrect.",
      );
      playTone("error");
      return;
    }

    if (authMode === "login") {
      const loaded = await loadExistingProfile(auth.data.user.id);
      setAuthLoading(false);
      if (!loaded) {
        setMessage("Compte trouve, mais sauvegarde introuvable.");
        playTone("error");
        return;
      }
      return;
    }

    if (!auth.data.session) {
      setAuthLoading(false);
      setMessage("Desactive la confirmation email dans Supabase Auth pour les comptes par pseudo.");
      playTone("error");
      return;
    }

    const next = freshProfile(clean, auth.data.user.id);
    const { error } = await supabase.from("profiles").insert(next);
    setAuthLoading(false);
    if (error) {
      setMessage(error.code === "23505" ? "Ce pseudo est deja pris." : "Impossible de creer le profil.");
      await supabase.auth.signOut();
      playTone("error");
      return;
    }
    setProfile(next);
    await loadLeaderboard();
    playTone("save");
  }

  function handleClick(event: React.PointerEvent<HTMLButtonElement>) {
    if (!profile) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const nextCombo = combo + 1;
    const comboBoost = 1 + Math.min(nextCombo, 60) * 0.006;
    const snackBoost = 1 + (profile.upgrades.snack ?? 0) * 0.08;
    const value = treatsPerClick * snackBoost * comboBoost;
    const hue = nextCombo % 5 === 0 ? "#ffd166" : currentCat.accent;

    setCombo(nextCombo);
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => setCombo(0), 1100);
    setPressed(true);
    window.setTimeout(() => setPressed(false), 130);
    setPops((current) => [...current, { id: popId.current++, value, x, y, hue }].slice(-16));
    window.setTimeout(() => setPops((current) => current.slice(1)), 780);
    updateProfile((current) => ({
      ...current,
      treats: current.treats + value,
      lifetime_treats: current.lifetime_treats + value,
      total_clicks: current.total_clicks + 1,
    }));
    playMeow();
  }

  function buyUpgrade(upgrade: Upgrade) {
    if (!profile) return;
    const level = profile.upgrades[upgrade.id] ?? 0;
    const cost = upgradeCost(upgrade, level);
    if (profile.treats < cost) {
      setMessage("Pas assez de croquettes.");
      playTone("error");
      return;
    }

    updateProfile((current) => {
      const levels = { ...current.upgrades, [upgrade.id]: level + 1 };
      return {
        ...current,
        treats: current.treats - cost,
        upgrades: levels,
        click_power: 1 + levels.paw + levels.laser * 0.25,
        auto_rate: levels.cushion * 0.8 + levels.yarn * 3 + levels.portal * 18 + levels.factory * 60,
        multiplier: 1 + levels.gloss * 0.15 + levels.nap * 0.04 + levels.chef * 0.06 + levels.constellation * 0.1,
      };
    });
    setMessage(`${upgrade.name} niveau ${level + 1}.`);
    playTone("buy");
  }

  function switchCat(catId: CatId) {
    updateProfile((current) => ({ ...current, selected_cat: catId }));
    playTone("buy");
  }

  function levelUpCurrentCat() {
    if (!profile) return;
    const currentLevel = profile.cat_levels[profile.selected_cat] ?? 1;
    const cost = catLevelCost(currentLevel, profile.rebirths);
    if (profile.treats < cost) {
      setMessage("Pas assez de croquettes pour level up ce chat.");
      playTone("error");
      return;
    }
    updateProfile((current) => ({
      ...current,
      treats: current.treats - cost,
      cat_levels: {
        ...current.cat_levels,
        [current.selected_cat]: (current.cat_levels[current.selected_cat] ?? 1) + 1,
      },
    }));
    setMessage(`${cats[profile.selected_cat].name} gagne un niveau.`);
    playTone("buy");
  }

  function rebirth() {
    if (!profile) return;
    const cost = rebirthCost(profile.rebirths);
    if (profile.treats < cost) {
      setMessage(`Rebirth disponible a ${numberFormat.format(cost)} croquettes.`);
      playTone("error");
      return;
    }
    updateProfile((current) => ({
      ...current,
      treats: 0,
      click_power: 1,
      auto_rate: 0,
      multiplier: 1,
      rebirths: current.rebirths + 1,
      upgrades: { ...emptyUpgrades },
    }));
    setMessage(`Rebirth +1. Multiplicateur permanent x${(1 + (profile.rebirths + 1) * 0.35).toFixed(2)}.`);
    playTone("save");
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    window.localStorage.removeItem(demoKey);
    setProfile(null);
    setUsername("");
    setPassword("");
    setMessage("");
    setCombo(0);
  }

  const nextUpgrade = useMemo(() => {
    if (!profile) return null;
    return upgrades
      .map((upgrade) => ({
        upgrade,
        level: profile.upgrades[upgrade.id] ?? 0,
        cost: upgradeCost(upgrade, profile.upgrades[upgrade.id] ?? 0),
      }))
      .sort((a, b) => a.cost - b.cost)[0];
  }, [profile]);

  const nextProgress = nextUpgrade && profile ? Math.min(100, (profile.treats / nextUpgrade.cost) * 100) : 0;

  if (loading) {
    return (
      <main className="neo-shell grid place-items-center">
        <div className="glass-panel rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white">
          <Sparkles className="mr-2 inline h-5 w-5 animate-pulse" />
          Chargement du squish
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="neo-shell">
        <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-center gap-8 px-5 py-8 lg:grid-cols-[1fr_430px]">
          <div className="space-y-7">
            <p className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
              <Cat className="h-4 w-4" />
              Le meilleur jeu
            </p>
            <div>
              <h1 className="max-w-4xl text-6xl font-black leading-[0.9] text-white sm:text-8xl lg:text-9xl">
                Grisou
                <span className="block bg-[linear-gradient(90deg,#65b8ff,#8df0bf,#ffd166,#ff5f3d)] bg-clip-text text-transparent">X Ronron</span>
              </h1>
            </div>
            <div className="grid max-w-3xl grid-cols-2 gap-4">
              {Object.entries(cats).map(([id, cat]) => (
                <div key={id} className="glass-panel group overflow-hidden rounded-[30px] p-3">
                  <div className="overflow-hidden rounded-[24px] bg-black/30">
                    <Image src={cat.src} alt={cat.name} width={520} height={520} className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" priority />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2 pt-3 text-sm font-black text-white">
                    <span>{cat.name}</span>
                    <span style={{ color: cat.accent }}>{cat.vibe}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="neo-button rounded-2xl px-5 py-3 text-sm font-black" href="/clicker">
                Mode clicker
              </Link>
              <Link className="danger-button rounded-2xl px-5 py-3 text-sm font-black" href="/duel">
                Mode duel
              </Link>
            </div>
          </div>

          <form onSubmit={handleStart} className="glass-panel rounded-[34px] p-5">
            <div className="rounded-[26px] border border-white/10 bg-black/46 p-5 text-white shadow-inner">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8df0bf]">Connexion</p>
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white/10 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setMessage("");
                  }}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition ${
                    authMode === "login" ? "bg-[#8df0bf] text-[#102318]" : "text-white/70"
                  }`}
                >
                  <LogIn className="h-4 w-4" />
                  Se connecter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("create");
                    setMessage("");
                  }}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition ${
                    authMode === "create" ? "bg-[#8df0bf] text-[#102318]" : "text-white/70"
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                  Creer
                </button>
              </div>
              <label htmlFor="username" className="mt-5 block text-3xl font-black leading-tight">
                {authMode === "login" ? "Retrouve ta ferme" : "Cree ta ferme"}
              </label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-5 h-14 w-full rounded-2xl border border-white/10 bg-white/92 px-4 text-xl font-black text-[#101820] outline-none ring-[#8df0bf] transition focus:ring-4"
                maxLength={18}
                placeholder="Pseudo"
                autoComplete="username"
              />
              <div className="relative mt-3">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#68706a]" />
                <input
                  id="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-white/92 px-12 text-xl font-black text-[#101820] outline-none ring-[#8df0bf] transition focus:ring-4"
                  minLength={6}
                  type="password"
                  placeholder="Mot de passe"
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                />
              </div>
              <button
                disabled={authLoading}
                className="neo-button mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 font-black disabled:cursor-wait disabled:opacity-70"
              >
                {authMode === "login" ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                {authLoading ? "Chargement..." : authMode === "login" ? "Continuer" : "Creer le compte"}
              </button>
            </div>
            <p className="soft-card mt-4 rounded-2xl px-4 py-3 text-sm font-bold text-white/70">
              {isSupabaseMisconfigured
                ? "URL Supabase incorrecte: elle doit finir par .supabase.co, pas par vercel.app."
                : isSupabaseConfigured
                  ? "Supabase actif: pseudos uniques, sauvegarde et classement."
                  : "Mode demo local: ajoute Supabase pour le multijoueur."}
            </p>
            {message && <p className="mt-3 rounded-2xl bg-[#ff5f3d]/18 px-4 py-3 text-sm font-black text-[#ffd6ca]">{message}</p>}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="neo-shell text-white">
      {Object.values(remoteCursors).map((cursor) => (
        <div
          key={cursor.id}
          className="pointer-events-none fixed z-50 rounded-full px-3 py-1 text-xs font-black text-[#171b1a] shadow-xl transition-transform duration-75"
          style={{
            left: `${cursor.x * 100}%`,
            top: `${cursor.y * 100}%`,
            backgroundColor: cursor.color,
            transform: "translate(10px, 10px)",
          }}
        >
          <MousePointer2 className="mr-1 inline h-3 w-3" />
          {cursor.username}
        </div>
      ))}
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1320px] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_370px]">
        <section className="grid min-h-0 gap-4 lg:grid-rows-[auto_minmax(0,1fr)_auto]">
          <header className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-[30px] p-4">
            <div className="min-w-0">
              <p className="eyebrow">Joueur</p>
              <h2 className="truncate text-2xl font-black sm:text-3xl">{profile.username}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link className="neo-button rounded-2xl px-4 py-2 text-sm font-black" href="/clicker">Clicker</Link>
              <Link className="danger-button rounded-2xl px-4 py-2 text-sm font-black" href="/duel">Duel</Link>
              <button title="Son" onClick={() => setSoundOn((value) => !value)} className="icon-button bg-white/10">
                {soundOn ? <Volume2 className="h-5 w-5" /> : <Music2 className="h-5 w-5" />}
              </button>
              <button title="Sauvegarder" onClick={() => saveProfile(profile, false)} className="icon-button bg-white/10">
                <Save className="h-5 w-5" />
              </button>
              <button title="Quitter" onClick={signOut} className="icon-button bg-white/10">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="grid min-h-0 gap-4 xl:grid-cols-[210px_minmax(0,1fr)]">
            <aside className="glass-panel rounded-[30px] p-3">
              <p className="eyebrow px-1">Chats</p>
              <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-1">
                {Object.entries(cats).map(([id, cat]) => (
                  <button
                    key={id}
                    title={`Choisir ${cat.name}`}
                    onClick={() => switchCat(id as CatId)}
                    className={`grid grid-cols-[64px_1fr] items-center gap-3 rounded-[22px] border p-2 text-left font-black transition xl:grid-cols-1 ${
                      profile.selected_cat === id
                        ? "border-[#8df0bf] bg-[#8df0bf]/22 shadow-[0_0_30px_rgba(141,240,191,.2)]"
                        : "border-white/10 bg-white/8 hover:-translate-y-0.5"
                    }`}
                  >
                    <Image src={cat.src} alt={cat.name} width={120} height={120} className="aspect-square w-full rounded-[17px] object-cover" />
                    <span>
                      <span className="block text-sm">{cat.name}</span>
                      <span className="block text-xs text-white/56">lvl {numberFormat.format(profile.cat_levels[id as CatId] ?? 1)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="glass-panel flex min-h-[560px] flex-col rounded-[38px] p-4 lg:h-[calc(100vh-12rem)]">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-white/10 bg-black/52 p-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8df0bf]">Croquettes</p>
                  <h2 className="text-4xl font-black leading-none sm:text-6xl">{numberFormat.format(profile.treats)}</h2>
                </div>
                <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-3">
                  <MiniStat label="clic" value={numberFormat.format(treatsPerClick)} />
                  <MiniStat label="auto" value={`${passiveGain.toFixed(1)}/s`} />
                  <MiniStat label="combo" value={`x${combo}`} />
                </div>
              </div>

              <div className="relative flex min-h-0 flex-1 items-center justify-center py-2">
                <div className="absolute h-[min(58vw,460px)] w-[min(58vw,460px)] rounded-full blur-3xl" style={{ backgroundColor: currentCat.glow }} />
                <button
                  onPointerDown={handleClick}
                  className="relative grid aspect-square w-full max-w-[470px] place-items-center rounded-full outline-none"
                  style={{ background: `radial-gradient(circle, ${currentCat.glow} 0%, rgba(255,255,255,.22) 42%, transparent 70%)` }}
                >
                  <Image
                    src={currentCat.src}
                    alt={currentCat.name}
                    width={900}
                    height={900}
                    priority
                    className={`relative z-10 w-[86%] select-none rounded-[36px] object-cover shadow-[0_24px_58px_rgba(0,0,0,.22)] ring-4 ring-white/40 transition duration-150 ${
                      pressed ? "scale-[.94] rotate-1 saturate-150" : "scale-100 hover:scale-[1.025]"
                    }`}
                    draggable={false}
                  />
                  {pops.map((pop) => (
                    <span
                      key={pop.id}
                      className="pointer-events-none absolute z-20 animate-[floatUp_780ms_cubic-bezier(.15,.9,.2,1)_forwards] rounded-full px-4 py-2 text-xl font-black text-[#171b1a] shadow-xl"
                      style={{ left: pop.x, top: pop.y, backgroundColor: pop.hue }}
                    >
                      +{numberFormat.format(pop.value)}
                    </span>
                  ))}
                </button>
              </div>

              <div className="soft-card rounded-[24px] p-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <p className="font-black">{currentCat.name} - {currentCat.vibe}</p>
                  {nextUpgrade && <p className="font-black text-white/62">Prochain: {numberFormat.format(nextUpgrade.cost)}</p>}
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/12">
                  <div className="h-full rounded-full bg-[#8df0bf] transition-all duration-300" style={{ width: `${nextProgress}%` }} />
                </div>
              </div>
            </section>
          </div>

          <footer className="grid gap-3 xl:grid-cols-[1fr_1fr]">
            <div className="glass-panel rounded-[26px] p-3">
              <p className="eyebrow">Stats</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <MiniStat label="Clics" value={numberFormat.format(profile.total_clicks)} />
                <MiniStat label="Niveaux" value={numberFormat.format(totalUpgradeLevels)} />
                <MiniStat label="Rebirths" value={numberFormat.format(profile.rebirths)} />
                <MiniStat label={`${currentCat.name} lvl`} value={numberFormat.format(activeCatLevel)} />
                <MiniStat label="Vie" value={numberFormat.format(profile.lifetime_treats)} />
                <MiniStat label={saving ? "Sync" : "Etat"} value={saving ? "save" : "ok"} />
              </div>
            </div>
            <div className="glass-panel rounded-[26px] p-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[#ff744d]" />
                <p className="eyebrow">Classement</p>
              </div>
              <div className="mt-3 grid gap-2">
                {(leaderboard.length ? leaderboard : [profile]).slice(0, 3).map((item, index) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl bg-white/8 px-3 py-2 text-sm font-black">
                    <span className="truncate">{index + 1}. {item.username}</span>
                    <span>{numberFormat.format(item.treats)}</span>
                    <span className="col-span-2 text-[11px] text-white/55">RB {numberFormat.format(item.rebirths)} - Clics {numberFormat.format(item.total_clicks)} - Vie {numberFormat.format(item.lifetime_treats)}</span>
                  </div>
                ))}
              </div>
              {message && <p className="mt-3 rounded-2xl bg-[#ff5f3d]/18 px-4 py-3 text-sm font-black text-[#ffd6ca]">{message}</p>}
            </div>
          </footer>
        </section>

        <aside className="glass-panel flex min-h-0 flex-col rounded-[30px] p-4 lg:h-[calc(100vh-2rem)]">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <p className="eyebrow">Boutique infinie</p>
            <Coins className="h-6 w-6 text-[#ff744d]" />
          </div>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-3">
              <button
                onClick={levelUpCurrentCat}
                className="group rounded-[24px] border border-[#65b8ff] bg-[#65b8ff]/14 p-3 text-left shadow-[0_0_30px_rgba(101,184,255,.14)] transition active:translate-y-1"
              >
                <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#65b8ff] text-[#071018]">
                    <Cat className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-base font-black">Level up {currentCat.name}</span>
                    <span className="block text-xs font-bold text-white/58">lvl {activeCatLevel} - +12% avec ce chat</span>
                  </span>
                  <span className="rounded-2xl bg-black/54 px-3 py-2 text-sm font-black text-white">
                    {numberFormat.format(catLevelCost(activeCatLevel, profile.rebirths))}
                  </span>
                </div>
              </button>
              <button
                onClick={rebirth}
                className="group rounded-[24px] border border-[#ffd166] bg-[#ffd166]/14 p-3 text-left shadow-[0_0_30px_rgba(255,209,102,.14)] transition active:translate-y-1"
              >
                <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ffd166] text-[#071018]">
                    <Flame className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-base font-black">Rebirth</span>
                    <span className="block text-xs font-bold text-white/58">reset upgrades - +35% permanent</span>
                  </span>
                  <span className="rounded-2xl bg-black/54 px-3 py-2 text-sm font-black text-white">
                    {numberFormat.format(rebirthCost(profile.rebirths))}
                  </span>
                </div>
              </button>
              {upgrades.map((upgrade) => {
                const level = profile.upgrades[upgrade.id] ?? 0;
                const cost = upgradeCost(upgrade, level);
                const Icon = upgrade.icon;
                const affordable = profile.treats >= cost;
                const progress = Math.min(100, (profile.treats / cost) * 100);
                return (
                  <button
                    key={upgrade.id}
                    onClick={() => buyUpgrade(upgrade)}
                    className={`group rounded-[24px] border p-3 text-left transition ${
                      affordable
                        ? "border-[#8df0bf] bg-white/16 shadow-[0_0_30px_rgba(141,240,191,.18)] active:translate-y-1"
                        : "border-white/10 bg-white/8"
                    }`}
                  >
                    <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ backgroundColor: upgrade.tint }}>
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-base font-black">{upgrade.name}</span>
                        <span className="block text-xs font-bold text-[#68706a]">
                          niv. {level} - {upgrade.effect(level)}
                        </span>
                      </span>
                      <span className="rounded-2xl bg-black/54 px-3 py-2 text-sm font-black text-white">{numberFormat.format(cost)}</span>
                    </div>
                    <p className="mt-3 text-xs font-bold text-white/58">{upgrade.description}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/12">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: upgrade.tint }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {!isSupabaseConfigured && (
            <p className="soft-card mt-3 shrink-0 rounded-2xl px-4 py-3 text-xs font-bold text-white/60">
              Le classement global apparaitra avec Supabase.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{label}</p>
      <p className="truncate text-base font-black text-white">{value}</p>
    </div>
  );
}
