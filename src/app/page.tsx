"use client";

import {
  Cat,
  Gem,
  Hand,
  LogOut,
  MousePointer2,
  Music2,
  PawPrint,
  Save,
  Sparkles,
  Trophy,
  Volume2,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatId, GameProfile, isSupabaseConfigured, supabase } from "@/lib/supabase";

type UpgradeId = "paw" | "cushion" | "gloss" | "snack";

type Upgrade = {
  id: UpgradeId;
  name: string;
  icon: typeof PawPrint;
  description: string;
  baseCost: number;
  growth: number;
  effect: (level: number) => string;
};

type Pop = {
  id: number;
  value: number;
  x: number;
  y: number;
};

const cats: Record<CatId, { name: string; src: string; accent: string; vibe: string }> = {
  grisou: {
    name: "Grisou",
    src: "/cats/grisou.jpg",
    accent: "#6fb7ff",
    vibe: "moelleux cosmique",
  },
  ronron: {
    name: "Ronron",
    src: "/cats/ronron.jpg",
    accent: "#ff8d6b",
    vibe: "squeechie solaire",
  },
};

const upgrades: Upgrade[] = [
  {
    id: "paw",
    name: "Patte turbo",
    icon: PawPrint,
    description: "Chaque clic donne plus de croquettes.",
    baseCost: 25,
    growth: 1.22,
    effect: (level) => `+${level + 1} par clic`,
  },
  {
    id: "cushion",
    name: "Coussin aimant",
    icon: Sparkles,
    description: "Gagne automatiquement pendant que tu admires le chat.",
    baseCost: 90,
    growth: 1.28,
    effect: (level) => `+${level * 0.8 + 0.8}/s`,
  },
  {
    id: "gloss",
    name: "Brillance squeechie",
    icon: Gem,
    description: "Multiplie tous les gains, clics et automatique.",
    baseCost: 220,
    growth: 1.34,
    effect: (level) => `x${(1 + (level + 1) * 0.15).toFixed(2)}`,
  },
  {
    id: "snack",
    name: "Snack premium",
    icon: Zap,
    description: "Boost instantane et achats plus satisfaisants.",
    baseCost: 650,
    growth: 1.42,
    effect: (level) => `+${(level + 1) * 8}%`,
  },
];

const emptyUpgrades: Record<UpgradeId, number> = {
  paw: 0,
  cushion: 0,
  gloss: 0,
  snack: 0,
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
  };
}

function upgradeCost(upgrade: Upgrade, level: number) {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.growth, level));
}

function normalizeProfile(profile: GameProfile): GameProfile {
  const levels = { ...emptyUpgrades, ...(profile.upgrades ?? {}) };
  return {
    ...profile,
    selected_cat: profile.selected_cat ?? "grisou",
    treats: Number(profile.treats ?? 0),
    total_clicks: Number(profile.total_clicks ?? 0),
    click_power: Number(profile.click_power ?? 1),
    auto_rate: Number(profile.auto_rate ?? 0),
    multiplier: Number(profile.multiplier ?? 1),
    upgrades: levels,
  };
}

export default function Home() {
  const [profile, setProfile] = useState<GameProfile | null>(null);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [pops, setPops] = useState<Pop[]>([]);
  const [leaderboard, setLeaderboard] = useState<GameProfile[]>([]);
  const [pressed, setPressed] = useState(false);
  const popId = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentCat = profile ? cats[profile.selected_cat] : cats.grisou;
  const treatsPerClick = profile ? profile.click_power * profile.multiplier : 1;
  const passiveGain = profile ? profile.auto_rate * profile.multiplier : 0;

  const playTone = useCallback(
    (kind: "click" | "buy" | "error" | "save") => {
      if (!soundOn || typeof window === "undefined") return;
      const ctx = audio.current ?? new AudioContext();
      audio.current = ctx;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const freq = { click: 520, buy: 740, error: 150, save: 620 }[kind];
      oscillator.type = kind === "buy" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(freq, now);
      oscillator.frequency.exponentialRampToValueAtTime(freq * 1.35, now + 0.08);
      gain.gain.setValueAtTime(kind === "error" ? 0.05 : 0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.17);
    },
    [soundOn],
  );

  const loadLeaderboard = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
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
      if (data) setProfile(normalizeProfile(data as GameProfile));
      setLoading(false);
      await loadLeaderboard();
    }

    loadProfile();
  }, [loadLeaderboard]);

  const saveProfile = useCallback(
    async (nextProfile: GameProfile, quiet = true) => {
      if (!supabase) {
        window.localStorage.setItem(demoKey, JSON.stringify(nextProfile));
        return;
      }

      setSaving(true);
      const { error } = await supabase.from("profiles").upsert({
        ...nextProfile,
        updated_at: new Date().toISOString(),
      });
      setSaving(false);
      if (error) {
        setMessage("La sauvegarde Supabase a refuse la mise a jour.");
        playTone("error");
        return;
      }
      if (!quiet) {
        setMessage("Sauvegarde ok.");
        playTone("save");
      }
      await loadLeaderboard();
    },
    [loadLeaderboard, playTone],
  );

  const queueSave = useCallback(
    (nextProfile: GameProfile) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveProfile(nextProfile), 500);
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
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [passiveGain, profile, updateProfile]);

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = username.trim().replace(/\s+/g, " ");
    if (clean.length < 3 || clean.length > 18) {
      setMessage("Pseudo entre 3 et 18 caracteres.");
      playTone("error");
      return;
    }

    setLoading(true);
    setMessage("");

    if (!supabase) {
      const next = freshProfile(clean);
      setProfile(next);
      window.localStorage.setItem(demoKey, JSON.stringify(next));
      setLoading(false);
      return;
    }

    const auth = await supabase.auth.signInAnonymously();
    if (auth.error || !auth.data.user) {
      setLoading(false);
      setMessage("Active les connexions anonymes dans Supabase Auth.");
      playTone("error");
      return;
    }

    const next = freshProfile(clean, auth.data.user.id);
    const { error } = await supabase.from("profiles").insert(next);
    setLoading(false);
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
    const bonus = 1 + (profile.upgrades.snack ?? 0) * 0.08;
    const value = treatsPerClick * bonus;
    setPressed(true);
    window.setTimeout(() => setPressed(false), 120);
    setPops((current) => [...current, { id: popId.current++, value, x, y }].slice(-12));
    window.setTimeout(() => setPops((current) => current.slice(1)), 700);
    updateProfile((current) => ({
      ...current,
      treats: current.treats + value,
      total_clicks: current.total_clicks + 1,
    }));
    playTone("click");
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
        click_power: 1 + levels.paw,
        auto_rate: levels.cushion * 0.8,
        multiplier: 1 + levels.gloss * 0.15,
      };
    });
    setMessage(`${upgrade.name} ameliore.`);
    playTone("buy");
  }

  function switchCat(catId: CatId) {
    updateProfile((current) => ({ ...current, selected_cat: catId }));
    playTone("buy");
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    window.localStorage.removeItem(demoKey);
    setProfile(null);
    setUsername("");
    setMessage("");
  }

  const bestUpgrade = useMemo(() => {
    if (!profile) return null;
    return upgrades
      .map((upgrade) => ({
        upgrade,
        cost: upgradeCost(upgrade, profile.upgrades[upgrade.id] ?? 0),
      }))
      .sort((a, b) => a.cost - b.cost)[0];
  }, [profile]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f3ea] text-[#20231f]">
        <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em]">
          <Sparkles className="h-5 w-5 animate-pulse" />
          Chargement du squish
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#f6f3ea] text-[#20231f]">
        <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-8 md:grid-cols-[1fr_420px]">
          <div className="space-y-8">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#20231f] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">
                <Cat className="h-4 w-4" />
                Farm clicker
              </p>
              <h1 className="max-w-3xl text-5xl font-black leading-none text-[#20231f] sm:text-7xl">
                Squeechie Cats
              </h1>
            </div>
            <div className="grid max-w-2xl grid-cols-2 gap-4">
              {Object.entries(cats).map(([id, cat]) => (
                <div key={id} className="overflow-hidden rounded-lg border-2 border-[#20231f] bg-white shadow-[8px_8px_0_#20231f]">
                  <Image src={cat.src} alt={cat.name} width={420} height={420} className="aspect-square w-full object-cover" priority />
                  <div className="flex items-center justify-between px-4 py-3 text-sm font-black">
                    <span>{cat.name}</span>
                    <span style={{ color: cat.accent }}>{cat.vibe}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleStart} className="rounded-lg border-2 border-[#20231f] bg-white p-5 shadow-[8px_8px_0_#20231f]">
            <label htmlFor="username" className="text-sm font-black uppercase tracking-[0.14em]">
              Ton pseudo unique
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-3 h-14 w-full rounded-md border-2 border-[#20231f] bg-[#fffaf0] px-4 text-xl font-black outline-none focus:bg-white"
              maxLength={18}
              placeholder="ex: MinouBoss"
            />
            <button className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#35c982] px-4 font-black text-[#102318] transition hover:-translate-y-0.5">
              <MousePointer2 className="h-5 w-5" />
              Entrer
            </button>
            <p className="mt-4 text-sm font-semibold text-[#686a61]">
              {isSupabaseConfigured
                ? "Supabase actif: pseudo unique, sauvegarde et classement."
                : "Mode demo local: ajoute tes variables Supabase pour la version Vercel."}
            </p>
            {message && <p className="mt-3 text-sm font-black text-[#d94b37]">{message}</p>}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f3ea] text-[#20231f]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-4 lg:grid lg:grid-cols-[280px_1fr_340px]">
        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border-2 border-[#20231f] bg-white p-4 shadow-[6px_6px_0_#20231f]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#686a61]">Joueur</p>
                <h2 className="truncate text-2xl font-black">{profile.username}</h2>
              </div>
              <button title="Quitter" onClick={signOut} className="grid h-10 w-10 place-items-center rounded-md border-2 border-[#20231f] bg-[#fff3cf]">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Object.entries(cats).map(([id, cat]) => (
                <button
                  key={id}
                  title={`Choisir ${cat.name}`}
                  onClick={() => switchCat(id as CatId)}
                  className={`rounded-md border-2 p-2 text-left font-black transition ${
                    profile.selected_cat === id ? "border-[#20231f] bg-[#35c982]" : "border-[#d7d0bd] bg-[#fffaf0]"
                  }`}
                >
                  <Image src={cat.src} alt={cat.name} width={88} height={88} className="aspect-square w-full rounded object-cover" />
                  <span className="mt-2 block text-sm">{cat.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border-2 border-[#20231f] bg-white p-4 shadow-[6px_6px_0_#20231f]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#686a61]">Stats</p>
            <div className="mt-3 grid gap-2 text-sm font-bold">
              <div className="flex justify-between"><span>Clic</span><span>{numberFormat.format(treatsPerClick)}</span></div>
              <div className="flex justify-between"><span>Auto</span><span>{passiveGain.toFixed(1)}/s</span></div>
              <div className="flex justify-between"><span>Total clics</span><span>{numberFormat.format(profile.total_clicks)}</span></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button title="Son" onClick={() => setSoundOn((value) => !value)} className="grid h-10 w-10 place-items-center rounded-md border-2 border-[#20231f] bg-[#e6f6ff]">
                {soundOn ? <Volume2 className="h-5 w-5" /> : <Music2 className="h-5 w-5" />}
              </button>
              <button title="Sauvegarder" onClick={() => saveProfile(profile, false)} className="grid h-10 w-10 place-items-center rounded-md border-2 border-[#20231f] bg-[#fce18a]">
                <Save className="h-5 w-5" />
              </button>
              <div className="flex flex-1 items-center justify-end text-xs font-black uppercase tracking-[0.12em] text-[#686a61]">
                {saving ? "save..." : "ok"}
              </div>
            </div>
          </section>
        </aside>

        <section className="flex min-h-[560px] flex-col items-center justify-center rounded-lg border-2 border-[#20231f] bg-[#fffaf0] p-4 shadow-[8px_8px_0_#20231f]">
          <div className="mb-4 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#686a61]">Croquettes</p>
            <h2 className="text-5xl font-black sm:text-7xl">{numberFormat.format(profile.treats)}</h2>
          </div>

          <button
            onPointerDown={handleClick}
            className="relative grid aspect-square w-full max-w-[520px] place-items-center rounded-full outline-none"
            style={{ background: `radial-gradient(circle, ${currentCat.accent}55 0%, transparent 64%)` }}
          >
            <Image
              src={currentCat.src}
              alt={currentCat.name}
              width={760}
              height={760}
              priority
              className={`w-full select-none drop-shadow-[0_18px_0_rgba(32,35,31,0.18)] transition duration-150 ${
                pressed ? "scale-95 rotate-1" : "scale-100 hover:scale-[1.03]"
              }`}
              draggable={false}
            />
            {pops.map((pop) => (
              <span
                key={pop.id}
                className="pointer-events-none absolute animate-[floatUp_700ms_ease-out_forwards] rounded-full bg-[#20231f] px-3 py-1 text-lg font-black text-white"
                style={{ left: pop.x, top: pop.y }}
              >
                +{numberFormat.format(pop.value)}
              </span>
            ))}
          </button>

          <div className="mt-3 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm">
            <Hand className="h-4 w-4" />
            {currentCat.name} est en mode {currentCat.vibe}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border-2 border-[#20231f] bg-white p-4 shadow-[6px_6px_0_#20231f]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#686a61]">Boutique</p>
              {bestUpgrade && <span className="text-xs font-black">Prochain: {numberFormat.format(bestUpgrade.cost)}</span>}
            </div>
            <div className="mt-3 grid gap-3">
              {upgrades.map((upgrade) => {
                const level = profile.upgrades[upgrade.id] ?? 0;
                const cost = upgradeCost(upgrade, level);
                const Icon = upgrade.icon;
                const affordable = profile.treats >= cost;
                return (
                  <button
                    key={upgrade.id}
                    onClick={() => buyUpgrade(upgrade)}
                    className={`grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-md border-2 p-3 text-left transition ${
                      affordable ? "border-[#20231f] bg-[#fce18a] hover:-translate-y-0.5" : "border-[#d7d0bd] bg-[#fffaf0] opacity-75"
                    }`}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-md bg-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-black">{upgrade.name} niv. {level}</span>
                      <span className="block text-xs font-semibold text-[#686a61]">{upgrade.effect(level)} · {upgrade.description}</span>
                    </span>
                    <span className="font-black">{numberFormat.format(cost)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border-2 border-[#20231f] bg-white p-4 shadow-[6px_6px_0_#20231f]">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#686a61]">Classement</p>
            </div>
            <div className="mt-3 grid gap-2">
              {(leaderboard.length ? leaderboard : [profile]).map((item, index) => (
                <div key={item.id} className="flex items-center justify-between rounded-md bg-[#fffaf0] px-3 py-2 text-sm font-black">
                  <span className="truncate">{index + 1}. {item.username}</span>
                  <span>{numberFormat.format(item.treats)}</span>
                </div>
              ))}
            </div>
            {message && <p className="mt-3 text-sm font-black text-[#d94b37]">{message}</p>}
            {!isSupabaseConfigured && <p className="mt-3 text-xs font-bold text-[#686a61]">Le classement global apparaitra avec Supabase.</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
