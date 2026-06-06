"use client";

import {
  ArrowLeft,
  Copy,
  Crown,
  Flame,
  Gamepad2,
  Keyboard,
  LinkIcon,
  LogOut,
  Music2,
  MousePointer2,
  Play,
  ShieldAlert,
  Swords,
  Target,
  Trophy,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { GameProfile, isSupabaseConfigured, supabase } from "@/lib/supabase";

type LobbyStatus = "waiting" | "active" | "finished" | "aborted";
type PlayerStatus = "online" | "disconnected" | "left";
type DuelEventType = "phrase" | "target" | "spam" | "hold" | "bait";

type Lobby = {
  id: string;
  code: string;
  owner_id: string;
  status: LobbyStatus;
  winner_id: string | null;
  started_at: string | null;
  ends_at: string | null;
  current_track: string | null;
};

type DuelPlayer = {
  id: string;
  lobby_id: string;
  user_id: string;
  username: string;
  score: number;
  hp: number;
  status: PlayerStatus;
  last_seen: string;
};

type DuelEvent = {
  id: string;
  lobby_id: string;
  type: DuelEventType;
  prompt: string;
  payload: Record<string, number | string>;
  points: number;
  expires_at: string;
  created_at: string;
};

const tracks = Array.from({ length: 11 }, (_, index) => `/music/track-${index + 1}.mp3`);
const phrasePrompts = ["Grisou le goat", "Ronron le goat", "miaou turbo", "squeechie supreme"];
const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function randomTrack() {
  return tracks[Math.floor(Math.random() * tracks.length)];
}

function makeEvent(lobbyId: string): Omit<DuelEvent, "id" | "created_at"> {
  const types: DuelEventType[] = ["phrase", "target", "spam", "hold", "bait"];
  const type = types[Math.floor(Math.random() * types.length)];
  const expires = new Date(Date.now() + 7000).toISOString();
  if (type === "phrase") {
    const phrase = phrasePrompts[Math.floor(Math.random() * phrasePrompts.length)];
    return { lobby_id: lobbyId, type, prompt: `Ecris: ${phrase}`, payload: { phrase }, points: 14, expires_at: expires };
  }
  if (type === "target") {
    return {
      lobby_id: lobbyId,
      type,
      prompt: "Clique la zone rouge",
      payload: { x: 18 + Math.random() * 64, y: 24 + Math.random() * 52 },
      points: 12,
      expires_at: expires,
    };
  }
  if (type === "spam") {
    return { lobby_id: lobbyId, type, prompt: "Rafale: 12 clics", payload: { needed: 12 }, points: 16, expires_at: expires };
  }
  if (type === "hold") {
    return { lobby_id: lobbyId, type, prompt: "Maintiens 1 seconde", payload: { ms: 1000 }, points: 13, expires_at: expires };
  }
  return { lobby_id: lobbyId, type, prompt: "Piege: ne clique pas 3 secondes", payload: { seconds: 3 }, points: 15, expires_at: expires };
}

export default function DuelPage() {
  const [profile, setProfile] = useState<GameProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<DuelPlayer[]>([]);
  const [events, setEvents] = useState<DuelEvent[]>([]);
  const [typed, setTyped] = useState("");
  const [spamCount, setSpamCount] = useState(0);
  const [volume, setVolume] = useState(0.4);
  const [timeLeft, setTimeLeft] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const eventTimer = useRef<number | null>(null);

  const me = players.find((player) => player.user_id === profile?.id) ?? null;
  const opponent = players.find((player) => player.user_id !== profile?.id) ?? null;
  const isOwner = Boolean(profile && lobby?.owner_id === profile.id);
  const activeEvent = events
    .filter((event) => new Date(event.expires_at).getTime() > now)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const myHp = me?.hp ?? 100;
  const opponentHp = opponent?.hp ?? 100;

  const loadLobbyState = useCallback(async (lobbyId: string) => {
    if (!supabase) return;
    const [{ data: lobbyData }, { data: playerData }, { data: eventData }] = await Promise.all([
      supabase.from("duel_lobbies").select("*").eq("id", lobbyId).single(),
      supabase.from("duel_players").select("*").eq("lobby_id", lobbyId).order("created_at", { ascending: true }),
      supabase.from("duel_events").select("*").eq("lobby_id", lobbyId).order("created_at", { ascending: false }).limit(10),
    ]);
    if (lobbyData) setLobby(lobbyData as Lobby);
    if (playerData) setPlayers(playerData as DuelPlayer[]);
    if (eventData) setEvents(eventData as DuelEvent[]);
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (data) setProfile(data as GameProfile);
      setLoading(false);
    }
    loadProfile();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !lobby?.id) return;
    const channel = client
      .channel(`duel:${lobby.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duel_lobbies", filter: `id=eq.${lobby.id}` }, (payload) => {
        if (payload.new) setLobby(payload.new as Lobby);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "duel_players", filter: `lobby_id=eq.${lobby.id}` }, () => {
        loadLobbyState(lobby.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "duel_events", filter: `lobby_id=eq.${lobby.id}` }, () => {
        loadLobbyState(lobby.id);
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [lobby?.id, loadLobbyState]);

  useEffect(() => {
    if (!supabase || !lobby?.id || !profile) return;
    const client = supabase;
    const activeLobby = lobby;
    const activeProfile = profile;
    const heartbeat = window.setInterval(() => {
      client
        .from("duel_players")
        .update({ status: document.hidden ? "disconnected" : "online", last_seen: new Date().toISOString() })
        .eq("lobby_id", activeLobby.id)
        .eq("user_id", activeProfile.id);
    }, 2000);

    function markLeaving() {
      if (activeLobby.status === "waiting") {
        client.from("duel_players").delete().eq("lobby_id", activeLobby.id).eq("user_id", activeProfile.id);
        if (isOwner) client.from("duel_lobbies").update({ status: "aborted" }).eq("id", activeLobby.id);
      } else if (activeLobby.status === "active") {
        client
          .from("duel_players")
          .update({ status: "disconnected", last_seen: new Date().toISOString() })
          .eq("lobby_id", activeLobby.id)
          .eq("user_id", activeProfile.id);
      }
    }

    window.addEventListener("pagehide", markLeaving);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", markLeaving);
    };
  }, [lobby, profile, isOwner]);

  useEffect(() => {
    if (!lobby?.ends_at || lobby.status !== "active") return;
    const client = supabase;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((new Date(lobby.ends_at!).getTime() - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0 && client && isOwner) {
        const winner = [...players].sort((a, b) => b.score - a.score)[0];
        client.from("duel_lobbies").update({ status: "finished", winner_id: winner?.user_id ?? null }).eq("id", lobby.id);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [isOwner, lobby, players]);

  useEffect(() => {
    const client = supabase;
    if (!client || !lobby || lobby.status !== "active" || !isOwner) return;
    if (eventTimer.current) window.clearInterval(eventTimer.current);
    eventTimer.current = window.setInterval(() => {
      client.from("duel_events").insert(makeEvent(lobby.id));
    }, 5200);
    return () => {
      if (eventTimer.current) window.clearInterval(eventTimer.current);
    };
  }, [isOwner, lobby]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !lobby?.current_track || lobby.status !== "active") return;
    audio.src = lobby.current_track;
    audio.volume = volume;
    audio.play().catch(() => setMessage("Clique une fois sur la page pour lancer la musique."));
  }, [lobby?.current_track, lobby?.status, volume]);

  async function createLobby() {
    if (!supabase || !profile) return;
    const code = randomCode();
    const { data, error } = await supabase
      .from("duel_lobbies")
      .insert({ code, owner_id: profile.id, status: "waiting" })
      .select()
      .single();
    if (error || !data) {
      setMessage("Impossible de creer le lobby.");
      return;
    }
    await supabase.from("duel_players").insert({
      lobby_id: data.id,
      user_id: profile.id,
      username: profile.username,
    });
    await loadLobbyState(data.id);
  }

  async function joinLobby(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !profile) return;
    const code = joinCode.trim().toUpperCase();
    const { data } = await supabase.from("duel_lobbies").select("*").eq("code", code).eq("status", "waiting").single();
    if (!data) {
      setMessage("Lobby introuvable ou deja lance.");
      return;
    }
    const { data: currentPlayers } = await supabase.from("duel_players").select("id").eq("lobby_id", data.id);
    if ((currentPlayers?.length ?? 0) >= 2) {
      setMessage("Ce lobby est deja plein.");
      return;
    }
    await supabase.from("duel_players").upsert({
      lobby_id: data.id,
      user_id: profile.id,
      username: profile.username,
      status: "online",
      last_seen: new Date().toISOString(),
    });
    await loadLobbyState(data.id);
  }

  async function leaveLobby() {
    if (!supabase || !lobby || !profile) return;
    await supabase.from("duel_players").delete().eq("lobby_id", lobby.id).eq("user_id", profile.id);
    if (isOwner) await supabase.from("duel_lobbies").update({ status: "aborted" }).eq("id", lobby.id);
    setLobby(null);
    setPlayers([]);
    setEvents([]);
  }

  async function startMatch() {
    if (!supabase || !lobby || players.length !== 2 || !isOwner) return;
    const now = Date.now();
    await supabase
      .from("duel_lobbies")
      .update({
        status: "active",
        started_at: new Date(now).toISOString(),
        ends_at: new Date(now + 60000).toISOString(),
        current_track: randomTrack(),
      })
      .eq("id", lobby.id);
    await supabase.from("duel_events").insert(makeEvent(lobby.id));
  }

  async function score(points: number) {
    if (!supabase || !lobby || !me || lobby.status !== "active") return;
    const nextScore = me.score + points;
    await supabase.from("duel_players").update({ score: nextScore }).eq("id", me.id);
    if (opponent) {
      await supabase.from("duel_players").update({ hp: Math.max(0, opponent.hp - points * 0.8) }).eq("id", opponent.id);
    }
  }

  function baseClick() {
    score(1);
  }

  function completeEvent() {
    if (!activeEvent) return;
    score(activeEvent.points);
    setTyped("");
    setSpamCount(0);
    setEvents((current) => current.filter((event) => event.id !== activeEvent.id));
  }

  function handleTargetClick(x: number, y: number) {
    if (!activeEvent || activeEvent.type !== "target") return;
    const targetX = Number(activeEvent.payload.x);
    const targetY = Number(activeEvent.payload.y);
    if (Math.abs(x - targetX) < 8 && Math.abs(y - targetY) < 8) completeEvent();
  }

  const winnerName = lobby?.winner_id
    ? players.find((player) => player.user_id === lobby.winner_id)?.username ?? "Vainqueur"
    : null;

  if (loading) {
    return <main className="duel-shell grid place-items-center font-black uppercase tracking-[0.18em]">Chargement du duel...</main>;
  }

  if (!isSupabaseConfigured || !profile) {
    return (
      <main className="duel-shell px-5 py-6 text-white">
        <section className="relative z-10 mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="relative overflow-hidden rounded-[42px] border border-[#ff5f3d]/22 bg-black/22 p-8 shadow-2xl">
            <div className="duel-active-fx absolute inset-0 opacity-70" />
            <span className="combat-bolt left-[-12rem] top-[26%]" />
            <span className="combat-bolt left-[-18rem] top-[62%]" />
            <div className="relative z-10">
              <p className="text-sm font-black uppercase tracking-[0.26em] text-[#ffd166]">Mode duel</p>
              <h1 className="mt-4 max-w-3xl text-6xl font-black leading-none sm:text-8xl">
                Ronron
                <span className="block bg-[linear-gradient(90deg,#ff5f3d,#ffd166,#65b8ff)] bg-clip-text text-transparent">Kombat</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg font-bold text-white/68">
                Une arena 1v1 avec PV, events surprise, musique et effets plein ecran.
              </p>
            </div>
          </div>
          <section className="glass-panel rounded-[34px] p-6 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-[#ff744d]" />
            <h2 className="mt-4 text-3xl font-black">Connexion requise</h2>
            <p className="mt-3 text-sm font-bold text-white/70">Connecte-toi dans le clicker avec ton pseudo et ton mot de passe avant de lancer un duel.</p>
            <Link className="neo-button mt-5 inline-flex rounded-2xl px-5 py-3 font-black" href="/clicker">
              Aller au clicker
            </Link>
          </section>
        </section>
      </main>
    );
  }

  if (!lobby) {
    return (
      <main className="duel-shell px-5 py-6">
        <div className="relative z-10 mx-auto max-w-6xl">
          <Link className="glass-panel inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-black" href="/clicker">
            <ArrowLeft className="h-4 w-4" />
            Clicker
          </Link>
          <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <div className="glass-panel relative overflow-hidden rounded-[38px] p-7">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,95,61,.32),transparent_32%),radial-gradient(circle_at_80%_30%,rgba(101,184,255,.24),transparent_30%)]" />
              <div className="relative">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#ffd166]">Mode duel</p>
              <h1 className="mt-4 text-6xl font-black leading-none sm:text-8xl">Ronron Kombat</h1>
              <p className="mt-5 max-w-2xl text-lg font-bold text-white/72">
                Lobby a 2 joueurs, PV en haut, events surprise, musique aleatoire et stats en realtime.
              </p>
              <button onClick={createLobby} className="danger-button mt-7 inline-flex h-14 items-center gap-2 rounded-2xl px-6 font-black">
                <Gamepad2 className="h-5 w-5" />
                Creer un lobby
              </button>
              </div>
            </div>
            <form onSubmit={joinLobby} className="glass-panel rounded-[36px] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#8df0bf]">Rejoindre</p>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                maxLength={6}
                placeholder="CODE"
                className="mt-5 h-16 w-full rounded-2xl bg-white px-5 text-center text-3xl font-black uppercase tracking-[0.18em] text-[#171b1a] outline-none"
              />
              <button className="neo-button mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-black">
                <LinkIcon className="h-5 w-5" />
                Rejoindre
              </button>
              {message && <p className="mt-4 rounded-2xl bg-[#ff744d]/20 px-4 py-3 text-sm font-black text-[#ffd6ca]">{message}</p>}
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="duel-shell text-white">
      <audio
        ref={audioRef}
        onEnded={() => {
          const audio = audioRef.current;
          if (!audio) return;
          audio.src = randomTrack();
          audio.play().catch(() => undefined);
        }}
      />
      <section className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4">
        <div className="glass-panel grid gap-3 rounded-[30px] p-4 lg:grid-cols-[1fr_auto_1fr]">
          <FighterBar player={me} hp={myHp} align="left" />
          <div className="grid place-items-center rounded-3xl bg-[linear-gradient(135deg,#ffd166,#ff5f3d)] px-8 py-3 text-center text-[#171b1a] shadow-[0_0_60px_rgba(255,95,61,.35)]">
            <p className="text-xs font-black uppercase tracking-[0.2em]">Duel</p>
            <p className="text-5xl font-black">{lobby.status === "active" ? timeLeft : "VS"}</p>
          </div>
          <FighterBar player={opponent} hp={opponentHp} align="right" />
        </div>

        <div className="glass-panel mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-white px-4 py-2 font-black text-[#171b1a]">Code: {lobby.code}</span>
            <button onClick={() => navigator.clipboard.writeText(lobby.code)} className="rounded-2xl bg-white/10 p-3">
              <Copy className="h-5 w-5" />
            </button>
            {isOwner && <span className="inline-flex items-center gap-2 text-sm font-black text-[#ffd166]"><Crown className="h-4 w-4" /> Owner</span>}
          </div>
          <div className="flex items-center gap-3">
            <Music2 className="h-5 w-5" />
            <input min={0} max={1} step={0.01} type="range" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
            <Volume2 className="h-5 w-5" />
            <button onClick={leaveLobby} className="danger-button rounded-2xl px-4 py-2 font-black">
              <LogOut className="mr-2 inline h-4 w-4" />
              Quitter
            </button>
          </div>
        </div>

        {lobby.status === "waiting" && (
          <section className="glass-panel mt-5 grid flex-1 place-items-center rounded-[38px] p-6 text-center">
            <div>
              <Swords className="mx-auto h-16 w-16 text-[#ff744d]" />
              <h1 className="mt-4 text-5xl font-black">En attente du 2e joueur</h1>
              <p className="mt-3 font-bold text-white/68">{players.length}/2 joueurs connectes. Si un joueur refresh en attente, il quitte le lobby.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {players.map((player) => (
                  <span key={player.id} className="rounded-2xl bg-white px-5 py-3 font-black text-[#171b1a]">{player.username}</span>
                ))}
              </div>
              {isOwner && (
                <button
                  disabled={players.length !== 2}
                  onClick={startMatch}
                  className="neo-button mt-7 inline-flex h-14 items-center gap-2 rounded-2xl px-6 font-black disabled:opacity-40"
                >
                  <Play className="h-5 w-5" />
                  Lancer le duel
                </button>
              )}
            </div>
          </section>
        )}

        {lobby.status === "active" && (
          <section
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              handleTargetClick(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
            }}
            className={`duel-active-fx relative mt-5 flex flex-1 cursor-crosshair overflow-hidden rounded-[40px] border border-[#ff744d]/30 bg-[#0b060a] p-5 shadow-2xl shadow-[#ff5f3d]/18 ${activeEvent ? "animate-[arenaShake_180ms_linear_infinite]" : ""}`}
          >
            <span className="combat-bolt left-[-12rem] top-[18%]" />
            <span className="combat-bolt left-[-18rem] top-[55%]" />
            <span className="combat-bolt left-[-16rem] top-[78%]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,95,61,.16),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(101,184,255,.18),transparent_26%)]" />
            <div className="absolute inset-0 animate-pulse bg-[#ff744d]/8 mix-blend-screen" />
            {activeEvent?.type === "target" && (
              <button
                className="absolute z-20 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#ff744d] text-[#171b1a] shadow-[0_0_80px_#ff744d]"
                style={{ left: `${activeEvent.payload.x}%`, top: `${activeEvent.payload.y}%` }}
              >
                <Target className="h-10 w-10" />
              </button>
            )}
            <div className="relative z-10 m-auto grid w-full max-w-3xl gap-5 text-center">
              <button onClick={baseClick} className="neo-button mx-auto grid h-56 w-56 place-items-center rounded-full text-[#171b1a] active:translate-y-2">
                <MousePointer2 className="h-20 w-20" />
                <span className="text-2xl font-black">CLIQUE</span>
              </button>
              {activeEvent && (
                <div className="glass-panel rounded-[30px] p-5">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-[#ffd166]">Event</p>
                  <h2 className="mt-2 text-3xl font-black">{activeEvent.prompt}</h2>
                  {activeEvent.type === "phrase" && (
                    <input
                      value={typed}
                      onChange={(event) => {
                        setTyped(event.target.value);
                        if (event.target.value.trim() === activeEvent.payload.phrase) completeEvent();
                      }}
                      className="mt-4 h-14 w-full rounded-2xl bg-white px-4 text-center text-xl font-black text-[#171b1a] outline-none"
                      placeholder="Tape ici"
                    />
                  )}
                  {activeEvent.type === "spam" && (
                    <button
                      onClick={() => {
                        const next = spamCount + 1;
                        setSpamCount(next);
                        if (next >= Number(activeEvent.payload.needed)) completeEvent();
                      }}
                      className="mt-4 rounded-2xl bg-[#ffd166] px-6 py-3 font-black text-[#171b1a]"
                    >
                      Rafale {spamCount}/{activeEvent.payload.needed}
                    </button>
                  )}
                  {activeEvent.type === "hold" && (
                    <button
                      onPointerDown={() => {
                        holdTimer.current = setTimeout(completeEvent, Number(activeEvent.payload.ms));
                      }}
                      onPointerUp={() => {
                        if (holdTimer.current) clearTimeout(holdTimer.current);
                      }}
                      className="mt-4 rounded-2xl bg-[#69d6ff] px-6 py-3 font-black text-[#171b1a]"
                    >
                      Maintenir
                    </button>
                  )}
                  {activeEvent.type === "bait" && (
                    <div className="mt-4 rounded-2xl bg-[#8df0bf] px-6 py-3 font-black text-[#171b1a]">
                      <Keyboard className="mr-2 inline h-5 w-5" />
                      Respire. Ne clique pas.
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {(lobby.status === "finished" || lobby.status === "aborted") && (
          <section className="glass-panel mt-5 grid flex-1 place-items-center rounded-[36px] p-6 text-center">
            <Trophy className="mx-auto h-16 w-16 text-[#ffd166]" />
            <h1 className="mt-4 text-5xl font-black">{lobby.status === "finished" ? `${winnerName} gagne` : "Combat interrompu"}</h1>
            <button onClick={leaveLobby} className="neo-button mt-6 rounded-2xl px-6 py-3 font-black">Retour</button>
          </section>
        )}
      </section>
    </main>
  );
}

function FighterBar({ player, hp, align }: { player: DuelPlayer | null; hp: number; align: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-sm font-black uppercase tracking-[0.2em] text-white/55">{player?.username ?? "En attente"}</p>
      <div className="mt-2 h-8 overflow-hidden rounded-full bg-black/50 ring-2 ring-white/10">
        <div className="h-full bg-[linear-gradient(90deg,#8df0bf,#ffd166,#ff744d)] transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, hp))}%` }} />
      </div>
      <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-black">
        <Flame className="h-4 w-4 text-[#ff744d]" />
        {numberFormat.format(player?.score ?? 0)}
        {player?.status === "disconnected" && <span className="text-[#ffd166]">10s reconnect</span>}
      </p>
    </div>
  );
}
