"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Sword, Zap, Timer, Trophy, Flame } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";

type DuelEventType = "phrase" | "target" | "spam" | "hold" | "bait";

type DuelEvent = {
  id: string;
  type: DuelEventType;
  label: string;
  duration: number;
  points: number;
};

type Fighter = {
  id: string;
  username: string;
  hp: number;
  score: number;
  cat: "grisou" | "ronron";
};

type Phase = "lobby" | "countdown" | "battle" | "end";

const EVENTS: Omit<DuelEvent, "id">[] = [
  { type:"spam",   label:"SPAM RAPIDE ! 🐾",          duration:3000, points:8  },
  { type:"phrase", label:"Tape : Miaou Turbo !",       duration:4500, points:12 },
  { type:"target", label:"Clique la patte dorée ! 🌟", duration:2500, points:15 },
  { type:"hold",   label:"MAINTIENS la patte ! ⚡",    duration:3500, points:10 },
  { type:"phrase", label:"Tape : Grisou le goat",      duration:4000, points:11 },
  { type:"bait",   label:"Ne clique PAS 🚫",           duration:2200, points:20 },
  { type:"spam",   label:"ULTRA SPAM ! 🔥🔥",          duration:2000, points:18 },
  { type:"phrase", label:"Tape : Ronron squeechie",    duration:5000, points:14 },
  { type:"target", label:"Patte arc-en-ciel ! 🌈",     duration:2000, points:20 },
];

function randomEvent(): DuelEvent {
  const base = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  return { ...base, id: Math.random().toString(36).slice(2) };
}

const CAT_SRC: Record<string, string> = {
  grisou: "/cats/grisou.jpg",
  ronron: "/cats/ronron.jpg",
};

function useAudio() {
  const ctx = useRef<AudioContext | null>(null);
  const getCtx = () => {
    if (!ctx.current && typeof window !== "undefined") ctx.current = new AudioContext();
    return ctx.current!;
  };
  const hit = useCallback(() => {
    const c = getCtx(); const now = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "square"; o.frequency.setValueAtTime(180, now); o.frequency.exponentialRampToValueAtTime(60, now+0.22);
    g.gain.setValueAtTime(0.22, now); g.gain.exponentialRampToValueAtTime(0.001, now+0.25);
    o.connect(g); g.connect(c.destination); o.start(now); o.stop(now+0.28);
  }, []);
  const score = useCallback(() => {
    const c = getCtx(); const now = c.currentTime;
    for (let i=0;i<3;i++) {
      const t = now+i*0.08; const o = c.createOscillator(); const g = c.createGain();
      o.type = "sine"; o.frequency.setValueAtTime([660,880,1100][i],t);
      g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.18,t+0.01); g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+0.12);
    }
  }, []);
  const fail = useCallback(() => {
    const c = getCtx(); const now = c.currentTime;
    const o = c.createOscillator(); const f = c.createBiquadFilter(); const g = c.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(260,now); o.frequency.exponentialRampToValueAtTime(80,now+0.3);
    f.type = "lowpass"; f.frequency.value = 600;
    g.gain.setValueAtTime(0.18,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.32);
    o.connect(f); f.connect(g); g.connect(c.destination); o.start(now); o.stop(now+0.35);
  }, []);
  const beep = useCallback((n: number) => {
    const c = getCtx(); const now = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "sine"; o.frequency.value = n===0?1200:480;
    g.gain.setValueAtTime(0.001,now); g.gain.exponentialRampToValueAtTime(0.28,now+0.01); g.gain.exponentialRampToValueAtTime(0.001,now+0.12);
    o.connect(g); g.connect(c.destination); o.start(now); o.stop(now+0.15);
  }, []);
  return { hit, score, fail, beep };
}

export default function DuelPage() {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [cdCount, setCdCount] = useState(3);
  const [myCat, setMyCat] = useState<"grisou"|"ronron">("grisou");
  const [me, setMe] = useState<Fighter>({ id:"p1", username:"Toi", hp:100, score:0, cat:"grisou" });
  const [opp, setOpp] = useState<Fighter>({ id:"p2", username:"IA", hp:100, score:0, cat:"ronron" });
  const [event, setEvent] = useState<DuelEvent|null>(null);
  const [evPct, setEvPct] = useState(100);
  const [spamCount, setSpamCount] = useState(0);
  const [phraseInput, setPhraseInput] = useState("");
  const [holdActive, setHoldActive] = useState(false);
  const [holdPts, setHoldPts] = useState(0);
  const [showGoldenPaw, setShowGoldenPaw] = useState(false);
  const [targetPos, setTargetPos] = useState({x:50,y:50});
  const [dmg, setDmg] = useState<{side:"left"|"right";val:number}|null>(null);
  const [battleTime, setBattleTime] = useState(60);
  const [roundMsg, setRoundMsg] = useState("");
  const [winner, setWinner] = useState<Fighter|null>(null);

  const audio = useAudio();
  const evTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const evInterval = useRef<ReturnType<typeof setInterval>|null>(null);
  const battleInterval = useRef<ReturnType<typeof setInterval>|null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval>|null>(null);
  const spamRef = useRef(0);
  const phaseRef = useRef<Phase>("lobby");
  phaseRef.current = phase;

  const showFlash = useCallback((side:"left"|"right", val:number) => {
    setDmg({side,val}); audio.hit();
    setTimeout(()=>setDmg(null),600);
  },[audio]);

  const dealDmgToOpp = useCallback((pts:number) => {
    setOpp(o=>({...o,hp:Math.max(0,o.hp-pts),score:o.score}));
    setMe(m=>({...m,score:m.score+pts}));
    showFlash("right",pts); audio.score();
    setRoundMsg(`+${pts} pts 🐾`);
    setTimeout(()=>setRoundMsg(""),900);
  },[showFlash,audio]);

  const takeDmg = useCallback((pts:number) => {
    setMe(m=>({...m,hp:Math.max(0,m.hp-pts)}));
    showFlash("left",pts); audio.fail();
    setRoundMsg(`-${pts} HP 💔`);
    setTimeout(()=>setRoundMsg(""),900);
  },[showFlash,audio]);

  const clearEv = useCallback(()=>{
    if (evTimer.current) clearTimeout(evTimer.current);
    if (evInterval.current) clearInterval(evInterval.current);
  },[]);

  const launchEvent = useCallback(()=>{
    if (phaseRef.current!=="battle") return;
    clearEv();
    const ev = randomEvent();
    setEvent(ev); setEvPct(100); setSpamCount(0); spamRef.current=0;
    setPhraseInput(""); setHoldActive(false); setHoldPts(0); setShowGoldenPaw(false);
    if (ev.type==="target"||ev.type==="hold") {
      setTargetPos({x:15+Math.random()*70,y:10+Math.random()*80});
      setShowGoldenPaw(true);
    }
    let elapsed=0; const step=80;
    evInterval.current = setInterval(()=>{
      elapsed+=step;
      setEvPct(100-(elapsed/ev.duration)*100);
      if (elapsed>=ev.duration) clearInterval(evInterval.current!);
    },step);
    evTimer.current = setTimeout(()=>{
      if (phaseRef.current!=="battle") return;
      setShowGoldenPaw(false);
      setEvent(null);
      setTimeout(()=>{ if (phaseRef.current==="battle") launchEvent(); },700);
    },ev.duration);
  },[clearEv]);

  const startBattle = useCallback(()=>{
    setPhase("battle");
    setBattleTime(60);
    setMe(m=>({...m,cat:myCat,hp:100,score:0}));
    setOpp(o=>({...o,hp:100,score:0}));
    launchEvent();
    battleInterval.current = setInterval(()=>{
      setBattleTime(t=>{
        if (t<=1) { clearInterval(battleInterval.current!); clearEv(); setPhase("end"); return 0; }
        if (Math.random()<0.20) {
          setOpp(o=>({...o,score:o.score+Math.floor(4+Math.random()*7)}));
          setMe(m=>({...m,hp:Math.max(0,m.hp-Math.floor(2+Math.random()*5))}));
        }
        return t-1;
      });
    },1000);
  },[myCat,launchEvent,clearEv]);

  // Check KO
  useEffect(()=>{
    if (phase!=="battle") return;
    if (me.hp<=0) { clearEv(); clearInterval(battleInterval.current!); setPhase("end"); setWinner(opp); }
    if (opp.hp<=0) { clearEv(); clearInterval(battleInterval.current!); setPhase("end"); setWinner(me); }
  },[me.hp,opp.hp,phase,me,opp,clearEv]);

  // End without KO
  useEffect(()=>{
    if (phase==="end"&&!winner) setWinner(me.score>=opp.score?me:opp);
  },[phase,winner,me,opp]);

  // Countdown
  useEffect(()=>{
    if (phase!=="countdown") return;
    if (cdCount<=0) { startBattle(); return; }
    audio.beep(cdCount-1);
    const t = setTimeout(()=>setCdCount(n=>n-1),1000);
    return ()=>clearTimeout(t);
  },[phase,cdCount,startBattle,audio]);

  // Cleanup
  useEffect(()=>()=>{
    clearEv();
    if (battleInterval.current) clearInterval(battleInterval.current);
    if (holdInterval.current) clearInterval(holdInterval.current);
  },[clearEv]);

  // --- Event handlers ---
  function handleSpam() {
    if (!event||event.type!=="spam") return;
    const n = spamRef.current+1; spamRef.current=n; setSpamCount(n);
    if (n>=5) { dealDmgToOpp(event.points); clearEv(); setEvent(null); setTimeout(()=>launchEvent(),600); }
  }

  function handlePhrase(v:string) {
    if (!event||event.type!=="phrase") return;
    setPhraseInput(v);
    const target = event.label.replace("Tape : ","").toLowerCase().trim();
    if (v.toLowerCase().trim()===target) {
      dealDmgToOpp(event.points); clearEv(); setEvent(null); setPhraseInput("");
      setTimeout(()=>launchEvent(),600);
    }
  }

  function handleGoldenPawDown() {
    if (!event) return;
    if (event.type==="target") {
      dealDmgToOpp(event.points); setShowGoldenPaw(false); clearEv(); setEvent(null);
      setTimeout(()=>launchEvent(),600);
    } else if (event.type==="hold"&&!holdActive) {
      setHoldActive(true);
      let pts=0;
      holdInterval.current = setInterval(()=>{
        pts++; setHoldPts(pts);
        if (pts>=event.points) {
          clearInterval(holdInterval.current!); setHoldActive(false);
          dealDmgToOpp(event.points); setShowGoldenPaw(false); clearEv(); setEvent(null);
          setTimeout(()=>launchEvent(),600);
        }
      },100);
    }
  }

  function handleGoldenPawUp() {
    if (!holdActive||!event||event.type!=="hold") return;
    clearInterval(holdInterval.current!); setHoldActive(false);
    if (holdPts>0) dealDmgToOpp(Math.floor((holdPts/event.points)*event.points));
    else takeDmg(5);
    setShowGoldenPaw(false); clearEv(); setEvent(null);
    setTimeout(()=>launchEvent(),600);
  }

  function handleMainBtn() {
    if (!event) return;
    if (event.type==="bait") { takeDmg(15); clearEv(); setEvent(null); setTimeout(()=>launchEvent(),700); return; }
    if (event.type==="spam") handleSpam();
  }

  const meHpPct = me.hp;
  const oppHpPct = opp.hp;

  // ===== LOBBY =====
  if (phase==="lobby") return (
    <main className="duel-shell">
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 gap-6 overflow-y-auto py-8">
        <div className="text-center">
          <div className="text-5xl mb-2">⚔️</div>
          <h1 className="text-4xl sm:text-6xl font-black"
            style={{background:"linear-gradient(90deg,#ff6644,#ffcc00,#5599ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            MODE DUEL
          </h1>
          <p className="text-sm font-bold opacity-50 mt-1">Combats de chats épiques</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 w-full max-w-lg">
          {(["grisou","ronron"] as const).map(id=>(
            <button key={id} onClick={()=>setMyCat(id)}
              className={`duel-panel rounded-[24px] p-4 flex flex-col items-center gap-2 transition border-2 ${myCat===id?"border-orange-400":"border-transparent hover:border-white/20"}`}>
              <div className="overflow-hidden rounded-[18px] w-24 h-24 shrink-0">
                <Image src={CAT_SRC[id]} alt={id} width={200} height={200} className="w-full h-full object-cover"/>
              </div>
              <p className="font-black capitalize">{id}</p>
              <p className="text-xs opacity-50">{id==="grisou"?"Moelleux cosmique":"Squeechie solaire"}</p>
              {myCat===id&&<span className="text-xs font-black px-3 py-1 rounded-full" style={{background:"rgba(255,140,50,0.3)",color:"#ffaa66"}}>✓ Sélectionné</span>}
            </button>
          ))}
        </div>

        <div className="grid gap-3 w-full max-w-lg">
          <button onClick={()=>{setWinner(null);setCdCount(3);setPhase("countdown");}} className="duel-btn rounded-[20px] px-6 py-4 text-lg w-full flex items-center justify-center gap-2">
            <Sword className="h-5 w-5"/>Duel vs IA
          </button>
          {isSupabaseConfigured&&(
            <div className="duel-panel rounded-[20px] p-4 flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Multijoueur (bientôt)</p>
              <div className="grid grid-cols-2 gap-2 opacity-40 pointer-events-none">
                <button className="duel-btn-blue rounded-[16px] px-4 py-3 text-sm flex items-center justify-center gap-1.5">
                  <Trophy className="h-4 w-4"/>Créer
                </button>
                <button className="duel-btn rounded-[16px] px-4 py-3 text-sm flex items-center justify-center gap-1.5">
                  <Zap className="h-4 w-4"/>Rejoindre
                </button>
              </div>
            </div>
          )}
          <Link href="/" className="duel-panel rounded-[20px] px-6 py-3.5 text-sm font-black flex items-center justify-center gap-2 hover:opacity-80 transition">
            <ArrowLeft className="h-4 w-4"/>Retour à la ferme
          </Link>
        </div>
      </div>
    </main>
  );

  // ===== COUNTDOWN =====
  if (phase==="countdown") return (
    <main className="duel-shell">
      <div className="relative z-10 flex-1 flex h-full flex-col items-center justify-center gap-6">
        <p className="text-sm font-black uppercase tracking-widest opacity-50">Prépare-toi !</p>
        <div className="text-[120px] sm:text-[160px] font-black leading-none tabular-nums"
          style={{background:"linear-gradient(180deg,#ffcc00,#ff6644)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",filter:"drop-shadow(0 0 40px rgba(255,150,50,0.5))",animation:"glowPulse 0.6s ease-in-out infinite"}}>
          {cdCount===0?"GO!":cdCount}
        </div>
        {cdCount===0&&<p className="text-2xl font-black" style={{color:"#ff6644"}}>MIAOU TURBO ! 🐾</p>}
      </div>
    </main>
  );

  // ===== BATTLE =====
  if (phase==="battle") return (
    <main className="duel-shell">
      <div className="relative z-10 flex h-full flex-col">

        {/* HP bars */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div className="duel-panel rounded-[20px] p-3">
            <div className="grid grid-cols-[1fr_56px_1fr] items-center gap-2">

              {/* Me */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-8 h-8 overflow-hidden rounded-xl shrink-0">
                    <Image src={CAT_SRC[me.cat]} alt={me.username} width={64} height={64} className="w-full h-full object-cover"/>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{me.username}</p>
                    <p className="text-[10px] font-bold opacity-50">{me.score} pts</p>
                  </div>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.1)"}}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{width:`${meHpPct}%`,background:meHpPct>50?"linear-gradient(90deg,#4ade80,#22c55e)":meHpPct>25?"linear-gradient(90deg,#facc15,#f97316)":"linear-gradient(90deg,#ef4444,#dc2626)",boxShadow:`0 0 8px ${meHpPct>50?"rgba(74,222,128,0.5)":meHpPct>25?"rgba(250,204,21,0.5)":"rgba(239,68,68,0.7)"}`}}>
                  </div>
                </div>
                <p className="text-[10px] font-black mt-0.5 opacity-60">{me.hp} HP</p>
              </div>

              {/* Timer */}
              <div className="flex flex-col items-center gap-0.5">
                <Timer className="h-3.5 w-3.5 opacity-40"/>
                <span className="text-xl font-black tabular-nums" style={{color:battleTime<=10?"#ef4444":battleTime<=20?"#f97316":"#fef0d0"}}>{battleTime}</span>
                <span className="text-[9px] uppercase opacity-40 font-black">sec</span>
              </div>

              {/* Opp */}
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-row-reverse">
                  <div className="w-8 h-8 overflow-hidden rounded-xl shrink-0">
                    <Image src={CAT_SRC[opp.cat]} alt={opp.username} width={64} height={64} className="w-full h-full object-cover"/>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-xs font-black truncate">{opp.username}</p>
                    <p className="text-[10px] font-bold opacity-50">{opp.score} pts</p>
                  </div>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.1)"}}>
                  <div className="h-full rounded-full transition-all duration-300 ml-auto"
                    style={{width:`${oppHpPct}%`,background:oppHpPct>50?"linear-gradient(270deg,#60a5fa,#3b82f6)":oppHpPct>25?"linear-gradient(270deg,#facc15,#f97316)":"linear-gradient(270deg,#ef4444,#dc2626)",boxShadow:`0 0 8px ${oppHpPct>50?"rgba(96,165,250,0.5)":oppHpPct>25?"rgba(250,204,21,0.5)":"rgba(239,68,68,0.7)"}`}}>
                  </div>
                </div>
                <p className="text-[10px] font-black mt-0.5 opacity-60 text-right">{opp.hp} HP</p>
              </div>
            </div>
          </div>
        </div>

        {/* Battle area */}
        <div className="flex-1 flex flex-col items-center justify-center px-3 pb-3 gap-3 min-h-0 overflow-hidden relative">

          {/* Round message */}
          {roundMsg&&(
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none rounded-full px-5 py-2 text-xl font-black"
              style={{background:roundMsg.startsWith("+")?"rgba(74,222,128,0.9)":"rgba(239,68,68,0.9)",color:"#fff",animation:"floatUp 900ms ease forwards",whiteSpace:"nowrap"}}>
              {roundMsg}
            </div>
          )}

          {/* Damage flash */}
          {dmg&&(
            <div className={`absolute ${dmg.side==="left"?"left-3":"right-3"} top-1/3 z-30 pointer-events-none rounded-2xl px-3 py-2 text-lg font-black`}
              style={{background:"rgba(239,68,68,0.9)",color:"#fff",animation:"floatUp 600ms ease forwards"}}>
              -{dmg.val}💔
            </div>
          )}

          {/* Event card */}
          {event&&(
            <div className="w-full max-w-md shrink-0">
              <div className="duel-card rounded-[20px] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-50">
                    {event.type==="spam"&&"⚡ SPAM"}
                    {event.type==="phrase"&&"⌨️ PHRASE"}
                    {event.type==="target"&&"🎯 CIBLE"}
                    {event.type==="hold"&&"💪 MAINTIEN"}
                    {event.type==="bait"&&"😈 PIÈGE"}
                  </span>
                  <span className="ml-auto text-xs font-black" style={{color:"#ffcc00"}}>+{event.points} pts</span>
                </div>
                <p className="text-lg font-black mb-3">{event.label}</p>
                <div className="h-2 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.10)"}}>
                  <div className="h-full rounded-full"
                    style={{width:`${evPct}%`,background:`linear-gradient(90deg,${evPct>50?"#4ade80":evPct>25?"#facc15":"#ef4444"},#ff6644)`,transition:"width 0.08s linear"}}/>
                </div>
                {event.type==="spam"&&<p className="text-xs opacity-50 mt-1">{spamCount}/5 taps</p>}
                {event.type==="hold"&&holdActive&&<p className="text-xs opacity-50 mt-1">{holdPts}/{event.points}</p>}
              </div>
            </div>
          )}

          {/* Phrase input */}
          {event?.type==="phrase"&&(
            <div className="w-full max-w-md shrink-0">
              <input autoFocus value={phraseInput} onChange={e=>handlePhrase(e.target.value)}
                placeholder="Tape ici..."
                className="w-full h-12 rounded-[16px] border px-4 text-base font-black outline-none"
                style={{background:"rgba(255,255,255,0.08)",color:"#fef0d0",borderColor:"rgba(255,140,50,0.3)"}}
              />
            </div>
          )}

          {/* Golden paw */}
          {showGoldenPaw&&(
            <div className="relative w-full max-w-md shrink-0" style={{height:"120px"}}>
              <button
                className="absolute text-5xl"
                style={{left:`${targetPos.x}%`,top:`${targetPos.y}%`,transform:"translate(-50%,-50%)",filter:"drop-shadow(0 0 18px rgba(255,200,50,0.9))",animation:"glowPulse 0.7s ease-in-out infinite",touchAction:"none"}}
                onPointerDown={handleGoldenPawDown}
                onPointerUp={handleGoldenPawUp}
                onPointerLeave={handleGoldenPawUp}
              >
                {event?.type==="hold"?(holdActive?"✋":"🖐️"):"🌟"}
              </button>
            </div>
          )}

          {/* Main cat button */}
          {event&&event.type!=="phrase"&&event.type!=="target"&&event.type!=="hold"&&(
            <button
              onPointerDown={handleMainBtn}
              className="relative rounded-full shrink-0"
              style={{width:"min(52vw,260px)",aspectRatio:"1/1",touchAction:"none"}}>
              <div className="absolute inset-0 rounded-full" style={{background:"radial-gradient(circle,rgba(255,140,50,0.30) 0%,transparent 70%)",animation:"glowPulse 1.6s ease-in-out infinite"}}/>
              <Image src={CAT_SRC[me.cat]} alt="click" width={520} height={520}
                className="relative z-10 w-full h-full object-cover rounded-full"
                style={{boxShadow:"0 0 0 3px rgba(255,140,50,0.5), 0 16px 50px rgba(0,0,0,0.6)"}}
                draggable={false}
              />
              {event.type==="bait"&&(
                <div className="absolute inset-0 rounded-full grid place-items-center z-20"
                  style={{background:"rgba(239,68,68,0.80)",fontSize:"3.5rem"}}>
                  🚫
                </div>
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  );

  // ===== END =====
  return (
    <main className="duel-shell">
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 gap-6 overflow-y-auto py-8">
        <div className="text-center">
          <div className="text-6xl mb-3">{winner?.id===me.id?"🏆":"😿"}</div>
          <h2 className="text-4xl sm:text-5xl font-black"
            style={{background:winner?.id===me.id?"linear-gradient(90deg,#ffcc00,#ff6644)":"linear-gradient(90deg,#ef4444,#cc2200)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            {winner?.id===me.id?"Victoire !":"Défaite..."}
          </h2>
          <p className="text-sm font-bold opacity-50 mt-1">{winner?.username} remporte le duel</p>
        </div>

        <div className="duel-panel rounded-[24px] p-5 w-full max-w-sm grid grid-cols-2 gap-4">
          {[me,opp].map(f=>(
            <div key={f.id} className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 overflow-hidden rounded-[18px]">
                <Image src={CAT_SRC[f.cat]} alt={f.username} width={128} height={128} className="w-full h-full object-cover"/>
              </div>
              <p className="text-sm font-black">{f.username}</p>
              <p className="text-xs opacity-40">{f.hp} HP</p>
              <p className="text-2xl font-black" style={{color:"#ffcc00"}}>{f.score}</p>
              <p className="text-[10px] uppercase opacity-40 font-black">pts</p>
              {winner?.id===f.id&&<span className="text-lg">🏆</span>}
            </div>
          ))}
        </div>

        <div className="grid gap-2 w-full max-w-sm">
          <button onClick={()=>{setWinner(null);setCdCount(3);setPhase("countdown");}} className="duel-btn rounded-[20px] px-6 py-4 text-base w-full flex items-center justify-center gap-2">
            <Flame className="h-5 w-5"/>Revanche !
          </button>
          <button onClick={()=>{setWinner(null);setPhase("lobby");}} className="duel-panel rounded-[20px] px-6 py-3.5 text-sm font-black flex items-center justify-center gap-2 hover:opacity-80 transition">
            <ArrowLeft className="h-4 w-4"/>Retour au lobby
          </button>
          <Link href="/" className="duel-panel rounded-[20px] px-6 py-3.5 text-sm font-black flex items-center justify-center gap-2 hover:opacity-80 transition">
            <ArrowLeft className="h-4 w-4"/>Retour à la ferme
          </Link>
        </div>
      </div>
    </main>
  );
}
