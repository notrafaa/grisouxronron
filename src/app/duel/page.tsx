"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Copy, Flame, Sword, Timer, Trophy, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type CatId = "grisou" | "ronron";
type Phase = "lobby" | "waiting" | "joining" | "countdown" | "battle" | "end";
type EvType = "spam" | "phrase" | "target" | "hold" | "bait";

interface DuelEvent {
  id: string;
  type: EvType;
  label: string;
  duration: number;
  points: number;
}

interface Fighter {
  username: string;
  cat: CatId;
  hp: number;
  score: number;
}

const CAT_SRC: Record<CatId, string> = {
  grisou: "/cats/grisou.jpg",
  ronron: "/cats/ronron.jpg",
};

const CAT_INFO: Record<CatId, { name: string; vibe: string }> = {
  grisou: { name: "Grisou", vibe: "Moelleux cosmique" },
  ronron: { name: "Ronron", vibe: "Squeechie solaire" },
};

const EVENT_POOL: Omit<DuelEvent, "id">[] = [
  { type: "spam",   label: "SPAM RAPIDE ! 🐾",          duration: 3000, points: 8  },
  { type: "phrase", label: "Tape : Miaou Turbo !",       duration: 5000, points: 12 },
  { type: "target", label: "Clique la patte ! 🌟",        duration: 2500, points: 15 },
  { type: "hold",   label: "MAINTIENS ! ⚡",              duration: 3500, points: 10 },
  { type: "phrase", label: "Tape : Grisou le goat",      duration: 5000, points: 11 },
  { type: "bait",   label: "Ne clique PAS 🚫",           duration: 2500, points: 20 },
  { type: "spam",   label: "ULTRA SPAM ! 🔥🔥",          duration: 2200, points: 18 },
  { type: "phrase", label: "Tape : Ronron squeechie",    duration: 5500, points: 14 },
  { type: "target", label: "Patte arc-en-ciel ! 🌈",     duration: 2200, points: 20 },
];

function makeEvent(): DuelEvent {
  const base = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
  return { ...base, id: Math.random().toString(36).slice(2) };
}

function makeCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function useAudio() {
  const ctx = useRef<AudioContext | null>(null);
  function ac() {
    if (!ctx.current && typeof window !== "undefined")
      ctx.current = new AudioContext();
    return ctx.current;
  }
  const beep = useCallback((freq: number, vol = 0.22, dur = 0.12) => {
    const c = ac(); if (!c) return;
    const now = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + dur + 0.05);
  }, []);
  const hit = useCallback(() => {
    const c = ac(); if (!c) return;
    const now = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "square"; o.frequency.setValueAtTime(200, now);
    o.frequency.exponentialRampToValueAtTime(55, now + 0.24);
    g.gain.setValueAtTime(0.26, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.3);
  }, []);
  const ding = useCallback(() => {
    const c = ac(); if (!c) return;
    const now = c.currentTime;
    [660, 880, 1100].forEach((f, i) => {
      const t = now + i * 0.07; const o = c.createOscillator(); const g = c.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.14);
    });
  }, []);
  const buzz = useCallback(() => {
    const c = ac(); if (!c) return;
    const now = c.currentTime;
    const o = c.createOscillator(); const f = c.createBiquadFilter(); const g = c.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(280, now);
    o.frequency.exponentialRampToValueAtTime(80, now + 0.32);
    f.type = "lowpass"; f.frequency.value = 700;
    g.gain.setValueAtTime(0.20, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    o.connect(f); f.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.38);
  }, []);
  return { beep, hit, ding, buzz };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DuelPage() {
  // ── persistent identity (read from localStorage) ──────────────────────────
  const [myUsername, setMyUsername] = useState("Joueur");
  const [myCat, setMyCat] = useState<CatId>("grisou");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("squeechie-clicker-demo-profile");
      if (raw) {
        const p = JSON.parse(raw);
        if (p.username) setMyUsername(p.username);
        if (p.selected_cat) setMyCat(p.selected_cat);
      }
    } catch { /* ignore */ }
  }, []);

  // ── phase & multiplayer state ──────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("lobby");
  const [isMulti, setIsMulti] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [lobbyCode, setLobbyCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [copied, setCopied] = useState(false);

  // ── fighters ───────────────────────────────────────────────────────────────
  const initMe = (): Fighter => ({ username: myUsername, cat: myCat, hp: 100, score: 0 });
  const initOpp = (): Fighter => ({ username: "Adversaire", cat: "ronron", hp: 100, score: 0 });
  const [me, setMe] = useState<Fighter>(initMe);
  const [opp, setOpp] = useState<Fighter>(initOpp);

  // ── battle state ───────────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState(3);
  const [battleSecs, setBattleSecs] = useState(60);
  const [event, setEvent] = useState<DuelEvent | null>(null);
  const [evPct, setEvPct] = useState(100);
  const [spamCount, setSpamCount] = useState(0);
  const [phraseVal, setPhraseVal] = useState("");
  const [holdActive, setHoldActive] = useState(false);
  const [holdPts, setHoldPts] = useState(0);
  const [showPaw, setShowPaw] = useState(false);
  const [pawPos, setPawPos] = useState({ x: 50, y: 50 });
  const [flash, setFlash] = useState<{ side: "left" | "right"; val: number } | null>(null);
  const [toast, setToast] = useState("");

  // ── refs ───────────────────────────────────────────────────────────────────
  const evTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const battleIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spamRef = useRef(0);
  const phaseRef = useRef<Phase>("lobby");
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const currentEvRef = useRef<DuelEvent | null>(null);

  phaseRef.current = phase;
  currentEvRef.current = event;

  const audio = useAudio();

  // ── helpers ────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 950);
  }, []);

  const showFlash = useCallback((side: "left" | "right", val: number) => {
    setFlash({ side, val });
    audio.hit();
    setTimeout(() => setFlash(null), 650);
  }, [audio]);

  const clearEvTimers = useCallback(() => {
    if (evTimerRef.current) clearTimeout(evTimerRef.current);
    if (evIntRef.current) clearInterval(evIntRef.current);
  }, []);

  const giveScore = useCallback((pts: number) => {
    setMe(m => ({ ...m, score: m.score + pts }));
    setOpp(o => ({ ...o, hp: Math.max(0, o.hp - pts) }));
    showFlash("right", pts);
    audio.ding();
    showToast(`+${pts} pts 🐾`);
  }, [showFlash, audio, showToast]);

  const takeDmg = useCallback((pts: number) => {
    setMe(m => ({ ...m, hp: Math.max(0, m.hp - pts) }));
    showFlash("left", pts);
    audio.buzz();
    showToast(`-${pts} HP 💔`);
  }, [showFlash, audio, showToast]);

  // Broadcast over multiplayer channel
  const broadcast = useCallback((ev: string, payload: object) => {
    channelRef.current?.send({ type: "broadcast", event: ev, payload });
  }, []);

  // ── event loop ─────────────────────────────────────────────────────────────
  const launchEvent = useCallback((ev?: DuelEvent) => {
    if (phaseRef.current !== "battle") return;
    clearEvTimers();
    const next = ev ?? makeEvent();
    setEvent(next);
    currentEvRef.current = next;
    setEvPct(100);
    setSpamCount(0); spamRef.current = 0;
    setPhraseVal(""); setHoldActive(false); setHoldPts(0); setShowPaw(false);
    if (next.type === "target" || next.type === "hold") {
      setPawPos({ x: 15 + Math.random() * 70, y: 10 + Math.random() * 80 });
      setShowPaw(true);
    }
    let elapsed = 0;
    evIntRef.current = setInterval(() => {
      elapsed += 80;
      setEvPct(100 - (elapsed / next.duration) * 100);
      if (elapsed >= next.duration) clearInterval(evIntRef.current!);
    }, 80);
    evTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== "battle") return;
      setShowPaw(false);
      setEvent(null);
      currentEvRef.current = null;
      setTimeout(() => {
        if (phaseRef.current === "battle") launchEvent();
      }, 700);
    }, next.duration);
    // Host broadcasts event to guest
    if (isHost) broadcast("new-event", { event: next });
  }, [clearEvTimers, isHost, broadcast]);

  // ── battle loop ────────────────────────────────────────────────────────────
  const startBattle = useCallback(() => {
    setPhase("battle");
    setBattleSecs(60);
    setMe(m => ({ ...m, hp: 100, score: 0 }));
    setOpp(o => ({ ...o, hp: 100, score: 0 }));
    launchEvent();
    battleIntRef.current = setInterval(() => {
      setBattleSecs(t => {
        if (t <= 1) {
          clearInterval(battleIntRef.current!);
          clearEvTimers();
          setPhase("end");
          if (isHost) broadcast("game-over", {});
          return 0;
        }
        // AI attacks only in solo mode
        if (!isMulti && Math.random() < 0.18) {
          const aiPts = Math.floor(3 + Math.random() * 6);
          setOpp(o => ({ ...o, score: o.score + aiPts }));
          setMe(m => ({ ...m, hp: Math.max(0, m.hp - aiPts) }));
        }
        return t - 1;
      });
    }, 1000);
  }, [launchEvent, clearEvTimers, isMulti, isHost, broadcast]);

  // ── KO detection ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "battle") return;
    if (me.hp <= 0 || opp.hp <= 0) {
      clearEvTimers();
      clearInterval(battleIntRef.current!);
      setPhase("end");
    }
  }, [me.hp, opp.hp, phase, clearEvTimers]);

  // ── countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { startBattle(); return; }
    audio.beep(countdown === 1 ? 1200 : 500);
    const t = setTimeout(() => setCountdown(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, startBattle, audio]);

  // ── cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    clearEvTimers();
    clearInterval(battleIntRef.current!);
    clearInterval(holdIntRef.current!);
    if (channelRef.current && supabase) supabase.removeChannel(channelRef.current);
  }, [clearEvTimers]);

  // ── Multiplayer: setup channel ─────────────────────────────────────────────
  const setupChannel = useCallback((code: string, hosting: boolean) => {
    if (!supabase) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase.channel(`duel-${code}`);
    channelRef.current = ch;

    ch.on("broadcast", { event: "guest-join" }, ({ payload }) => {
      if (!hosting) return;
      setOpp({ username: payload.username, cat: payload.cat, hp: 100, score: 0 });
      // small delay then start countdown
      setTimeout(() => {
        ch.send({ type: "broadcast", event: "start", payload: {} });
        setCountdown(3);
        setPhase("countdown");
      }, 500);
    });

    ch.on("broadcast", { event: "start" }, () => {
      if (hosting) return;
      setCountdown(3);
      setPhase("countdown");
    });

    ch.on("broadcast", { event: "new-event" }, ({ payload }) => {
      if (hosting) return; // host generates events itself
      launchEvent(payload.event as DuelEvent);
    });

    ch.on("broadcast", { event: "opp-action" }, ({ payload }) => {
      // Opponent completed an event — deal damage to me
      setMe(m => ({ ...m, hp: Math.max(0, m.hp - payload.points) }));
      setOpp(o => ({ ...o, score: o.score + payload.points }));
      showFlash("left", payload.points);
      audio.hit();
    });

    ch.on("broadcast", { event: "game-over" }, () => {
      clearEvTimers();
      clearInterval(battleIntRef.current!);
      setPhase("end");
    });

    ch.subscribe();
    return ch;
  }, [launchEvent, clearEvTimers, showFlash, audio]);

  // ── Lobby actions ──────────────────────────────────────────────────────────
  function startSolo() {
    setIsMulti(false);
    setMe({ username: myUsername, cat: myCat, hp: 100, score: 0 });
    setOpp({ username: "IA Ronron", cat: myCat === "grisou" ? "ronron" : "grisou", hp: 100, score: 0 });
    setCountdown(3);
    setPhase("countdown");
  }

  function createLobby() {
    if (!supabase) return;
    const code = makeCode();
    setLobbyCode(code);
    setIsHost(true);
    setIsMulti(true);
    setMe({ username: myUsername, cat: myCat, hp: 100, score: 0 });
    setOpp({ username: "...", cat: "ronron", hp: 100, score: 0 });
    setupChannel(code, true);
    setPhase("waiting");
  }

  function joinLobby() {
    const code = joinInput.trim().toUpperCase();
    if (code.length < 4) { setJoinError("Code invalide."); return; }
    if (!supabase) { setJoinError("Supabase non configuré."); return; }
    setJoinError("");
    setIsHost(false);
    setIsMulti(true);
    setMe({ username: myUsername, cat: myCat, hp: 100, score: 0 });
    const ch = setupChannel(code, false);
    // Announce ourselves to the host
    setTimeout(() => {
      ch?.send({ type: "broadcast", event: "guest-join", payload: { username: myUsername, cat: myCat } });
    }, 400);
    setPhase("joining");
  }

  function completedEvent(pts: number) {
    giveScore(pts);
    if (isMulti) broadcast("opp-action", { points: pts });
    clearEvTimers();
    setEvent(null);
    setShowPaw(false);
    setTimeout(() => { if (phaseRef.current === "battle") launchEvent(); }, 600);
  }

  // ── Event handlers ─────────────────────────────────────────────────────────
  function handleSpam() {
    const ev = currentEvRef.current;
    if (!ev || ev.type !== "spam") return;
    const n = spamRef.current + 1;
    spamRef.current = n;
    setSpamCount(n);
    if (n >= 5) completedEvent(ev.points);
  }

  function handlePhrase(v: string) {
    const ev = currentEvRef.current;
    if (!ev || ev.type !== "phrase") return;
    setPhraseVal(v);
    const target = ev.label.replace("Tape : ", "").toLowerCase().trim();
    if (v.toLowerCase().trim() === target) completedEvent(ev.points);
  }

  function handlePawDown() {
    const ev = currentEvRef.current;
    if (!ev) return;
    if (ev.type === "target") {
      completedEvent(ev.points);
    } else if (ev.type === "hold" && !holdActive) {
      setHoldActive(true);
      let pts = 0;
      holdIntRef.current = setInterval(() => {
        pts++;
        setHoldPts(pts);
        if (pts >= ev.points) {
          clearInterval(holdIntRef.current!);
          setHoldActive(false);
          completedEvent(ev.points);
        }
      }, 100);
    }
  }

  function handlePawUp() {
    const ev = currentEvRef.current;
    if (!holdActive || !ev || ev.type !== "hold") return;
    clearInterval(holdIntRef.current!);
    setHoldActive(false);
    if (holdPts > 0) completedEvent(Math.max(1, Math.floor((holdPts / ev.points) * ev.points)));
    else takeDmg(5);
    setShowPaw(false);
    clearEvTimers();
    setEvent(null);
    setTimeout(() => { if (phaseRef.current === "battle") launchEvent(); }, 600);
  }

  function handleMainBtn() {
    const ev = currentEvRef.current;
    if (!ev) return;
    if (ev.type === "bait") {
      takeDmg(15);
      clearEvTimers(); setEvent(null);
      setTimeout(() => { if (phaseRef.current === "battle") launchEvent(); }, 700);
    } else if (ev.type === "spam") {
      handleSpam();
    }
  }

  // ── Copy code ──────────────────────────────────────────────────────────────
  function copyCode() {
    navigator.clipboard.writeText(lobbyCode).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    });
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const winner = phase === "end" ? (me.score >= opp.score ? me : opp) : null;
  const iWin = winner?.username === myUsername;

  // ── HP bar color ───────────────────────────────────────────────────────────
  function hpColor(pct: number, dir: "ltr" | "rtl" = "ltr") {
    const c = pct > 50 ? "#4ade80,#22c55e" : pct > 25 ? "#facc15,#f97316" : "#ef4444,#dc2626";
    return dir === "ltr" ? `linear-gradient(90deg,${c})` : `linear-gradient(270deg,${c})`;
  }
  function hpGlow(pct: number) {
    return pct > 50 ? "rgba(74,222,128,0.5)" : pct > 25 ? "rgba(250,204,21,0.5)" : "rgba(239,68,68,0.7)";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <main className="duel-shell" style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div className="relative z-10 w-full h-full flex flex-col">

        {/* ═══════════ LOBBY ═══════════ */}
        {phase === "lobby" && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-5 overflow-y-auto">
            {/* Header */}
            <div className="text-center">
              <div style={{ fontSize: "3rem", lineHeight: 1 }}>⚔️</div>
              <h1 style={{
                fontSize: "clamp(2rem,8vw,4rem)", fontWeight: 900, lineHeight: 1,
                background: "linear-gradient(90deg,#ff6644,#ffcc00,#5599ff)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>MODE DUEL</h1>
              <p style={{ fontSize: "0.8rem", opacity: 0.5, fontWeight: 700, marginTop: 4 }}>
                Combats de chats épiques • Multijoueur ou vs IA
              </p>
            </div>

            {/* Cat picker */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 420 }}>
              {(["grisou", "ronron"] as const).map(id => (
                <button key={id} onClick={() => setMyCat(id)}
                  style={{
                    background: myCat === id ? "rgba(255,140,50,0.12)" : "rgba(8,4,14,0.88)",
                    border: `2px solid ${myCat === id ? "#ff8c32" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 20, padding: 12, cursor: "pointer", transition: "all 0.15s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    color: "#fef0d0",
                  }}>
                  <div style={{ width: 72, height: 72, borderRadius: 14, overflow: "hidden" }}>
                    <Image src={CAT_SRC[id]} alt={id} width={144} height={144} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <span style={{ fontWeight: 900 }}>{CAT_INFO[id].name}</span>
                  <span style={{ fontSize: "0.68rem", opacity: 0.5 }}>{CAT_INFO[id].vibe}</span>
                  {myCat === id && (
                    <span style={{ fontSize: "0.7rem", fontWeight: 900, background: "rgba(255,140,50,0.3)", color: "#ffaa66", borderRadius: 20, padding: "2px 10px" }}>✓ Sélectionné</span>
                  )}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 420 }}>
              {/* Solo */}
              <button onClick={startSolo} className="duel-btn" style={{ borderRadius: 18, padding: "14px 20px", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Sword size={18} /> Duel vs IA
              </button>

              {/* Multiplayer section */}
              {supabase ? (
                <div className="duel-panel" style={{ borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: "0.68rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", opacity: 0.45, margin: 0 }}>
                    Multijoueur en ligne
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button onClick={createLobby} className="duel-btn-blue" style={{ borderRadius: 14, padding: "12px 8px", fontSize: "0.88rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Trophy size={16} /> Créer
                    </button>
                    <button onClick={() => setPhase("joining")} className="duel-btn" style={{ borderRadius: 14, padding: "12px 8px", fontSize: "0.88rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Zap size={16} /> Rejoindre
                    </button>
                  </div>
                </div>
              ) : (
                <div className="duel-panel" style={{ borderRadius: 14, padding: "10px 14px", opacity: 0.45 }}>
                  <p style={{ fontSize: "0.72rem", margin: 0, fontWeight: 700 }}>Multijoueur disponible avec Supabase configuré.</p>
                </div>
              )}

              {/* Back */}
              <Link href="/" className="duel-panel"
                style={{ borderRadius: 14, padding: "12px 20px", fontSize: "0.88rem", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#fef0d0", textDecoration: "none" }}>
                <ArrowLeft size={16} /> Retour à la ferme
              </Link>
            </div>
          </div>
        )}

        {/* ═══════════ WAITING (host created lobby) ═══════════ */}
        {phase === "waiting" && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "3rem" }}>🐱</div>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 900, margin: "8px 0 4px" }}>En attente d'un adversaire</h2>
              <p style={{ opacity: 0.5, fontSize: "0.82rem", margin: 0 }}>Envoie ce code à ton ami</p>
            </div>
            <div className="duel-panel" style={{ borderRadius: 20, padding: 20, textAlign: "center", width: "100%", maxWidth: 340 }}>
              <p style={{ fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", opacity: 0.5, margin: "0 0 8px" }}>Code du lobby</p>
              <div style={{ fontSize: "3rem", fontWeight: 900, letterSpacing: "0.15em", background: "linear-gradient(90deg,#ff8c32,#ffcc00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 12 }}>
                {lobbyCode}
              </div>
              <button onClick={copyCode} className="duel-btn-blue"
                style={{ borderRadius: 12, padding: "10px 20px", fontSize: "0.88rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Copy size={14} /> {copied ? "Copié !" : "Copier"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80", animation: "glowPulse 1s ease-in-out infinite" }} />
              <p style={{ opacity: 0.6, fontSize: "0.82rem", margin: 0 }}>En attente de connexion...</p>
            </div>
            <button onClick={() => { setPhase("lobby"); if (supabase && channelRef.current) supabase.removeChannel(channelRef.current); }}
              className="duel-panel"
              style={{ borderRadius: 12, padding: "10px 20px", fontSize: "0.82rem", fontWeight: 900, color: "#fef0d0", cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        )}

        {/* ═══════════ JOINING ═══════════ */}
        {phase === "joining" && !isMulti && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 gap-5">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem" }}>🔑</div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 900, margin: "8px 0 4px" }}>Rejoindre un duel</h2>
            </div>
            <div className="duel-panel" style={{ borderRadius: 20, padding: 20, width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                value={joinInput}
                onChange={e => setJoinInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && joinLobby()}
                placeholder="CODE DU LOBBY"
                maxLength={8}
                style={{
                  height: 52, background: "rgba(255,255,255,0.07)", color: "#fef0d0",
                  border: "1px solid rgba(255,140,50,0.3)", borderRadius: 14, padding: "0 16px",
                  fontSize: "1.4rem", fontWeight: 900, letterSpacing: "0.15em",
                  textAlign: "center", outline: "none", fontFamily: "inherit",
                }}
              />
              {joinError && <p style={{ color: "#ff7777", fontSize: "0.82rem", margin: 0, textAlign: "center" }}>{joinError}</p>}
              <button onClick={joinLobby} className="duel-btn" style={{ borderRadius: 14, padding: "13px", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Zap size={16} /> Rejoindre
              </button>
            </div>
            <button onClick={() => setPhase("lobby")} className="duel-panel"
              style={{ borderRadius: 12, padding: "10px 20px", fontSize: "0.82rem", fontWeight: 900, color: "#fef0d0", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowLeft size={14} /> Retour
            </button>
          </div>
        )}

        {/* ═══════════ JOINING (waiting for host after sending code) ═══════════ */}
        {phase === "joining" && isMulti && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
            <div style={{ fontSize: "3rem" }}>🐱</div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 900, textAlign: "center" }}>Connexion au lobby...</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#5599ff", animation: "glowPulse 1s ease-in-out infinite" }} />
              <p style={{ opacity: 0.6, fontSize: "0.82rem", margin: 0 }}>En attente de l'hôte...</p>
            </div>
            <button onClick={() => { setIsMulti(false); setPhase("lobby"); if (supabase && channelRef.current) supabase.removeChannel(channelRef.current); }}
              className="duel-panel"
              style={{ borderRadius: 12, padding: "10px 20px", fontSize: "0.82rem", fontWeight: 900, color: "#fef0d0", cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        )}

        {/* ═══════════ COUNTDOWN ═══════════ */}
        {phase === "countdown" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {isMulti && opp.username !== "..." && (
              <div className="duel-panel" style={{ borderRadius: 16, padding: "8px 20px", fontSize: "0.85rem", fontWeight: 900 }}>
                {myUsername} vs {opp.username}
              </div>
            )}
            <p style={{ opacity: 0.5, fontWeight: 900, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.15em" }}>Prépare-toi !</p>
            <div style={{
              fontSize: "clamp(6rem,25vw,10rem)", fontWeight: 900, lineHeight: 1,
              background: "linear-gradient(180deg,#ffcc00,#ff6644)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 40px rgba(255,150,50,0.5))",
              animation: "glowPulse 0.6s ease-in-out infinite",
            }}>
              {countdown === 0 ? "GO!" : countdown}
            </div>
            {countdown === 0 && (
              <p style={{ fontSize: "1.4rem", fontWeight: 900, color: "#ff6644" }}>MIAOU TURBO ! 🐾</p>
            )}
          </div>
        )}

        {/* ═══════════ BATTLE ═══════════ */}
        {phase === "battle" && (
          <>
            {/* HP bars header */}
            <div style={{ padding: "10px 12px 6px", flexShrink: 0 }}>
              <div className="duel-panel" style={{ borderRadius: 18, padding: "10px 12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 52px 1fr", alignItems: "center", gap: 8 }}>
                  {/* Me */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                        <Image src={CAT_SRC[me.cat]} alt={me.username} width={64} height={64} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 900, fontSize: "0.78rem", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.username}</p>
                        <p style={{ fontSize: "0.65rem", opacity: 0.5, margin: 0 }}>{me.score} pts</p>
                      </div>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.08)" }}>
                      <div style={{ height: "100%", borderRadius: 999, width: `${me.hp}%`, background: hpColor(me.hp), boxShadow: `0 0 8px ${hpGlow(me.hp)}`, transition: "width 0.3s" }} />
                    </div>
                    <p style={{ fontSize: "0.65rem", opacity: 0.55, fontWeight: 900, marginTop: 2 }}>{me.hp} HP</p>
                  </div>

                  {/* Timer */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <Timer size={13} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: "1.4rem", fontWeight: 900, color: battleSecs <= 10 ? "#ef4444" : battleSecs <= 20 ? "#f97316" : "#fef0d0", fontVariantNumeric: "tabular-nums" }}>
                      {battleSecs}
                    </span>
                    <span style={{ fontSize: "0.6rem", fontWeight: 900, textTransform: "uppercase", opacity: 0.35 }}>sec</span>
                  </div>

                  {/* Opponent */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexDirection: "row-reverse" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                        <Image src={CAT_SRC[opp.cat]} alt={opp.username} width={64} height={64} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ minWidth: 0, textAlign: "right" }}>
                        <p style={{ fontWeight: 900, fontSize: "0.78rem", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opp.username}</p>
                        <p style={{ fontSize: "0.65rem", opacity: 0.5, margin: 0 }}>{opp.score} pts</p>
                      </div>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.08)" }}>
                      <div style={{ height: "100%", borderRadius: 999, width: `${opp.hp}%`, background: hpColor(opp.hp, "rtl"), boxShadow: `0 0 8px ${hpGlow(opp.hp)}`, transition: "width 0.3s", marginLeft: "auto" }} />
                    </div>
                    <p style={{ fontSize: "0.65rem", opacity: 0.55, fontWeight: 900, marginTop: 2, textAlign: "right" }}>{opp.hp} HP</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Battle arena */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 12px 12px", gap: 12, minHeight: 0, overflow: "hidden", position: "relative" }}>
              {/* Toast */}
              {toast && (
                <div style={{
                  position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 30,
                  background: toast.startsWith("+") ? "rgba(74,222,128,0.9)" : "rgba(239,68,68,0.9)",
                  color: "#fff", borderRadius: 999, padding: "8px 20px", fontSize: "1.1rem", fontWeight: 900,
                  animation: "floatUp 950ms ease forwards", whiteSpace: "nowrap",
                }}>
                  {toast}
                </div>
              )}

              {/* Damage flash */}
              {flash && (
                <div style={{
                  position: "absolute", [flash.side === "left" ? "left" : "right"]: 12, top: "35%",
                  zIndex: 30, background: "rgba(239,68,68,0.9)", color: "#fff",
                  borderRadius: 14, padding: "6px 14px", fontSize: "1.1rem", fontWeight: 900,
                  animation: "floatUp 650ms ease forwards",
                }}>
                  -{flash.val} 💔
                </div>
              )}

              {/* Event card */}
              {event && (
                <div className="duel-card" style={{ borderRadius: 18, padding: "12px 14px", width: "100%", maxWidth: 420 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", opacity: 0.5 }}>
                      {event.type === "spam" && "⚡ SPAM"}
                      {event.type === "phrase" && "⌨️ PHRASE"}
                      {event.type === "target" && "🎯 CIBLE"}
                      {event.type === "hold" && "💪 MAINTIEN"}
                      {event.type === "bait" && "😈 PIÈGE"}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: "0.78rem", fontWeight: 900, color: "#ffcc00" }}>+{event.points} pts</span>
                  </div>
                  <p style={{ fontWeight: 900, fontSize: "1.05rem", margin: "0 0 10px" }}>{event.label}</p>
                  <div style={{ height: 6, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.1)" }}>
                    <div style={{
                      height: "100%", borderRadius: 999,
                      width: `${evPct}%`,
                      background: `linear-gradient(90deg,${evPct > 50 ? "#4ade80" : evPct > 25 ? "#facc15" : "#ef4444"},#ff6644)`,
                      transition: "width 0.08s linear",
                    }} />
                  </div>
                  {event.type === "spam" && <p style={{ fontSize: "0.72rem", opacity: 0.5, marginTop: 4 }}>{spamCount}/5 taps</p>}
                  {event.type === "hold" && holdActive && <p style={{ fontSize: "0.72rem", opacity: 0.5, marginTop: 4 }}>{holdPts}/{event.points}</p>}
                </div>
              )}

              {/* Phrase input */}
              {event?.type === "phrase" && (
                <input
                  autoFocus value={phraseVal} onChange={e => handlePhrase(e.target.value)}
                  placeholder="Tape ici..."
                  style={{
                    width: "100%", maxWidth: 420, height: 50,
                    background: "rgba(255,255,255,0.07)", color: "#fef0d0",
                    border: "1px solid rgba(255,140,50,0.3)", borderRadius: 14, padding: "0 16px",
                    fontSize: "1rem", fontWeight: 900, outline: "none", fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              )}

              {/* Golden paw (target / hold) */}
              {showPaw && (
                <div style={{ position: "relative", width: "100%", maxWidth: 420, height: 130 }}>
                  <button
                    onPointerDown={handlePawDown}
                    onPointerUp={handlePawUp}
                    onPointerLeave={handlePawUp}
                    style={{
                      position: "absolute",
                      left: `${pawPos.x}%`, top: `${pawPos.y}%`,
                      transform: "translate(-50%,-50%)",
                      fontSize: "3.2rem", background: "none", border: "none", cursor: "pointer",
                      filter: "drop-shadow(0 0 16px rgba(255,200,50,0.9))",
                      animation: "glowPulse 0.7s ease-in-out infinite",
                      touchAction: "none",
                    }}>
                    {event?.type === "hold" ? (holdActive ? "✋" : "🖐️") : "🌟"}
                  </button>
                </div>
              )}

              {/* Main button (spam / bait) */}
              {event && event.type !== "phrase" && event.type !== "target" && event.type !== "hold" && (
                <button
                  onPointerDown={handleMainBtn}
                  style={{
                    position: "relative",
                    width: "min(52vw, 240px)", aspectRatio: "1/1",
                    borderRadius: "50%", border: "none", cursor: "pointer",
                    background: "none", touchAction: "none", flexShrink: 0,
                  }}>
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "radial-gradient(circle,rgba(255,140,50,0.28) 0%,transparent 70%)",
                    animation: "glowPulse 1.6s ease-in-out infinite",
                  }} />
                  <Image src={CAT_SRC[me.cat]} alt="click" width={480} height={480}
                    style={{
                      position: "relative", zIndex: 1, width: "100%", height: "100%",
                      objectFit: "cover", borderRadius: "50%",
                      boxShadow: "0 0 0 3px rgba(255,140,50,0.5), 0 16px 48px rgba(0,0,0,0.6)",
                    }}
                    draggable={false}
                  />
                  {event.type === "bait" && (
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: "50%", zIndex: 2,
                      background: "rgba(239,68,68,0.82)", display: "grid", placeItems: "center",
                      fontSize: "3.5rem",
                    }}>
                      🚫
                    </div>
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {/* ═══════════ END ═══════════ */}
        {phase === "end" && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-5 overflow-y-auto">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "4rem" }}>{iWin ? "🏆" : "😿"}</div>
              <h2 style={{
                fontSize: "clamp(2rem,8vw,3.5rem)", fontWeight: 900, lineHeight: 1, margin: "8px 0 4px",
                background: iWin ? "linear-gradient(90deg,#ffcc00,#ff6644)" : "linear-gradient(90deg,#ef4444,#cc2200)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                {iWin ? "Victoire !" : "Défaite..."}
              </h2>
              <p style={{ opacity: 0.5, fontSize: "0.85rem", margin: 0 }}>{winner?.username} remporte le duel</p>
            </div>

            <div className="duel-panel" style={{ borderRadius: 22, padding: 18, width: "100%", maxWidth: 360, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[me, opp].map((f, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, overflow: "hidden" }}>
                    <Image src={CAT_SRC[f.cat]} alt={f.username} width={128} height={128} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <p style={{ fontWeight: 900, fontSize: "0.88rem", margin: 0 }}>{f.username}</p>
                  <p style={{ opacity: 0.4, fontSize: "0.72rem", margin: 0 }}>{f.hp} HP restants</p>
                  <p style={{ fontSize: "1.8rem", fontWeight: 900, color: "#ffcc00", margin: 0 }}>{f.score}</p>
                  <p style={{ fontSize: "0.65rem", textTransform: "uppercase", opacity: 0.4, fontWeight: 900, margin: 0 }}>pts</p>
                  {winner?.username === f.username && <span style={{ fontSize: "1.2rem" }}>🏆</span>}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 8, width: "100%", maxWidth: 360 }}>
              <button onClick={() => { setCountdown(3); setPhase("countdown"); }}
                className="duel-btn" style={{ borderRadius: 18, padding: "14px", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Flame size={18} /> Revanche !
              </button>
              <button onClick={() => { setIsMulti(false); setIsHost(false); if (supabase && channelRef.current) supabase.removeChannel(channelRef.current); setPhase("lobby"); }}
                className="duel-panel"
                style={{ borderRadius: 14, padding: "12px 20px", fontSize: "0.88rem", fontWeight: 900, color: "#fef0d0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Lobby
              </button>
              <Link href="/" className="duel-panel"
                style={{ borderRadius: 14, padding: "12px 20px", fontSize: "0.88rem", fontWeight: 900, color: "#fef0d0", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Retour à la ferme
              </Link>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
