"use client";

import {
  Cat,
  Coins,
  Flame,
  Gem,
  KeyRound,
  LogIn,
  LogOut,
  Moon,
  MousePointer2,
  Music2,
  PawPrint,
  Save,
  Sparkles,
  Sun,
  Trophy,
  UserPlus,
  Volume2,
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
  | "paw" | "cushion" | "gloss" | "snack" | "laser"
  | "yarn" | "nap" | "chef" | "portal" | "crown" | "factory" | "constellation";
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

type Pop = { id: number; value: number; x: number; y: number; hue: string };
type RemoteCursor = { id: string; username: string; x: number; y: number; color: string; lastSeen: number };

const cats: Record<CatId, { name: string; src: string; accent: string; glow: string; vibe: string }> = {
  grisou: { name: "Grisou", src: "/cats/grisou.jpg", accent: "#c86000", glow: "rgba(200,100,0,0.32)", vibe: "moelleux cosmique" },
  ronron: { name: "Ronron", src: "/cats/ronron.jpg", accent: "#cc2850", glow: "rgba(200,40,80,0.28)", vibe: "squeechie solaire" },
};

const upgrades: Upgrade[] = [
  { id:"paw",           name:"Patte turbo",         icon:PawPrint, description:"Plus de croquettes a chaque pression.",      baseCost:25,      growth:1.22, tint:"#c86000", effect:(l)=>`+${l+1}/clic` },
  { id:"cushion",       name:"Coussin aimant",       icon:Sparkles, description:"Production douce meme sans cliquer.",         baseCost:90,      growth:1.28, tint:"#9a7000", effect:(l)=>`+${(l*0.8+0.8).toFixed(1)}/s` },
  { id:"gloss",         name:"Brillance squeechie",  icon:Gem,      description:"Multiplie tous tes gains.",                  baseCost:220,     growth:1.34, tint:"#1a7a3a", effect:(l)=>`x${(1+(l+1)*0.15).toFixed(2)}` },
  { id:"snack",         name:"Snack premium",        icon:Zap,      description:"Rend chaque clic plus explosif.",             baseCost:650,     growth:1.42, tint:"#cc2850", effect:(l)=>`+${(l+1)*8}%` },
  { id:"laser",         name:"Laser hypnotique",     icon:Zap,      description:"Grosses pointes de puissance au clic.",       baseCost:1400,    growth:1.5,  tint:"#aa1820", effect:(l)=>`+${(l+1)*5}% clic` },
  { id:"yarn",          name:"Pelote quantique",     icon:Sparkles, description:"Ameliore la production automatique.",         baseCost:3200,    growth:1.55, tint:"#1a5fa0", effect:(l)=>`+${(l+1)*3}/s` },
  { id:"nap",           name:"Sieste royale",        icon:Cat,      description:"Bonus global doux mais infini.",              baseCost:7200,    growth:1.6,  tint:"#6a40b0", effect:(l)=>`x${(1+(l+1)*0.04).toFixed(2)}` },
  { id:"chef",          name:"Chef croquette",       icon:Coins,    description:"Multiplie les croquettes gagnees.",           baseCost:18000,   growth:1.66, tint:"#9a7000", effect:(l)=>`x${(1+(l+1)*0.06).toFixed(2)}` },
  { id:"portal",        name:"Portail miaou",        icon:Sparkles, description:"La ferme attire des croquettes d'ailleurs.",  baseCost:52000,   growth:1.72, tint:"#6a40b0", effect:(l)=>`+${(l+1)*18}/s` },
  { id:"crown",         name:"Couronne du goat",     icon:Trophy,   description:"Booste les niveaux de chats.",                baseCost:140000,  growth:1.78, tint:"#9a7000", effect:(l)=>`+${(l+1)*7}% chats` },
  { id:"factory",       name:"Usine a ronrons",      icon:Gem,      description:"Production passive massive.",                 baseCost:400000,  growth:1.84, tint:"#1a7a3a", effect:(l)=>`+${(l+1)*60}/s` },
  { id:"constellation", name:"Constellation",        icon:Flame,    description:"Bonus final qui scale pour toujours.",        baseCost:1200000, growth:1.92, tint:"#cc2850", effect:(l)=>`x${(1+(l+1)*0.1).toFixed(2)}` },
];

const emptyUpgrades: Record<UpgradeId, number> = {
  paw:0, cushion:0, gloss:0, snack:0, laser:0, yarn:0,
  nap:0, chef:0, portal:0, crown:0, factory:0, constellation:0,
};
const emptyCatLevels: Record<CatId, number> = { grisou:1, ronron:1 };
const demoKey = "squeechie-clicker-demo-profile";
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function freshProfile(username: string, id = "demo-user"): GameProfile {
  return { id, username, selected_cat:"grisou", treats:0, total_clicks:0, click_power:1, auto_rate:0, multiplier:1, upgrades:{...emptyUpgrades}, rebirths:0, lifetime_treats:0, cat_levels:{...emptyCatLevels} };
}

function usernameToAuthEmail(username: string) {
  const n = username.trim().toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < n.length; i++) { h ^= n.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `user_${(h>>>0).toString(16)}@grisouxronron.local`;
}

function upgradeCost(u: Upgrade, level: number) { return Math.floor(u.baseCost * Math.pow(u.growth, level)); }
function catLevelCost(level: number, rebirths: number) { return Math.floor(450 * Math.pow(1.42, level-1) * (1 + rebirths*0.12)); }
function rebirthCost(rebirths: number) { return Math.floor(100000 * Math.pow(3.2, rebirths)); }

function normalizeProfile(p: GameProfile): GameProfile {
  return { ...p, selected_cat: p.selected_cat??"grisou", treats:Number(p.treats??0), total_clicks:Number(p.total_clicks??0), click_power:Number(p.click_power??1), auto_rate:Number(p.auto_rate??0), multiplier:Number(p.multiplier??1), upgrades:{...emptyUpgrades,...(p.upgrades??{})}, rebirths:Number(p.rebirths??0), lifetime_treats:Number(p.lifetime_treats??p.treats??0), cat_levels:{...emptyCatLevels,...(p.cat_levels??{})} };
}

function profileSavePayload(p: GameProfile) {
  return { id:p.id, username:p.username, selected_cat:p.selected_cat, treats:p.treats, total_clicks:p.total_clicks, click_power:p.click_power, auto_rate:p.auto_rate, multiplier:p.multiplier, upgrades:p.upgrades, rebirths:p.rebirths, lifetime_treats:p.lifetime_treats, cat_levels:p.cat_levels, updated_at:new Date().toISOString() };
}
function legacyProfileSavePayload(p: GameProfile) {
  return { id:p.id, username:p.username, selected_cat:p.selected_cat, treats:p.treats, total_clicks:p.total_clicks, click_power:p.click_power, auto_rate:p.auto_rate, multiplier:p.multiplier, upgrades:p.upgrades, updated_at:new Date().toISOString() };
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
  const [isDark, setIsDark] = useState(false);
  const [pops, setPops] = useState<Pop[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [leaderboard, setLeaderboard] = useState<GameProfile[]>([]);
  const [pressed, setPressed] = useState(false);
  const [combo, setCombo] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>("play");
  const popId = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorSent = useRef(0);

  const currentCat = profile ? cats[profile.selected_cat] : cats.grisou;
  const activeCatLevel = profile ? profile.cat_levels[profile.selected_cat] ?? 1 : 1;
  const rebirthMultiplier = profile ? 1 + profile.rebirths * 0.35 : 1;
  const catMultiplier = profile ? 1 + (activeCatLevel-1)*0.12 + (profile.upgrades.crown??0)*0.07 : 1;
  const globalMultiplier = profile
    ? (1+(profile.upgrades.gloss??0)*0.15) * (1+(profile.upgrades.nap??0)*0.04)
      * (1+(profile.upgrades.chef??0)*0.06) * (1+(profile.upgrades.constellation??0)*0.1)
      * rebirthMultiplier * catMultiplier
    : 1;
  const treatsPerClick = profile
    ? (1+(profile.upgrades.paw??0)+(profile.upgrades.laser??0)*0.05*(profile.upgrades.paw+1)) * globalMultiplier
    : 1;
  const passiveGain = profile
    ? ((profile.upgrades.cushion??0)*0.8 + (profile.upgrades.yarn??0)*3 + (profile.upgrades.portal??0)*18 + (profile.upgrades.factory??0)*60) * globalMultiplier
    : 0;
  const totalUpgradeLevels = profile
    ? Object.values({...emptyUpgrades,...profile.upgrades}).reduce((s,v)=>s+v,0)
    : 0;

  // ---- SOUND ---- (volumes ~40% of original)
  const playMeow = useCallback(() => {
    if (!soundOn || typeof window === "undefined") return;
    const ctx = audio.current ?? new AudioContext();
    audio.current = ctx;
    const now = ctx.currentTime;
    const variants: [number,number,number,number,number][] = [
      [920,  570, 810, 0.28, 0.038],
      [780,  490, 710, 0.42, 0.034],
      [1180, 820, 1060, 0.21, 0.030],
      [860,  590, 760, 0.36, 0.040],
    ];
    const [f0,f1,f2,dur,vol] = variants[Math.floor(Math.random()*variants.length)];
    const pitch = 0.88 + Math.random()*0.24;
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const mainOsc = ctx.createOscillator();
    const vibOsc = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vibOsc.frequency.value = 5.5 + Math.random()*2;
    vibGain.gain.setValueAtTime(0, now);
    vibGain.gain.linearRampToValueAtTime(30, now+dur*0.18);
    vibGain.gain.setValueAtTime(30, now+dur*0.72);
    vibGain.gain.linearRampToValueAtTime(0, now+dur);
    vibOsc.connect(vibGain); vibGain.connect(mainOsc.frequency);
    mainOsc.type = "sine";
    mainOsc.frequency.setValueAtTime(f0*pitch, now);
    mainOsc.frequency.exponentialRampToValueAtTime(f1*pitch, now+dur*0.48);
    mainOsc.frequency.exponentialRampToValueAtTime(f2*pitch, now+dur*0.86);
    filter.type = "peaking"; filter.frequency.setValueAtTime(1350,now); filter.frequency.exponentialRampToValueAtTime(880,now+dur*0.5); filter.Q.value=2.2; filter.gain.value=9;
    gainNode.gain.setValueAtTime(0.001, now); gainNode.gain.exponentialRampToValueAtTime(vol, now+0.018); gainNode.gain.setValueAtTime(vol, now+dur*0.62); gainNode.gain.exponentialRampToValueAtTime(0.001, now+dur);
    mainOsc.connect(filter); filter.connect(gainNode); gainNode.connect(ctx.destination);
    vibOsc.start(now); mainOsc.start(now); vibOsc.stop(now+dur+0.05); mainOsc.stop(now+dur+0.05);
  }, [soundOn]);

  const playTone = useCallback((kind: "buy"|"error"|"save") => {
    if (!soundOn || typeof window === "undefined") return;
    const ctx = audio.current ?? new AudioContext();
    audio.current = ctx;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    if (kind === "buy") {
      for (let i=0;i<2;i++) {
        const t = now+i*0.09;
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type="sine"; osc.frequency.setValueAtTime(1200+i*280,t); osc.frequency.exponentialRampToValueAtTime(1700+i*200,t+0.06);
        g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.026,t+0.01); g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
        osc.connect(g); g.connect(ctx.destination); osc.start(t); osc.stop(t+0.12);
      }
    } else if (kind === "error") {
      const osc = ctx.createOscillator(); const f = ctx.createBiquadFilter();
      osc.type="sawtooth"; osc.frequency.setValueAtTime(220,now); osc.frequency.linearRampToValueAtTime(140,now+0.22);
      f.type="lowpass"; f.frequency.value=800;
      gain.gain.setValueAtTime(0.016,now); gain.gain.exponentialRampToValueAtTime(0.001,now+0.24);
      osc.connect(f); f.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now+0.25);
    } else {
      const osc = ctx.createOscillator(); const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
      osc.type="sine"; osc.frequency.value=90; lfo.frequency.value=24; lfoG.gain.value=0.014;
      lfo.connect(lfoG); lfoG.connect(gain.gain);
      gain.gain.setValueAtTime(0.020,now); gain.gain.setValueAtTime(0.020,now+0.25); gain.gain.exponentialRampToValueAtTime(0.001,now+0.55);
      osc.connect(gain); gain.connect(ctx.destination);
      lfo.start(now); osc.start(now); lfo.stop(now+0.6); osc.stop(now+0.6);
    }
  }, [soundOn]);

  const loadLeaderboard = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("profiles").select("*").order("rebirths",{ascending:false}).order("lifetime_treats",{ascending:false}).order("treats",{ascending:false}).limit(8);
    if (data) setLeaderboard(data.map(item=>normalizeProfile(item as GameProfile)));
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!supabase) {
        const cached = window.localStorage.getItem(demoKey);
        if (cached) setProfile(normalizeProfile(JSON.parse(cached)));
        setLoading(false); return;
      }
      const { data: sd } = await supabase.auth.getSession();
      const userId = sd.session?.user.id;
      if (!userId) { setLoading(false); await loadLeaderboard(); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id",userId).single();
      if (data) {
        const remote = normalizeProfile(data as GameProfile);
        const cached = window.localStorage.getItem(demoKey);
        if (cached) { const cp = normalizeProfile(JSON.parse(cached)); setProfile(cp.id===remote.id&&(cp.lifetime_treats>remote.lifetime_treats||cp.rebirths>remote.rebirths)?cp:remote); }
        else setProfile(remote);
      }
      setLoading(false); await loadLeaderboard();
    }
    loadProfile();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (!profile || !supabase) return;
    const client = supabase; const ap = profile;
    const color = ap.selected_cat==="grisou" ? "#c86000" : "#cc2850";
    const channel = client.channel("clicker-cursors").on("broadcast",{event:"cursor"},({payload})=>{
      const c = payload as RemoteCursor;
      if (!c.id||c.id===ap.id) return;
      setRemoteCursors(cur=>({...cur,[c.id]:{...c,lastSeen:Date.now()}}));
    }).subscribe();
    function sendCursor(e: PointerEvent) {
      const now = Date.now(); if (now-lastCursorSent.current<50) return; lastCursorSent.current=now;
      channel.send({type:"broadcast",event:"cursor",payload:{id:ap.id,username:ap.username,x:e.clientX/window.innerWidth,y:e.clientY/window.innerHeight,color}});
    }
    const staleTimer = window.setInterval(()=>{setRemoteCursors(c=>Object.fromEntries(Object.entries(c).filter(([,v])=>Date.now()-v.lastSeen<2500)));},1000);
    window.addEventListener("pointermove",sendCursor);
    return ()=>{ window.removeEventListener("pointermove",sendCursor); window.clearInterval(staleTimer); client.removeChannel(channel); };
  }, [profile]);

  const saveProfile = useCallback(async (nextProfile: GameProfile, quiet=true) => {
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
  }, [loadLeaderboard, playTone]);

  const queueSave = useCallback((p: GameProfile)=>{
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(()=>saveProfile(p), 450);
  }, [saveProfile]);

  const updateProfile = useCallback((producer: (p:GameProfile)=>GameProfile)=>{
    setProfile(cur=>{ if (!cur) return cur; const next=normalizeProfile(producer(cur)); queueSave(next); return next; });
  }, [queueSave]);

  useEffect(()=>{
    if (!profile||passiveGain<=0) return;
    const timer = setInterval(()=>{
      updateProfile(cur=>({...cur,treats:cur.treats+passiveGain,lifetime_treats:cur.lifetime_treats+passiveGain}));
    },1000);
    return ()=>clearInterval(timer);
  },[passiveGain,profile,updateProfile]);

  async function handleStart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (authLoading) return;
    const clean = username.trim().replace(/\s+/g," ");
    if (clean.length<3||clean.length>18) { setMessage("Pseudo entre 3 et 18 caracteres."); playTone("error"); return; }
    if (password.length<6) { setMessage("Mot de passe: 6 caracteres minimum."); playTone("error"); return; }
    if (isSupabaseMisconfigured) { setMessage("URL Supabase incorrecte."); playTone("error"); return; }
    setAuthLoading(true); setMessage("");
    if (!supabase) {
      const cached = window.localStorage.getItem(demoKey);
      if (authMode==="login"&&cached) { const ex=normalizeProfile(JSON.parse(cached)); if (ex.username.toLowerCase()===clean.toLowerCase()) { setProfile(ex); setAuthLoading(false); return; } }
      if (authMode==="login") { setAuthLoading(false); setMessage("Aucun compte local avec ce pseudo. Cree-le d'abord."); playTone("error"); return; }
      const next=freshProfile(clean); setProfile(next); window.localStorage.setItem(demoKey,JSON.stringify(next)); setAuthLoading(false); return;
    }
    const email=usernameToAuthEmail(clean);
    const loadExisting = async (userId:string) => {
      const {data,error} = await supabase!.from("profiles").select("*").eq("id",userId).single();
      if (error||!data) return false; setProfile(normalizeProfile(data as GameProfile)); await loadLeaderboard(); playTone("save"); return true;
    };
    if (authMode==="create") {
      const ea = await supabase.auth.signInWithPassword({email,password});
      if (ea.data.user) { const l=await loadExisting(ea.data.user.id); setAuthLoading(false); if (!l){setMessage("Compte trouve, mais sauvegarde introuvable.");playTone("error");} return; }
      const {data:ep} = await supabase.from("profiles").select("id").ilike("username",clean).maybeSingle();
      if (ep) { setAuthLoading(false); setMessage("Ce pseudo existe deja. Utilise Se connecter."); playTone("error"); return; }
    }
    const auth = authMode==="create"
      ? await supabase.auth.signUp({email,password,options:{data:{username:clean}}})
      : await supabase.auth.signInWithPassword({email,password});
    if (auth.error||!auth.data.user) {
      setAuthLoading(false);
      const s=auth.error?.status;
      setMessage(s===429?"Trop de creations de comptes.":authMode==="create"?"Impossible de creer le compte. Le pseudo existe peut-etre deja.":"Pseudo ou mot de passe incorrect.");
      playTone("error"); return;
    }
    if (authMode==="login") { const l=await loadExisting(auth.data.user.id); setAuthLoading(false); if (!l){setMessage("Compte trouve, mais sauvegarde introuvable.");playTone("error");} return; }
    if (!auth.data.session) { setAuthLoading(false); setMessage("Desactive la confirmation email dans Supabase Auth."); playTone("error"); return; }
    const next=freshProfile(clean,auth.data.user.id);
    const {error} = await supabase.from("profiles").insert(next);
    setAuthLoading(false);
    if (error) { setMessage(error.code==="23505"?"Ce pseudo est deja pris.":"Impossible de creer le profil."); await supabase.auth.signOut(); playTone("error"); return; }
    setProfile(next); await loadLeaderboard(); playTone("save");
  }

  function handleClick(e: React.PointerEvent<HTMLButtonElement>) {
    if (!profile) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX-rect.left, y = e.clientY-rect.top;
    const nextCombo = combo+1;
    const comboBoost = 1+Math.min(nextCombo,60)*0.006;
    const snackBoost = 1+(profile.upgrades.snack??0)*0.08;
    const value = treatsPerClick*snackBoost*comboBoost;
    const hue = nextCombo%5===0 ? "var(--cs-gold, #9a7000)" : currentCat.accent;
    setCombo(nextCombo);
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(()=>setCombo(0), 1100);
    setPressed(true); window.setTimeout(()=>setPressed(false), 120);
    setPops(cur=>[...cur,{id:popId.current++,value,x,y,hue}].slice(-18));
    window.setTimeout(()=>setPops(cur=>cur.slice(1)), 800);
    updateProfile(cur=>({...cur,treats:cur.treats+value,lifetime_treats:cur.lifetime_treats+value,total_clicks:cur.total_clicks+1}));
    playMeow();
  }

  function buyUpgrade(upgrade: Upgrade) {
    if (!profile) return;
    const level = profile.upgrades[upgrade.id]??0;
    const cost = upgradeCost(upgrade,level);
    if (profile.treats<cost) { setMessage("Pas assez de croquettes 🐾"); playTone("error"); return; }
    updateProfile(cur=>{
      const levels={...cur.upgrades,[upgrade.id]:level+1};
      return {...cur,treats:cur.treats-cost,upgrades:levels,click_power:1+levels.paw+levels.laser*0.25,auto_rate:levels.cushion*0.8+levels.yarn*3+levels.portal*18+levels.factory*60,multiplier:1+levels.gloss*0.15+levels.nap*0.04+levels.chef*0.06+levels.constellation*0.1};
    });
    setMessage(`${upgrade.name} niveau ${level+1} !`);
    playTone("buy");
  }

  function switchCat(catId: CatId) { updateProfile(cur=>({...cur,selected_cat:catId})); playTone("buy"); }

  function levelUpCurrentCat() {
    if (!profile) return;
    const curLevel = profile.cat_levels[profile.selected_cat]??1;
    const cost = catLevelCost(curLevel,profile.rebirths);
    if (profile.treats<cost) { setMessage("Pas assez de croquettes pour level up."); playTone("error"); return; }
    updateProfile(cur=>({...cur,treats:cur.treats-cost,cat_levels:{...cur.cat_levels,[cur.selected_cat]:(cur.cat_levels[cur.selected_cat]??1)+1}}));
    setMessage(`${cats[profile.selected_cat].name} gagne un niveau ! 🐾`); playTone("buy");
  }

  function rebirth() {
    if (!profile) return;
    const cost = rebirthCost(profile.rebirths);
    if (profile.treats<cost) { setMessage(`Rebirth disponible a ${fmt.format(cost)} croquettes.`); playTone("error"); return; }
    updateProfile(cur=>({...cur,treats:0,click_power:1,auto_rate:0,multiplier:1,rebirths:cur.rebirths+1,upgrades:{...emptyUpgrades},cat_levels:{...emptyCatLevels}}));
    setMessage(`Rebirth +1 ! Multiplicateur permanent x${(1+(profile.rebirths+1)*0.35).toFixed(2)} 🔥`); playTone("save");
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    window.localStorage.removeItem(demoKey);
    setProfile(null); setUsername(""); setPassword(""); setMessage(""); setCombo(0);
  }

  const nextUpgrade = useMemo(()=>{
    if (!profile) return null;
    return upgrades.map(u=>({upgrade:u,level:profile.upgrades[u.id]??0,cost:upgradeCost(u,profile.upgrades[u.id]??0)})).sort((a,b)=>a.cost-b.cost)[0];
  },[profile]);

  const nextProgress = nextUpgrade&&profile ? Math.min(100,(profile.treats/nextUpgrade.cost)*100) : 0;

  // helpers for cat glow (theme-aware: lighter accents in dark mode)
  const catGlow = isDark
    ? (profile?.selected_cat==="grisou" ? "rgba(255,140,50,0.36)" : "rgba(255,85,119,0.32)")
    : currentCat.glow;

  // ---- LOADING ----
  if (loading) return (
    <main className={`cat-shell${isDark?" dark":""} grid place-items-center`}>
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="text-6xl" style={{animation:"gentleBob 1.4s ease-in-out infinite"}}>🐱</div>
        <p className="cat-panel rounded-full px-6 py-3 text-sm font-black uppercase tracking-widest">Chargement de la ferme...</p>
      </div>
    </main>
  );

  // ---- LOGIN SCREEN ----
  if (!profile) return (
    <main className={`cat-shell${isDark?" dark":""}`}>
      <div className="relative z-10 flex h-full flex-col overflow-y-auto">
        <div className="flex-1 grid place-items-center px-4 py-6">
          <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-[1fr_400px]">
            <div className="flex flex-col justify-center gap-5">
              <div className="flex items-center gap-2">
                <span className="text-3xl">🐾</span>
                <span className="cat-panel rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] cs-orange">Le meilleur jeu de chats</span>
              </div>
              <h1 className="text-5xl font-black leading-[0.88] sm:text-7xl lg:text-8xl">
                Grisou
                <span className="block bg-[linear-gradient(90deg,#c86000,#cc2850,#987000,#6a40b0)] bg-clip-text text-transparent">X Ronron</span>
              </h1>
              <p className="text-sm font-bold cs-dim max-w-sm">Clique sur tes chats, collecte des croquettes, domine le classement.</p>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                {Object.entries(cats).map(([id,cat])=>(
                  <div key={id} className="cat-panel group overflow-hidden rounded-[24px] p-2.5">
                    <div className="overflow-hidden rounded-[18px]">
                      <Image src={cat.src} alt={cat.name} width={400} height={400} className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" priority />
                    </div>
                    <div className="flex items-center justify-between px-2 pt-2.5 text-xs font-black">
                      <span>{cat.name}</span>
                      <span style={{color:isDark?cat.accent:cat.accent.replace("#c8","#a0").replace("#cc","#a0")}} className="opacity-80">{cat.vibe}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="cat-btn rounded-2xl px-5 py-2.5 text-sm" href="/clicker">Mode clicker</Link>
                <Link className="cat-btn-pink rounded-2xl px-5 py-2.5 text-sm" href="/duel">Mode duel</Link>
              </div>
            </div>

            <form onSubmit={handleStart} className="cat-panel rounded-[28px] p-4 flex flex-col gap-3">
              <div className="rounded-[20px] border p-4 flex flex-col gap-3" style={{borderColor:"var(--cs-panel-b)",background:"var(--cs-card)"}}>
                <p className="cat-eyebrow">Connexion 🐱</p>
                <div className="grid grid-cols-2 gap-1.5 rounded-2xl p-1" style={{background:"var(--cs-card)"}}>
                  {(["login","create"] as const).map(mode=>(
                    <button key={mode} type="button" onClick={()=>{setAuthMode(mode);setMessage("");}}
                      className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-black transition ${authMode===mode?"cat-btn":"cs-dim"}`}>
                      {mode==="login"?<><LogIn className="h-4 w-4"/>Se connecter</>:<><UserPlus className="h-4 w-4"/>Créer</>}
                    </button>
                  ))}
                </div>
                <label htmlFor="username" className="block text-2xl font-black leading-tight">
                  {authMode==="login"?"Retrouve ta ferme":"Crée ta ferme"}
                </label>
                <input id="username" value={username} onChange={e=>setUsername(e.target.value)}
                  className="h-12 w-full rounded-xl border px-4 text-lg font-black outline-none transition focus:ring-2"
                  style={{background:"var(--cs-input-bg)",color:"var(--cs-input-text)",borderColor:"var(--cs-panel-b)"}}
                  maxLength={18} placeholder="Pseudo" autoComplete="username" />
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 cs-xdim" style={{color:"var(--cs-text-xdim)"}} />
                  <input id="password" value={password} onChange={e=>setPassword(e.target.value)}
                    className="h-12 w-full rounded-xl border px-10 text-lg font-black outline-none transition focus:ring-2"
                    style={{background:"var(--cs-input-bg)",color:"var(--cs-input-text)",borderColor:"var(--cs-panel-b)"}}
                    minLength={6} type="password" placeholder="Mot de passe" autoComplete={authMode==="login"?"current-password":"new-password"} />
                </div>
                <button disabled={authLoading} className="cat-btn flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base disabled:cursor-wait disabled:opacity-70">
                  {authMode==="login"?<LogIn className="h-4 w-4"/>:<UserPlus className="h-4 w-4"/>}
                  {authLoading?"Chargement...":authMode==="login"?"Jouer 🐾":"Créer le compte"}
                </button>
              </div>
              <p className="rounded-2xl px-3 py-2.5 text-xs font-bold cs-dim" style={{background:"var(--cs-card)",border:"1px solid var(--cs-card-b)"}}>
                {isSupabaseMisconfigured?"URL Supabase incorrecte.":isSupabaseConfigured?"Supabase actif — pseudos uniques, classement global.":"Mode démo local — ajoute Supabase pour le multi."}
              </p>
              {message&&<p className="rounded-2xl px-3 py-2.5 text-sm font-black" style={{background:"var(--cs-err-bg)",color:"var(--cs-err-text)"}}>{message}</p>}
              <button type="button" onClick={()=>setIsDark(v=>!v)} className="cat-icon-btn self-end">
                {isDark?<Sun className="h-4 w-4"/>:<Moon className="h-4 w-4"/>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );

  // ---- GAME SCREEN ----
  return (
    <main className={`cat-shell${isDark?" dark":""}`}>
      {Object.values(remoteCursors).map(cursor=>(
        <div key={cursor.id} className="pointer-events-none fixed z-50 rounded-full px-2.5 py-1 text-xs font-black shadow-xl transition-transform duration-75"
          style={{left:`${cursor.x*100}%`,top:`${cursor.y*100}%`,backgroundColor:cursor.color,color:"#fff",transform:"translate(10px,10px)"}}>
          <MousePointer2 className="mr-1 inline h-3 w-3"/>{cursor.username}
        </div>
      ))}

      <div className="relative z-10 flex h-full flex-col">
        {/* ===== HEADER ===== */}
        <header className="cat-panel shrink-0 flex items-center gap-2 rounded-none border-0 border-b px-3 py-2" style={{borderColor:"var(--cs-panel-b)"}}>
          <span className="text-lg shrink-0">🐱</span>
          <span className="truncate text-sm font-black cs-orange mr-2">{profile.username}</span>
          {combo>1&&(
            <div className="hidden sm:flex rounded-xl px-2.5 py-1 text-xs font-black shrink-0"
              style={{background:combo>=25?"var(--cs-gold)":combo>=10?"var(--cs-orange)":"var(--cs-card)",color:combo>=10?"#fff8f0":"var(--cs-orange)",border:"1px solid var(--cs-card-b)"}}>
              ×{combo}{combo>=25?"🔥🔥":combo>=10?"🔥":""}
            </div>
          )}
          <div className="flex-1"/>
          <Link className="cat-panel rounded-xl px-3 py-1.5 text-xs font-black transition hover:opacity-80 hidden sm:block" href="/clicker">Clicker</Link>
          <Link className="cat-panel rounded-xl px-3 py-1.5 text-xs font-black transition hover:opacity-80 hidden sm:block" href="/duel">Duel</Link>
          <button title="Son" onClick={()=>setSoundOn(v=>!v)} className="cat-icon-btn">{soundOn?<Volume2 className="h-4 w-4"/>:<Music2 className="h-4 w-4"/>}</button>
          <button title={isDark?"Mode clair":"Mode sombre"} onClick={()=>setIsDark(v=>!v)} className="cat-icon-btn">{isDark?<Sun className="h-4 w-4"/>:<Moon className="h-4 w-4"/>}</button>
          <button title="Sauvegarder" onClick={()=>saveProfile(profile,false)} className="cat-icon-btn"><Save className="h-4 w-4"/>{saving&&<span className="sr-only">...</span>}</button>
          <button title="Quitter" onClick={signOut} className="cat-icon-btn"><LogOut className="h-4 w-4"/></button>
        </header>

        {/* ===== BODY ===== */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT: cats + stats */}
          <aside className={`flex-col overflow-y-auto overflow-x-hidden w-full lg:w-52 lg:shrink-0 p-3 gap-3 border-r ${activeTab==="stats"?"flex":"hidden"} lg:flex`} style={{borderColor:"var(--cs-panel-b)",background:"transparent"}}>
            {/* Cat selection */}
            <div className="cat-panel rounded-[20px] p-3">
              <p className="cat-eyebrow mb-2.5">Chats</p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                {Object.entries(cats).map(([id,cat])=>(
                  <button key={id} onClick={()=>switchCat(id as CatId)}
                    className={`grid grid-cols-[48px_1fr] lg:grid-cols-[56px_1fr] items-center gap-2.5 rounded-[16px] border p-2 text-left font-black transition`}
                    style={profile.selected_cat===id
                      ?{borderColor:isDark?"#ff8c32":cat.accent,background:isDark?"rgba(255,140,50,0.12)":"rgba(200,100,0,0.08)"}
                      :{borderColor:"var(--cs-panel-b)",background:"transparent"}}>
                    <Image src={cat.src} alt={cat.name} width={100} height={100} className="aspect-square w-full rounded-[12px] object-cover"/>
                    <span>
                      <span className="block text-xs">{cat.name}</span>
                      <span className="block text-[10px] cs-dim">lvl {fmt.format(profile.cat_levels[id as CatId]??1)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="cat-panel rounded-[20px] p-3">
              <p className="cat-eyebrow mb-2.5">Stats</p>
              <div className="grid grid-cols-2 gap-1.5">
                <StatChip label="Clics"    value={fmt.format(profile.total_clicks)}/>
                <StatChip label="Niveaux"  value={fmt.format(totalUpgradeLevels)}/>
                <StatChip label="Rebirths" value={fmt.format(profile.rebirths)}/>
                <StatChip label={`${currentCat.name} niv`} value={fmt.format(activeCatLevel)}/>
                <StatChip label="/clic"    value={fmt.format(Math.floor(treatsPerClick))}/>
                <StatChip label="auto/s"   value={passiveGain.toFixed(1)}/>
              </div>
              {message&&<p className="mt-2 rounded-xl px-2.5 py-2 text-[11px] font-black" style={{background:"var(--cs-err-bg)",color:"var(--cs-err-text)"}}>{message}</p>}
            </div>

            {/* Leaderboard */}
            <div className="cat-panel rounded-[20px] p-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Trophy className="h-4 w-4 cs-gold" style={{color:"var(--cs-gold)"}}/>
                <p className="cat-eyebrow">Classement</p>
              </div>
              <div className="grid gap-1.5">
                {(leaderboard.length?leaderboard:[profile]).slice(0,5).map((item,i)=>(
                  <div key={item.id} className={`grid grid-cols-[1fr_auto] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-black`}
                    style={item.id===profile.id?{background:"var(--cs-card)",border:"1px solid var(--cs-orange)"}:{background:"var(--cs-card)",border:"1px solid var(--cs-card-b)"}}>
                    <span className="truncate">{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`} {item.username}</span>
                    <span className="cs-gold" style={{color:"var(--cs-gold)"}}>{fmt.format(item.treats)}</span>
                  </div>
                ))}
              </div>
            </div>

            {!isSupabaseConfigured&&<p className="rounded-2xl px-3 py-2 text-[10px] font-bold cs-xdim" style={{background:"var(--cs-card)",border:"1px solid var(--cs-card-b)"}}>Classement global disponible avec Supabase.</p>}
          </aside>

          {/* CENTER: main click area */}
          <section className={`flex-1 flex-col overflow-hidden px-3 py-2 gap-2 ${activeTab==="play"?"flex":"hidden"} lg:flex`}>
            {/* Stats row — NO duplicate treats */}
            <div className="cat-card shrink-0 rounded-[16px] px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <MiniStat label="clic"  value={`+${fmt.format(Math.floor(treatsPerClick))}`}/>
                <MiniStat label="auto"  value={`${passiveGain.toFixed(1)}/s`}/>
                {combo>1&&<MiniStat label="combo" value={`×${combo}${combo>=25?"🔥":""}`} highlight/>}
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-wider cat-eyebrow">croquettes</p>
                <p className="text-xl font-black leading-tight sm:text-3xl">{fmt.format(Math.floor(profile.treats))}</p>
              </div>
            </div>

            {/* Cat button */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden min-h-0">
              <div className="absolute rounded-full pointer-events-none" style={{width:"min(55vw,420px)",height:"min(55vw,420px)",background:`radial-gradient(circle, ${catGlow} 0%, transparent 70%)`,animation:"glowPulse 2.5s ease-in-out infinite"}}/>
              <button onPointerDown={handleClick}
                className="relative max-h-full max-w-full outline-none select-none"
                style={{width:"min(68vw, min(calc(100vh - 18rem), 440px))",aspectRatio:"1/1"}}>
                <Image src={currentCat.src} alt={currentCat.name} width={880} height={880} priority draggable={false}
                  className={`relative z-10 w-full h-full object-cover rounded-[28px] select-none shadow-[0_16px_50px_rgba(0,0,0,0.25)] transition-all duration-[110ms] ${pressed?"scale-[.91] rotate-[-1.5deg] brightness-110 saturate-150":"hover:scale-[1.02]"}`}
                  style={{animation:pressed?undefined:"gentleBob 3.2s ease-in-out infinite",boxShadow:`0 0 0 3px ${isDark?currentCat.accent+"66":currentCat.accent+"44"}, 0 16px 50px rgba(0,0,0,0.25)`}}
                />
                {pops.map(pop=>(
                  <span key={pop.id} className="pointer-events-none absolute z-20 rounded-full px-3 py-1.5 text-lg font-black shadow-lg"
                    style={{left:pop.x,top:pop.y,backgroundColor:pop.hue,color:"#fff8f0",animation:"floatUp 800ms cubic-bezier(.15,.9,.2,1) forwards"}}>
                    +{fmt.format(Math.floor(pop.value))} 🐾
                  </span>
                ))}
              </button>
            </div>

            {/* Progress bar */}
            <div className="cat-card shrink-0 rounded-[16px] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                <p className="font-black">{currentCat.name} — {currentCat.vibe} — lvl {activeCatLevel}</p>
                {nextUpgrade&&<p className="cs-dim font-black" style={{color:"var(--cs-text-dim)"}}>Prochain : {fmt.format(nextUpgrade.cost)} 🐾</p>}
              </div>
              <div className="h-2.5 overflow-hidden rounded-full" style={{background:"var(--cs-card-b)"}}>
                <div className="h-full rounded-full transition-all duration-300" style={{width:`${nextProgress}%`,background:"var(--cs-orange)"}}/>
              </div>
            </div>
          </section>

          {/* RIGHT: shop — wider on large screens */}
          <aside className={`flex-col w-full lg:w-80 xl:w-96 lg:shrink-0 border-l overflow-hidden ${activeTab==="shop"?"flex":"hidden"} lg:flex`} style={{borderColor:"var(--cs-panel-b)"}}>
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b" style={{borderColor:"var(--cs-panel-b)"}}>
              <div className="flex items-center gap-2"><span className="text-lg">🛒</span><p className="cat-eyebrow">Boutique</p></div>
              <Coins className="h-5 w-5" style={{color:"var(--cs-gold)"}}/>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2.5">
              <div className="grid gap-2.5">

                {/* Level up cat */}
                <ShopItem
                  affordable={profile.treats>=catLevelCost(activeCatLevel,profile.rebirths)}
                  onClick={levelUpCurrentCat}
                  icon={<Cat className="h-5 w-5"/>}
                  iconBg="#1a5fa0"
                  title={`Level up ${currentCat.name}`}
                  sub={`niv ${activeCatLevel} — +12% bonus`}
                  cost={fmt.format(catLevelCost(activeCatLevel,profile.rebirths))}
                />

                {/* Rebirth */}
                <ShopItem
                  affordable={profile.treats>=rebirthCost(profile.rebirths)}
                  onClick={rebirth}
                  icon={<Flame className="h-5 w-5"/>}
                  iconBg="#987000"
                  title="Rebirth 🔥"
                  sub="reset upgrades — +35% permanent"
                  cost={fmt.format(rebirthCost(profile.rebirths))}
                />

                {/* Upgrades */}
                {upgrades.map(upgrade=>{
                  const level=profile.upgrades[upgrade.id]??0;
                  const cost=upgradeCost(upgrade,level);
                  const affordable=profile.treats>=cost;
                  const progress=Math.min(100,(profile.treats/cost)*100);
                  const Icon=upgrade.icon;
                  return (
                    <button key={upgrade.id} onClick={()=>buyUpgrade(upgrade)}
                      className={`rounded-[18px] border p-3.5 text-left transition active:translate-y-0.5 ${affordable?"can-afford":""}`}
                      style={{borderColor:affordable?"var(--cs-orange)":"var(--cs-card-b)",background:"var(--cs-card)"}}>
                      <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-[14px]" style={{backgroundColor:upgrade.tint}}>
                          <Icon className="h-5 w-5" style={{color:"#fff8f0"}}/>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-black">{upgrade.name}</span>
                          <span className="block text-xs font-bold cs-dim" style={{color:"var(--cs-text-dim)"}}>niv {level} — {upgrade.effect(level)}</span>
                        </span>
                        <span className="rounded-xl px-3 py-2 text-sm font-black whitespace-nowrap" style={{background:"var(--cs-icon-bg)",border:"1px solid var(--cs-icon-b)"}}>{fmt.format(cost)}</span>
                      </div>
                      <p className="mt-2.5 text-xs font-bold cs-xdim" style={{color:"var(--cs-text-xdim)"}}>{upgrade.description}</p>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{background:"var(--cs-card-b)"}}>
                        <div className="h-full rounded-full transition-all duration-300" style={{width:`${progress}%`,backgroundColor:upgrade.tint}}/>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        {/* MOBILE TAB BAR */}
        <nav className="cat-tab-bar lg:hidden shrink-0 grid grid-cols-3">
          {([{id:"play",icon:"🐱",label:"Jouer"},{id:"shop",icon:"🛒",label:"Shop"},{id:"stats",icon:"🏆",label:"Stats"}] as const).map(({id,icon,label})=>(
            <button key={id} onClick={()=>setActiveTab(id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-black transition border-t-2`}
              style={{color:activeTab===id?"var(--cs-orange)":"var(--cs-text-xdim)",borderColor:activeTab===id?"var(--cs-orange)":"transparent"}}>
              <span className="text-xl">{icon}</span>{label}
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}

function StatChip({label,value}:{label:string;value:string}) {
  return (
    <div className="rounded-xl px-2.5 py-2" style={{background:"var(--cs-card)",border:"1px solid var(--cs-card-b)"}}>
      <p className="text-[9px] font-black uppercase tracking-[0.14em] cat-eyebrow">{label}</p>
      <p className="truncate text-sm font-black">{value}</p>
    </div>
  );
}

function MiniStat({label,value,highlight}:{label:string;value:string;highlight?:boolean}) {
  return (
    <div className="rounded-xl px-3 py-1.5 text-center" style={{background:"var(--cs-card)",border:`1px solid ${highlight?"var(--cs-orange)":"var(--cs-card-b)"}`}}>
      <p className="text-[9px] font-black uppercase tracking-wider cat-eyebrow">{label}</p>
      <p className="text-sm font-black" style={{color:highlight?"var(--cs-orange)":undefined}}>{value}</p>
    </div>
  );
}

function ShopItem({affordable,onClick,icon,iconBg,title,sub,cost}:{affordable:boolean;onClick:()=>void;icon:React.ReactNode;iconBg:string;title:string;sub:string;cost:string}) {
  return (
    <button onClick={onClick}
      className={`rounded-[18px] border p-3.5 text-left transition active:translate-y-0.5 ${affordable?"can-afford":""}`}
      style={{borderColor:affordable?"var(--cs-orange)":"var(--cs-card-b)",background:"var(--cs-card)"}}>
      <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-[14px]" style={{backgroundColor:iconBg}}>
          <span style={{color:"#fff8f0"}}>{icon}</span>
        </span>
        <span>
          <span className="block text-[15px] font-black">{title}</span>
          <span className="block text-xs font-bold cs-dim" style={{color:"var(--cs-text-dim)"}}>{sub}</span>
        </span>
        <span className="rounded-xl px-3 py-2 text-sm font-black whitespace-nowrap" style={{background:"var(--cs-icon-bg)",border:"1px solid var(--cs-icon-b)"}}>{cost}</span>
      </div>
    </button>
  );
}
