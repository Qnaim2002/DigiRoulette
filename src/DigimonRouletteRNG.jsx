import React, {useState, useEffect, useRef} from "react";
import Papa from "papaparse";
import {sfx} from "./utils/audio";

const URLS = {
  STARTERS:   "https://docs.google.com/spreadsheets/d/e/2PACX-1vQnn90HQjoCBCPbb9Y35juXme0I3Xdyd9JDJe91SwRI26IGVMT4EO-kSH7HU4i10c3_L8JXGAoKtgI8/pub?gid=0&single=true&output=csv",
  WILD:       "https://docs.google.com/spreadsheets/d/e/2PACX-1vQnn90HQjoCBCPbb9Y35juXme0I3Xdyd9JDJe91SwRI26IGVMT4EO-kSH7HU4i10c3_L8JXGAoKtgI8/pub?gid=1732577563&single=true&output=csv",
  EGGS:       "https://docs.google.com/spreadsheets/d/e/2PACX-1vQnn90HQjoCBCPbb9Y35juXme0I3Xdyd9JDJe91SwRI26IGVMT4EO-kSH7HU4i10c3_L8JXGAoKtgI8/pub?gid=1281144117&single=true&output=csv",
  LEGENDARY:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQnn90HQjoCBCPbb9Y35juXme0I3Xdyd9JDJe91SwRI26IGVMT4EO-kSH7HU4i10c3_L8JXGAoKtgI8/pub?gid=2023870481&single=true&output=csv",
  VILLAINS:   "https://docs.google.com/spreadsheets/d/e/2PACX-1vQnn90HQjoCBCPbb9Y35juXme0I3Xdyd9JDJe91SwRI26IGVMT4EO-kSH7HU4i10c3_L8JXGAoKtgI8/pub?gid=1466808519&single=true&output=csv",
  EVOLUTIONS: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQnn90HQjoCBCPbb9Y35juXme0I3Xdyd9JDJe91SwRI26IGVMT4EO-kSH7HU4i10c3_L8JXGAoKtgI8/pub?gid=1064530306&single=true&output=csv",
  BOSSES:     "https://docs.google.com/spreadsheets/d/e/2PACX-1vQnn90HQjoCBCPbb9Y35juXme0I3Xdyd9JDJe91SwRI26IGVMT4EO-kSH7HU4i10c3_L8JXGAoKtgI8/pub?gid=926401702&single=true&output=csv",
};

export const STAGE_STATS = {
  "Baby":    {maxHp: 70,  power: 1},
  "Child":   {maxHp: 130, power: 3},
  "Adult":   {maxHp: 200, power: 4},
  "Perfect": {maxHp: 300, power: 5},
  "Ultimate":{maxHp: 410, power: 6},
  "Ultra":   {maxHp: 550, power: 7},
  "Armor":   {maxHp: 180, power: 4},
  "Unknown": {maxHp: 130, power: 3},
  "Hybrid":  {maxHp: 270, power: 5}
};

// ✅ RNG MODE: no Shop/Digi Coin — Potion & Item drops are back on the wheel, plus a new
// Evolution Chip drop fixed at 10%. The other 6 entries are the original pre-Shop weights
// scaled by 0.9 (proportionally preserved) so everything still sums to 100.
export const WORLD_WHEEL = [
  {type: "WILD",      label: "⚔️ Encounter Wild Digimon",  weight: 25.2},
  {type: "TRAIN",     label: "🏋️ Train & Evolve Partner",   weight: 17.1},
  {type: "EGG",       label: "🥚 Search for Digi-Egg",      weight: 12.6},
  {type: "POTION",    label: "🧪 Buy a Potion",              weight: 13.5},
  {type: "LEGENDARY", label: "👑 Encounter Legendary Mega",  weight: 7.2},
  {type: "ITEM",      label: "💎 Find Battle Item Mod",      weight: 14.4},
  {type: "EVOCHIP",   label: "🧬 Found Evolution Chip",      weight: 10}
];

export const POTION_WHEEL = [
  {type: "POTION_1", label: "🧪 2 Potions", weight: 54, amount: 2},
  {type: "POTION_2", label: "🧪 3 Potions", weight: 28, amount: 3},
  {type: "POTION_3", label: "🧪 4 Potions", weight: 18, amount: 4}
];

// ✅ "Find Battle Item Mod" pool — Escape Portal now drops here instead of being purchased,
// all four items at equal 25% odds
export const ITEM_DROP_POOL = [
  {type: "CHIP_STRENGTH",  label: "💪 Overdrive Chip",  weight: 25},
  {type: "CHIP_ENDURANCE", label: "🛡️ Shield Matrix",   weight: 25},
  {type: "REVIVE_POTION",  label: "✨ Revive Potion",   weight: 25},
  {type: "ESCAPE_PORTAL",  label: "🌀 Escape Portal",   weight: 25}
];

// ✅ "Found Evolution Chip" pool — resolves which tier of chip is found
export const EVOCHIP_DROP_POOL = [
  {type: "evoChipBasic", label: "🧬 Evolution Chip",       weight: 40},
  {type: "evoChipSuper", label: "🧬 Super Evolution Chip", weight: 30},
  {type: "evoChipMega",  label: "🧬 Mega Evolution Chip",  weight: 20},
  {type: "evoChipUltra", label: "🧬 Ultra Evolution Chip", weight: 10}
];

// ✅ Evolution chip identity — defined locally (not derived from a Shop catalog) so this file
// has zero dependency on the Shop-mode file and can be edited completely independently.
const EVO_CHIP_DEFS = [
  {key: "evoChipBasic", label: "Evolution Chip",       evoTier: "Child"},
  {key: "evoChipSuper", label: "Super Evolution Chip", evoTier: "Adult"},
  {key: "evoChipMega",  label: "Mega Evolution Chip",  evoTier: "Perfect"},
  {key: "evoChipUltra", label: "Ultra Evolution Chip", evoTier: "Ultimate"},
];
// ✅ Maps a Digimon's current tier to the chip needed to instantly evolve it
export const EVO_CHIP_FOR_LEVEL = Object.fromEntries(EVO_CHIP_DEFS.map((i) => [i.evoTier, i.key]));
export const EVO_CHIP_LABEL = Object.fromEntries(EVO_CHIP_DEFS.map((i) => [i.key, i.label]));
// ✅ Reverse of the above: chip key -> the tier it targets (used to highlight eligible Digimon)
export const EVO_CHIP_TARGET_TIER = Object.fromEntries(EVO_CHIP_DEFS.map((i) => [i.key, i.evoTier]));
export const EVO_CHIP_KEYS = EVO_CHIP_DEFS.map((i) => i.key);

export const RESERVE_CAPACITY = 6;

export const COMBAT_WHEEL_PLAYER = [
  {type: "ATTACK",   label: "💥 Normal Attack", weight: 50},
  {type: "CRITICAL", label: "🔥 Critical Hit!",  weight: 20},
  {type: "MISS",     label: "💨 Miss/Defend",    weight: 30},
];

export const COMBAT_WHEEL_ENEMY = [
  {type: "ATTACK",   label: "💥 Normal Attack",        weight: 40},
  {type: "CRITICAL", label: "🔥 Critical Hit!",         weight: 15},
  {type: "MISS",     label: "💨 Miss/Defend",           weight: 25},
  {type: "HEAL",     label: "💚 Circuit Repair (Heal)", weight: 20},
];

export const WHEEL_COLORS = ["#3498db","#e67e22","#2ecc71","#9b59b6","#e74c3c","#f1c40f","#1abc9c"];

// ✅ Classic Digimon attribute triangle: Vaccine beats Virus, Virus beats Data, Data beats Vaccine.
// Attacking with the advantaged attribute grants a damage bonus; attacking into a disadvantage
// (i.e. the defender's attribute beats yours) applies a damage penalty instead.
export const ATTRIBUTE_ADVANTAGE = {
  "Vaccine": "Virus",
  "Virus": "Data",
  "Data": "Vaccine",
};
export const ATTRIBUTE_EMOJI = {
  "Vaccine": "💉",
  "Virus": "🦠",
  "Data": "💾",
  "Free": "🔷",
  "Variable": "🔶",
};
export function getAttributeEmoji(attr) {
  return ATTRIBUTE_EMOJI[attr] || "❓";
}
export const ATTRIBUTE_DAMAGE_BONUS = 1.10;
export const ATTRIBUTE_DAMAGE_PENALTY = 0.90;
function hasAttributeAdvantage(attackerAttr, defenderAttr) {
  return ATTRIBUTE_ADVANTAGE[attackerAttr] === defenderAttr;
}
function hasAttributeDisadvantage(attackerAttr, defenderAttr) {
  return ATTRIBUTE_ADVANTAGE[defenderAttr] === attackerAttr;
}

const CHRONOMON_DM_NAME = "Chronomon DM";
export const SAVE_KEY = "digiroulette_save_rng";
export const BESTIARY_KEY = "digiroulette_bestiary_rng";
export const HIGHSCORE_KEY = "digiroulette_highscore_rng";
export const LEADERBOARD_KEY = "digiroulette_leaderboard_rng";

// ✅ Local leaderboard: keeps the best 5 runs (by score) with a bit of context per run
export function addToLeaderboard({score, wave, victory}) {
  try {
    const current = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
    const rank = getRank(score);
    const entry = {score, wave, victory: !!victory, rankLabel: `${rank.rank} — ${rank.label}`, date: Date.now()};
    const updated = [...current, entry].sort((a, b) => b.score - a.score).slice(0, 5);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function getLeaderboard() {
  try {return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");} catch {return [];}
}

export const SCORE_EVENTS = {
  WILD_DEFEATED:      50,
  VILLAIN_WAVE:       100,
  WAVE_NO_ITEMS:      200,
  WILD_CAPTURED:      150,
  LEGENDARY_CAPTURED: 300,
  CHRONOMON_DEFEATED: 500,
};

export const SCORE_RANKS = [
  {min: 10000, rank: "SS", label: "Chrono Savior"},
  {min: 8000,  rank: "S",  label: "Legendary Tamer"},
  {min: 5000,  rank: "A",  label: "Elite Commander"},
  {min: 2500,  rank: "B",  label: "Senior Tamer"},
  {min: 1000,  rank: "C",  label: "Field Agent"},
  {min: 0,     rank: "D",  label: "Rookie Tamer"},
];

export function getRank(score) {
  return SCORE_RANKS.find((r) => score >= r.min) || SCORE_RANKS[SCORE_RANKS.length - 1];
}

function loadBestiary() {
  try {return JSON.parse(localStorage.getItem(BESTIARY_KEY) || "[]");} catch {return [];}
}

// ✅ Only called on capture and egg hatch — not on encounter/battle
function saveBestiaryEntry(name) {
  try {
    const current = loadBestiary();
    if (!current.includes(name)) localStorage.setItem(BESTIARY_KEY, JSON.stringify([...current, name]));
  } catch {}
}

function loadSave() {
  try {return JSON.parse(localStorage.getItem(SAVE_KEY) || "null");} catch {return null;}
}

function clearSave() {
  try {localStorage.removeItem(SAVE_KEY);} catch {}
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickUniqueRandom(pool, count, recentlyUsed = []) {
  if (!pool.length) return [];
  const preferred = pool.filter((n) => !recentlyUsed.includes(n));
  const source = preferred.length >= count ? preferred : pool;
  const shuffled = shuffleArray(source);
  const picks = [];
  for (let i = 0; i < count; i++) picks.push(shuffled[i % shuffled.length]);
  return picks;
}

// ✅ SPECIES STAT VARIANCE: deterministic ±15% hp/power multiplier hashed from the Digimon's
// name, so two Digimon sharing a tier no longer have identical stats. Same species always
// gets the same multiplier — it's stable, not re-rolled per encounter. Applied only where a
// Digimon's stats are first built from the sheet (findDigimonInSheetData/fallbackStatsObject),
// so Legendary encounters and the Wave 8 boss — which explicitly force fixed stats afterward —
// stay untouched by it, on purpose.
function hashNameToUnit(name) {
  let hash = 0;
  const str = name || "";
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000; // 0 .. 0.999
}
function getStatVariance(name) {
  return 0.85 + hashNameToUnit(name) * 0.30; // 0.85 .. 1.15
}

// ✅ DIFFICULTY: a single global Easy/Normal/Hard toggle (shared with Shop mode via the same
// localStorage key, set from the Settings modal). Scales every enemy's hp/power — including
// Legendary and the boss, unlike species variance above — and nudges capture/evolution odds.
// Never touches the player's own party.
const DIFFICULTY_KEY = "digiroulette_difficulty";
const DIFFICULTY_LEVELS = {
  easy:   {enemyMult: 0.85, oddsMult: 1.15},
  normal: {enemyMult: 1.00, oddsMult: 1.00},
  hard:   {enemyMult: 1.15, oddsMult: 0.85},
};
function getDifficultySettings() {
  try {
    const saved = localStorage.getItem(DIFFICULTY_KEY) || "normal";
    return DIFFICULTY_LEVELS[saved] || DIFFICULTY_LEVELS.normal;
  } catch {
    return DIFFICULTY_LEVELS.normal;
  }
}
function scaleEnemyForDifficulty(digi) {
  const {enemyMult} = getDifficultySettings();
  const scaledHp = Math.max(1, Math.round(digi.maxHp * enemyMult));
  const scaledPower = Math.max(1, Math.round(digi.power * enemyMult));
  return {...digi, hp: scaledHp, maxHp: scaledHp, baseMaxHp: scaledHp, power: scaledPower};
}
function scaleOddsForDifficulty(basePercent) {
  const {oddsMult} = getDifficultySettings();
  return Math.max(5, Math.min(95, Math.round(basePercent * oddsMult)));
}

const DEFAULT_INVENTORY = {potion: 4, chipStrength: 2, chipEndurance: 2, revivePotion: 3, evoChipBasic: 0, evoChipSuper: 0, evoChipMega: 0, evoChipUltra: 0, escapePortal: 1};
const DEFAULT_BUFFS = {strengthMultiplier: 1.0, enduranceMultiplier: 1.0};

export function useDigimonGame(autoResume = false) {
  const [db, setDb] = useState([]);
  const [starters, setStarters] = useState([]);
  const [catchablePool, setCatchablePool] = useState(["Veemon"]);
  const [babyPool, setBabyPool] = useState(["Botamon"]);
  const [legendaryPool, setLegendaryPool] = useState(["Omegamon"]);
  const [villainPool, setVillainPool] = useState([]);
  const [bossPool, setBossPool] = useState([CHRONOMON_DM_NAME]);
  const [fullRoster, setFullRoster] = useState([]);

  const [party, setParty] = useState([]);
  const [reserve, setReserve] = useState([]);
  const [inventory, setInventory] = useState(DEFAULT_INVENTORY);
  const [temporaryBuffs, setTemporaryBuffs] = useState(DEFAULT_BUFFS);

  const [phase, setPhase] = useState("loading");
  const [loadingMsg, setLoadingMsg] = useState("Synchronizing Multi-Array Databases...");
  const [log, setLog] = useState([]);
  const [announcement, setAnnouncement] = useState("Establishing cloud connections...");

  const [activeWheelType, setActiveWheelType] = useState("WORLD");
  const [wheelSegments, setWheelSegments] = useState(WORLD_WHEEL);
  const [pendingSubPool, setPendingSubPool] = useState([]);

  const [worldSpinCount, setWorldSpinCount] = useState(0);
  const [villainWaveStage, setVillainWaveStage] = useState(0);
  const [isVillainBattle, setIsVillainBattle] = useState(false);

  const [enemySquad, setEnemySquad] = useState([]);
  const [currentEnemyIdx, setCurrentEnemyIdx] = useState(0);
  const [isLegendaryBattle, setIsLegendaryBattle] = useState(false);
  const [isWildBattle, setIsWildBattle] = useState(false);
  const [lastDefeatedEnemy, setLastDefeatedEnemy] = useState(null);
  const [lastDefeatedEnemyTier, setLastDefeatedEnemyTier] = useState("Child");
  const [wildCaptureQueue, setWildCaptureQueue] = useState([]);
  const [pendingCapture, setPendingCapture] = useState(null); // {reward, onDone} | null
  const [combatTurn, setCombatTurn] = useState("PLAYER");

  const [score, setScore] = useState(0);
  const [waveUsedItems, setWaveUsedItems] = useState(false);
  const [evolvingPartyIdx, setEvolvingPartyIdx] = useState(null);
  const [evolvingReserveIdx, setEvolvingReserveIdx] = useState(null);
  const [evoAnimEnabled, setEvoAnimEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem("digiroulette_evo_anim");
      return stored === null ? true : stored === "true";
    } catch {return true;}
  });
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);
  const [enemyHitAnim, setEnemyHitAnim] = useState(null);
  const [playerHitAnim, setPlayerHitAnim] = useState(null);
  const [partyHealAnim, setPartyHealAnim] = useState(null);
  const [enemyHealAnim, setEnemyHealAnim] = useState(null);

  const recentVillainsRef = useRef({});
  const isEvolvingRef = useRef(false);

  const addLog = (msg) => setLog((prev) => [msg, ...prev]);
  const addScore = (points) => setScore((prev) => prev + points);
  const triggerEnemyHit = (isCrit = false, amount = 0) => setEnemyHitAnim({type: isCrit ? "crit" : "hit", ts: Date.now(), amount});
  const triggerPlayerHit = (isCrit = false, amount = 0) => setPlayerHitAnim({type: isCrit ? "crit" : "hit", ts: Date.now(), amount});
  const triggerPartyHeal = (idx, amount) => setPartyHealAnim({idx, amount, ts: Date.now()});
  const triggerEnemyHeal = (amount) => setEnemyHealAnim({amount, ts: Date.now()});
  // ✅ BUGFIX: clear leftover hit/heal state before starting a new encounter — otherwise a stale
  // float (e.g. from the previous enemy healing itself) would replay when the new enemy's
  // display subtree mounts, since the "no active threat" placeholder unmounts it in between.
  const resetCombatFloats = () => {
    setEnemyHitAnim(null);
    setEnemyHealAnim(null);
    setPlayerHitAnim(null);
    setPartyHealAnim(null);
  };

  const buildSaveState = () => ({
    party, reserve, inventory, log,
    worldSpinCount, villainWaveStage, isVillainBattle,
    enemySquad, currentEnemyIdx, isLegendaryBattle, isWildBattle,
    lastDefeatedEnemyTier, combatTurn, score, waveUsedItems,
    activeWheelType, wheelSegments, pendingSubPool, phase, announcement,
    recentVillains: recentVillainsRef.current,
    savedAt: Date.now(),
  });

  const persistSave = (state) => {
    try {localStorage.setItem(SAVE_KEY, JSON.stringify(state));} catch {}
  };

  const restoreFromSave = (save) => {
    setParty(save.party || []);
    setReserve(save.reserve || []);
    setInventory(save.inventory || DEFAULT_INVENTORY);
    setLog(save.log || []);
    setWorldSpinCount(save.worldSpinCount || 0);
    setVillainWaveStage(save.villainWaveStage || 0);
    setIsVillainBattle(save.isVillainBattle || false);
    setEnemySquad(save.enemySquad || []);
    setCurrentEnemyIdx(save.currentEnemyIdx || 0);
    setIsLegendaryBattle(save.isLegendaryBattle || false);
    setIsWildBattle(save.isWildBattle || false);
    setLastDefeatedEnemyTier(save.lastDefeatedEnemyTier || "Child");
    setCombatTurn(save.combatTurn || "PLAYER");
    setScore(save.score || 0);
    setWaveUsedItems(save.waveUsedItems || false);
    setActiveWheelType(save.activeWheelType || "WORLD");
    setWheelSegments(save.wheelSegments || WORLD_WHEEL);
    setPendingSubPool(save.pendingSubPool || []);
    setAnnouncement(save.announcement || "");
    recentVillainsRef.current = save.recentVillains || {};
    setPhase(save.phase || "world_wheel");
  };

  useEffect(() => {
    const fetchAndParse = (url) => new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true, header: true, skipEmptyLines: true,
        complete: (res) => resolve(res.data),
        error: (err) => reject(err)
      });
    });

    Promise.all([
      fetchAndParse(URLS.STARTERS),
      fetchAndParse(URLS.WILD),
      fetchAndParse(URLS.EGGS),
      fetchAndParse(URLS.LEGENDARY),
      fetchAndParse(URLS.VILLAINS),
      fetchAndParse(URLS.EVOLUTIONS),
      fetchAndParse(URLS.BOSSES)
    ])
    .then(([startersData, wildData, eggsData, legendaryData, villainsData, evolutionsData, bossesData]) => {
      const masterDatabase = [...startersData, ...wildData, ...eggsData, ...legendaryData, ...villainsData, ...evolutionsData, ...bossesData];
      setDb(masterDatabase);
      // ✅ fullRoster includes level for tier categorization in Bestiary
      setFullRoster(masterDatabase.map((d) => ({
        name: d.name,
        imageUrl: d.imageUrl || "",
        level: d.level || "Child"
      })));
      setStarters(startersData.map((d) => ({
        dapiName: d.name,
        displayLabel: d.name,
        image: d.imageUrl || `https://placehold.co/150x150/16171d/fff?text=${encodeURIComponent(d.name)}`
      })));
      setCatchablePool(wildData.length ? wildData.map((d) => d.name) : ["Veemon"]);
      setBabyPool(eggsData.length ? eggsData.map((d) => d.name) : ["Botamon"]);
      setLegendaryPool(legendaryData.length ? legendaryData.map((d) => d.name) : ["Omegamon"]);
      setVillainPool(villainsData);
      setBossPool(bossesData.length ? bossesData.map((d) => d.name) : [CHRONOMON_DM_NAME]);

      const save = loadSave();
      if (save && save.phase && save.phase !== "start") {
        if (autoResume) {
          restoreFromSave(save);
          addLog("▶️ Run resumed from saved state.");
          if (sfx.startBGM) sfx.startBGM(save.villainWaveStage === 8 ? "BOSS" : save.isVillainBattle ? "BATTLE" : "WORLD");
        } else {
          setPendingSave(save);
          setShowResumePrompt(true);
          setPhase("resume_prompt");
        }
      } else {
        setPhase("start");
        setAnnouncement("Select your partner to begin your journey!");
      }
      setLoadingMsg("");
    })
    .catch((err) => {
      console.error("Database sync failed:", err);
      setLoadingMsg("Failed to synchronize with one or more Google Sheet tabs.");
    });
  }, []);

  useEffect(() => {
    if (!["world_wheel","combat","sub_wheel","victory","game_over"].includes(phase)) return;
    persistSave(buildSaveState());
  }, [phase, party, reserve, inventory, worldSpinCount, villainWaveStage, score]);

  const handleResume = (yes) => {
    setShowResumePrompt(false);
    if (yes && pendingSave) {
      restoreFromSave(pendingSave);
      addLog("▶️ Run resumed from saved state.");
      if (sfx.startBGM) sfx.startBGM(pendingSave.villainWaveStage === 8 ? "BOSS" : pendingSave.isVillainBattle ? "BATTLE" : "WORLD");
    } else {
      clearSave();
      setPhase("start");
      setAnnouncement("Select your partner to begin your journey!");
    }
    setPendingSave(null);
  };

  const resetToStart = () => {
    setParty([]); setReserve([]);
    setInventory(DEFAULT_INVENTORY);
    setTemporaryBuffs(DEFAULT_BUFFS);
    setLog([]); setWorldSpinCount(0); setVillainWaveStage(0);
    setIsVillainBattle(false); setIsWildBattle(false);
    setEnemySquad([]); setCurrentEnemyIdx(0);
    setIsLegendaryBattle(false); setLastDefeatedEnemy(null);
    setLastDefeatedEnemyTier("Child");
    setWildCaptureQueue([]);
    setPendingCapture(null);
    setEnemyHitAnim(null); setPlayerHitAnim(null);
    setEnemyHealAnim(null); setPartyHealAnim(null);
    setScore(0); setWaveUsedItems(false);
    setEvolvingPartyIdx(null);
    setEvolvingReserveIdx(null);
    recentVillainsRef.current = {};
    isEvolvingRef.current = false;
    clearSave();
    if (sfx.stopBGM) sfx.stopBGM();
    setPhase("start");
    setCombatTurn("PLAYER");
    setAnnouncement("Select your partner to begin your journey!");
  };

  function findDigimonInSheetData(dapiName) {
    if (!dapiName) return fallbackStatsObject("Unknown");
    const matched = db.find((d) => d && d.name && d.name.toLowerCase().trim() === dapiName.toLowerCase().trim());
    if (matched) {
      let matchedLevel = matched.level || "Child";
      if (matchedLevel.toLowerCase().startsWith("baby")) matchedLevel = "Baby";
      const parsedHp = parseInt(matched.hp) || 100;
      const parsedPower = parseInt(matched.power) || 3;
      const variance = getStatVariance(matched.name);
      const variedHp = Math.max(1, Math.round(parsedHp * variance));
      const variedPower = Math.max(1, Math.round(parsedPower * variance));
      return {
        id: Math.floor(Math.random() * 100000) + Date.now(),
        name: matched.name, level: matchedLevel,
        attribute: matched.attribute || "Virus",
        image: matched.imageUrl || `https://placehold.co/150x150/16171d/fff?text=${encodeURIComponent(matched.name)}`,
        hp: variedHp, maxHp: variedHp, baseMaxHp: variedHp,
        power: variedPower, nextFormName: matched.nextEvolution || null
      };
    }
    return fallbackStatsObject(dapiName);
  }

  function fallbackStatsObject(dapiName) {
    const s = STAGE_STATS["Child"];
    const variance = getStatVariance(dapiName);
    const variedHp = Math.max(1, Math.round(s.maxHp * variance));
    const variedPower = Math.max(1, Math.round(s.power * variance));
    return {
      id: Math.floor(Math.random() * 100000) + Date.now(),
      name: dapiName, level: "Child", attribute: "Virus",
      image: `https://placehold.co/150x150/16171d/fff?text=${encodeURIComponent(dapiName)}`,
      hp: variedHp, maxHp: variedHp, baseMaxHp: variedHp,
      power: variedPower, nextFormName: null
    };
  }

  const chooseStarter = async (starterObj) => {
    if (!starterObj) return;
    setLoadingMsg(`Summoning ${starterObj.displayLabel || "Starter"}...`);
    try {
      const detailed = findDigimonInSheetData(starterObj.dapiName);
      // ✅ Starters do NOT fill bestiary — only captures and hatches do
      setParty([detailed]);
      addLog(`Selected ${detailed.name} as your partner!`);
      setPhase("world_wheel");
      setActiveWheelType("WORLD");
      setWheelSegments(WORLD_WHEEL);
      setWorldSpinCount(0); setScore(0);
      setAnnouncement("Roll the wheel to explore! (Nemesis Raid in 4 spins)");
      if (sfx.startBGM) sfx.startBGM("WORLD");
    } catch {
      addLog("Failed to process initialization.");
    } finally {
      setLoadingMsg("");
    }
  };

  const switchToWorldWheel = () => {
    if (isVillainBattle && villainWaveStage >= 8) {
      removeTemporaryBattleBuffs();
      const totalHp = party.reduce((sum, d) => sum + (d?.hp || 0), 0);
      const totalMaxHp = party.reduce((sum, d) => sum + (d?.maxHp || 1), 0);
      const multiplier = 1 + (totalHp / totalMaxHp);
      const finalScore = Math.round(score * multiplier);
      setScore(finalScore);
      try {
        const prev = parseInt(localStorage.getItem(HIGHSCORE_KEY) || "0");
        if (finalScore > prev) localStorage.setItem(HIGHSCORE_KEY, String(finalScore));
      } catch {}
      addToLeaderboard({score: finalScore, wave: 8, victory: true});
      setPhase("victory");
      setAnnouncement("👑 VICTORY! All 8 waves cleared! The Digital World is saved!");
      addLog("🏆 CHRONO CORE SECURED: Grand Nemesis threat terminated.");
      clearSave();
      return;
    }
    setIsVillainBattle(false); setIsWildBattle(false);
    if (worldSpinCount >= 4) {
      setWorldSpinCount(0);
      triggerForcedVillainBattle();
      return;
    }
    setPhase("world_wheel");
    setActiveWheelType("WORLD");
    setWheelSegments(WORLD_WHEEL);
    setAnnouncement(`Exploration clear. [Spins until Nemesis Raid: ${4 - worldSpinCount}]`);
    if (sfx.startBGM) sfx.startBGM("WORLD");
  };

  const executeEvolutionForIndex = async (index, member) => {
    // ✅ FIX 1: Guard — prevent re-entry if evolution animation already running
    if (isEvolvingRef.current) return false;
    if (!member) return false;
    const lookupDetails = findDigimonInSheetData(member.name);
    const nextFormName = lookupDetails.nextFormName;
    if (!nextFormName || nextFormName.toLowerCase().trim() === "peak form" || nextFormName.trim() === "") {
      addLog(`🏋️ ${member.name} has achieved peak physical output.`);
      return false;
    }
    isEvolvingRef.current = true; // 🔒 Lock — wheel can still spin, but evolution won't re-trigger
    const evolvedDetails = findDigimonInSheetData(nextFormName);

    if (evoAnimEnabled) {
      setLoadingMsg("Restructuring digital data blocks...");
      setEvolvingPartyIdx(index);
      if (sfx.playTransformSFX) sfx.playTransformSFX();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setParty((prevParty) => {
      const updated = [...prevParty];
      updated[index] = evolvedDetails;
      return updated;
    });
    addLog(`✨ EVOLUTION: ${member.name} → ${evolvedDetails.name}!`);
    setAnnouncement(`✨ Evolution Complete: ${member.name} → ${evolvedDetails.name}!`);

    if (evoAnimEnabled) {
      setLoadingMsg("");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setEvolvingPartyIdx(null);
    } else if (sfx.playTransformSFX) {
      sfx.playTransformSFX();
    }
    isEvolvingRef.current = false; // 🔓 Unlock
    return true;
  };

  const removeTemporaryBattleBuffs = () => {
    setTemporaryBuffs(DEFAULT_BUFFS);
    setParty((prevParty) => prevParty.map((member) => {
      const base = member.baseMaxHp || member.maxHp;
      return {...member, maxHp: base, hp: Math.min(member.hp, base)};
    }));
  };

  const triggerEvolutionSelectionOrExecution = (eligibleMembers) => {
    if (eligibleMembers.length === 0) return switchToWorldWheel();
    if (eligibleMembers.length === 1) {
      const target = eligibleMembers[0];
      executeEvolutionForIndex(target.originalIdx, target.member).then(() => {
        switchToWorldWheel();
      });
    } else {
      const partySegments = eligibleMembers.map((item) => ({
        type: `CHOOSE_MEMBER_${item.originalIdx}`,
        label: `🧬 Evolve ${item.member.name}`,
        weight: 100 / eligibleMembers.length,
        metaIndex: item.originalIdx
      }));
      setPendingSubPool(partySegments);
      setActiveWheelType("POST_BATTLE_TARGET");
      setWheelSegments(partySegments);
      setPhase("sub_wheel");
      setAnnouncement("🧬 Spin to choose who evolves!");
    }
  };

  const proceedToEvolutionWheel = (tierString) => {
    if (isVillainBattle && villainWaveStage >= 8) return switchToWorldWheel();
    let normalizedTier = tierString.toLowerCase().trim();
    if (normalizedTier.startsWith("baby")) normalizedTier = "baby";
    const tierOddsMap = {
      "baby": 35, "child": 40, "adult": 55,
      "perfect": 65, "ultimate": 70, "ultra": 85
    };
    const successChance = scaleOddsForDifficulty(tierOddsMap[normalizedTier] || 45);
    setPhase("sub_wheel");
    setActiveWheelType("POST_BATTLE_CHANCE");
    setWheelSegments([
      {type: "EVO_YES", label: `✨ Evolution! (${successChance}%)`, weight: successChance},
      {type: "EVO_NO",  label: `❌ No Evolution (${100 - successChance}%)`, weight: 100 - successChance}
    ]);
    setAnnouncement(`🎰 Evolution chance: ${successChance}% window detected!`);
  };

  const proceedToWildCaptureWheel = (defeatedEnemy) => {
    setLastDefeatedEnemy(defeatedEnemy);
    setPhase("sub_wheel");
    setActiveWheelType("WILD_CAPTURE_CHANCE");
    const captureChance = scaleOddsForDifficulty(40);
    setWheelSegments([
      {type: "WILD_CAPTURE_SUCCESS", label: "🕸️ Capture! ", weight: captureChance},
      {type: "WILD_CAPTURE_FAIL",    label: "❌ Fled ",      weight: 100 - captureChance}
    ]);
    setAnnouncement(`🕸️ ${defeatedEnemy.name} is weakened! Spin to attempt capture!`);
  };

  // ✅ Resolves capture wheel spins one at a time, AFTER the whole wild squad has been defeated.
  const advanceWildCaptureQueue = (queue) => {
    if (!queue || queue.length === 0) {
      proceedToEvolutionWheel(lastDefeatedEnemyTier);
      return;
    }
    const [next, ...rest] = queue;
    setWildCaptureQueue(rest);
    proceedToWildCaptureWheel(next);
  };

  const toggleEvoAnimation = () => {
    setEvoAnimEnabled((prev) => {
      const next = !prev;
      try {localStorage.setItem("digiroulette_evo_anim", String(next));} catch {}
      return next;
    });
  };

  const releaseDigimon = (index, isReserve = false) => {
    const pool = isReserve ? reserve : party;
    const target = pool[index];
    if (!target) return;
    if (isReserve) setReserve((prev) => prev.filter((_, i) => i !== index));
    else setParty((prev) => prev.filter((_, i) => i !== index));
    addLog(`🌐 ${target.name} released back to the Digital World.`);
  };

  // ✅ BUGFIX: capture/hatch used to silently push past the Reserve Box's visible 6 slots when
  // both Party and Reserve were full, losing the Digimon from view. Now it pauses and asks the
  // player to either release the new arrival or swap it in for an existing Reserve member.
  const addCapturedDigimon = (reward, onDone) => {
    if (party.length < 3) {
      setParty((p) => [...p, reward]);
      addLog(`🎉 ${reward.name} added to party!`);
      onDone();
      return;
    }
    if (reserve.length < RESERVE_CAPACITY) {
      setReserve((r) => [...r, reward]);
      addLog(`📦 ${reward.name} sent to Reserve Box!`);
      onDone();
      return;
    }
    addLog(`📦 Reserve Box is full! Choose who to release for ${reward.name}.`);
    setPendingCapture({reward, onDone});
  };

  const resolvePendingCapture = (releaseReserveIdx) => {
    if (!pendingCapture) return;
    const {reward, onDone} = pendingCapture;
    if (releaseReserveIdx === null) {
      addLog(`🌐 ${reward.name} was released back to the Digital World (Reserve full).`);
    } else {
      setReserve((prev) => {
        const next = [...prev];
        const released = next[releaseReserveIdx];
        addLog(`🌐 ${released ? released.name : "A Digimon"} released to make room for ${reward.name}.`);
        next[releaseReserveIdx] = reward;
        return next;
      });
    }
    setPendingCapture(null);
    onDone();
  };

  const handlePhysicsSpinStopped = (selectedIndex) => {
    // 🔒 BUGFIX: refs are always live (unlike closed-over state), so this blocks any
    // stale/duplicate spin result that resolves while an evolution animation is still playing —
    // this is what previously let a rapid double-click evolve the same Digimon twice.
    if (isEvolvingRef.current) return;
    if (activeWheelType === "WORLD") {
      const choice = WORLD_WHEEL[selectedIndex];
      if (!choice) return;
      setAnnouncement(`🎯 Landed On: ${choice.label}`);
      setWorldSpinCount((prev) => prev + 1);
      setWaveUsedItems(false);
      resolveWorldWheelOption(choice);

    } else if (activeWheelType === "POTION_SUB") {
      const picked = POTION_WHEEL[selectedIndex];
      if (!picked) return switchToWorldWheel();
      setInventory((p) => ({...p, potion: p.potion + picked.amount}));
      addLog(`🧪 Added +${picked.amount} Potion(s).`);
      if (sfx.playPotionSFX) sfx.playPotionSFX();
      switchToWorldWheel();

    } else if (activeWheelType === "EGG_SUB") {
      if (pendingSubPool[selectedIndex]) claimSubWheelDigimon(pendingSubPool[selectedIndex].label);
      else switchToWorldWheel();

    } else if (activeWheelType === "ITEM_DROP") {
      const pickedItem = pendingSubPool[selectedIndex];
      if (!pickedItem) return switchToWorldWheel();
      if (pickedItem.type === "CHIP_STRENGTH") {
        setInventory((p) => ({...p, chipStrength: p.chipStrength + 1}));
        addLog("🎉 Obtained Overdrive Chip (+15% Atk)!");
      } else if (pickedItem.type === "CHIP_ENDURANCE") {
        setInventory((p) => ({...p, chipEndurance: p.chipEndurance + 1}));
        addLog("🎉 Obtained Shield Matrix Chip (+20% Max HP)!");
      } else if (pickedItem.type === "REVIVE_POTION") {
        setInventory((p) => ({...p, revivePotion: p.revivePotion + 1}));
        addLog("🎉 Obtained Revive Potion!");
      } else if (pickedItem.type === "ESCAPE_PORTAL") {
        setInventory((p) => ({...p, escapePortal: p.escapePortal + 1}));
        addLog("🎉 Obtained Escape Portal!");
      }
      if (sfx.playItemSFX) sfx.playItemSFX();
      switchToWorldWheel();

    } else if (activeWheelType === "EVOCHIP_DROP") {
      const pickedChip = pendingSubPool[selectedIndex];
      if (!pickedChip) return switchToWorldWheel();
      setInventory((p) => ({...p, [pickedChip.type]: (p[pickedChip.type] || 0) + 1}));
      addLog(`🧬 Obtained ${EVO_CHIP_LABEL[pickedChip.type] || pickedChip.type}!`);
      if (sfx.playItemSFX) sfx.playItemSFX();
      switchToWorldWheel();

    } else if (activeWheelType === "COMBAT") {
      const action = combatTurn === "PLAYER" ? COMBAT_WHEEL_PLAYER[selectedIndex] : COMBAT_WHEEL_ENEMY[selectedIndex];
      if (action) evaluateCombatTurn(action);

    } else if (activeWheelType === "LEGENDARY_CAPTURE_CHANCE") {
      const defeatedLegendary = enemySquad[0];
      if (selectedIndex === 0 && defeatedLegendary) {
        if (sfx.playItemSFX) sfx.playItemSFX();
        const reward = {...defeatedLegendary, hp: defeatedLegendary.maxHp};
        // ✅ Legendary capture fills bestiary
        saveBestiaryEntry(reward.name);
        addScore(SCORE_EVENTS.LEGENDARY_CAPTURED);
        addCapturedDigimon(reward, () => proceedToEvolutionWheel(lastDefeatedEnemyTier));
      } else {
        addLog(`❌ ${defeatedLegendary ? defeatedLegendary.name : "Legendary"} fled.`);
        proceedToEvolutionWheel(lastDefeatedEnemyTier);
      }

    } else if (activeWheelType === "WILD_CAPTURE_CHANCE") {
      const target = lastDefeatedEnemy;
      if (selectedIndex === 0 && target) {
        if (sfx.playItemSFX) sfx.playItemSFX();
        const reward = {...target, hp: target.maxHp};
        // ✅ Wild capture fills bestiary
        saveBestiaryEntry(reward.name);
        addScore(SCORE_EVENTS.WILD_CAPTURED);
        // ✅ Both (or all) wild Digimon are already defeated by this point — spin the capture
        // wheel for the next one in the queue, or move on to the evolution chance once done.
        addCapturedDigimon(reward, () => advanceWildCaptureQueue(wildCaptureQueue));
      } else {
        addLog(`❌ ${target ? target.name : "Wild Digimon"} broke free!`);
        advanceWildCaptureQueue(wildCaptureQueue);
      }

    } else if (activeWheelType === "POST_BATTLE_CHANCE") {
      if (selectedIndex === 0) {
        if (sfx.playItemSFX) sfx.playItemSFX();
        const eligibleMembers = party
          .map((member, idx) => ({member, originalIdx: idx}))
          .filter((item) => {
            const rowData = findDigimonInSheetData(item.member.name);
            return rowData.nextFormName && rowData.nextFormName.toLowerCase().trim() !== "peak form" && rowData.nextFormName.trim() !== "";
          });
        if (eligibleMembers.length === 0) {
          addLog("🚨 All squad members at peak form.");
          switchToWorldWheel(); return;
        }
        triggerEvolutionSelectionOrExecution(eligibleMembers);
      } else {
        addLog("❌ No evolution detected.");
        switchToWorldWheel();
      }

    } else if (activeWheelType === "POST_BATTLE_TARGET") {
      const targetSelection = pendingSubPool[selectedIndex];
      if (targetSelection) {
        executeEvolutionForIndex(targetSelection.metaIndex, party[targetSelection.metaIndex]).then(() => {
          switchToWorldWheel();
        });
      } else switchToWorldWheel();
    }
  };

  const triggerForcedVillainBattle = async () => {
    setLoadingMsg("⚠️ ALERT: Dark Reality Network Incursion Detected...");
    try {
      const WAVE_CONFIGS = [
        {level: "Child",    count: 3},
        {level: "Adult",    count: 3},
        {level: "Perfect",  count: 3},
        {level: "Ultimate", count: 2},
        {level: "Ultimate", count: 3},
        {level: "Ultra",    count: 2},
        {level: "Ultra",    count: 3},
        {level: "Ultra",    count: 1, boss: true}
      ];
      const currentWaveConfig = WAVE_CONFIGS[villainWaveStage % WAVE_CONFIGS.length];
      const isBossWave = !!currentWaveConfig.boss;
      let builtSquad = [];

      if (isBossWave) {
        // ✅ Boss is now drawn randomly from the Bosses Google Sheet — not always Chronomon DM
        const bossPicks = bossPool.length ? bossPool : [CHRONOMON_DM_NAME];
        const chosenBossName = bossPicks[Math.floor(Math.random() * bossPicks.length)];
        const bossDetails = findDigimonInSheetData(chosenBossName);
        bossDetails.hp = 1550; bossDetails.maxHp = 1550;
        bossDetails.baseMaxHp = 1550; bossDetails.power = 8;
        builtSquad = [scaleEnemyForDifficulty(bossDetails)];
      } else {
        const targetLevel = currentWaveConfig.level;
        const filteredPool = villainPool
          .filter((d) => d && d.level && d.level.toLowerCase().trim() === targetLevel.toLowerCase().trim())
          .map((d) => d.name);
        const backupPool = filteredPool.length ? filteredPool : (catchablePool.length ? catchablePool : ["Veemon"]);
        const recentForLevel = recentVillainsRef.current[targetLevel] || [];
        const picks = pickUniqueRandom(backupPool, currentWaveConfig.count, recentForLevel);
        recentVillainsRef.current[targetLevel] = [...recentForLevel, ...picks].slice(-5);
        // ✅ Villain encounters do NOT fill bestiary
        for (const name of picks) builtSquad.push(scaleEnemyForDifficulty(findDigimonInSheetData(name)));
      }

      setIsLegendaryBattle(false); setIsWildBattle(false);
      setEnemySquad(builtSquad); setCurrentEnemyIdx(0);
      setActiveWheelType("COMBAT"); setWheelSegments(COMBAT_WHEEL_PLAYER);
      setCombatTurn("PLAYER"); setPhase("combat");
      setIsVillainBattle(true); setWaveUsedItems(false);
      setVillainWaveStage((prev) => prev + 1);
      resetCombatFloats();

      if (isBossWave) {
        setAnnouncement(`💀 FINAL BOSS! ${builtSquad[0].name} has awakened!`);
        addLog(`💀 WAVE 8 BOSS: ${builtSquad[0].name} — destroyer of timelines!`);
        if (sfx.startBGM) sfx.startBGM("BOSS");
      } else {
        setAnnouncement(`🚨 NEMESIS ATTACK! Wave [${villainWaveStage + 1}/8]: ${currentWaveConfig.count} ${currentWaveConfig.level}-level enemies!`);
        if (sfx.startBGM) sfx.startBGM("BATTLE");
      }
    } catch {switchToWorldWheel();}
    finally {setLoadingMsg("");}
  };

  const resolveWorldWheelOption = async (choice) => {
    addLog(`🌍 ${choice.label}`);
    if (choice.type === "POTION") {
      setPendingSubPool(POTION_WHEEL);
      setActiveWheelType("POTION_SUB"); setWheelSegments(POTION_WHEEL);
      setPhase("sub_wheel");
      setAnnouncement("🧪 Supply Terminal: Roll to verify procurement.");
    } else if (choice.type === "ITEM") {
      setPendingSubPool(ITEM_DROP_POOL);
      setActiveWheelType("ITEM_DROP"); setWheelSegments(ITEM_DROP_POOL);
      setPhase("sub_wheel");
      setAnnouncement("💎 Node drops decoded. Spin to retrieve.");
    } else if (choice.type === "EVOCHIP") {
      setPendingSubPool(EVOCHIP_DROP_POOL);
      setActiveWheelType("EVOCHIP_DROP"); setWheelSegments(EVOCHIP_DROP_POOL);
      setPhase("sub_wheel");
      setAnnouncement("🧬 Digital fragment detected! Spin to identify the evolution chip.");
    } else if (choice.type === "TRAIN") {
      if (party.length === 0) return switchToWorldWheel();
      const eligibleMembers = party
        .map((member, idx) => ({member, originalIdx: idx}))
        .filter((item) => {
          const rowData = findDigimonInSheetData(item.member.name);
          return rowData.nextFormName && rowData.nextFormName.toLowerCase().trim() !== "peak form" && rowData.nextFormName.trim() !== "";
        });
      if (eligibleMembers.length === 0) {
        addLog("🚨 All squad members at peak form."); return switchToWorldWheel();
      }
      triggerEvolutionSelectionOrExecution(eligibleMembers);
    } else if (choice.type === "WILD" || choice.type === "EGG" || choice.type === "LEGENDARY") {
      const poolMap = {EGG: babyPool, LEGENDARY: legendaryPool, WILD: catchablePool};
      let selectedPool = poolMap[choice.type]?.length ? poolMap[choice.type] : ["Veemon"];
      // ✅ Early game safety net: before Nemesis Wave 3, Wild encounters won't roll Ultimate/Ultra tier Digimon
      if (choice.type === "WILD" && villainWaveStage < 3) {
        const filtered = selectedPool.filter((name) => {
          const row = db.find((d) => d && d.name && d.name.toLowerCase().trim() === name.toLowerCase().trim());
          const lvl = (row?.level || "").toLowerCase().trim();
          return lvl !== "ultimate" && lvl !== "ultra";
        });
        if (filtered.length) selectedPool = filtered;
      }
      if (choice.type === "EGG") {
        const constructedPool = selectedPool.map((item) => ({label: item, weight: 100 / selectedPool.length}));
        setPendingSubPool(constructedPool);
        setActiveWheelType("EGG_SUB"); setWheelSegments(constructedPool);
        setPhase("sub_wheel");
        setAnnouncement("🥚 Incubator active! Spin to hatch a Digi-Egg!");
      } else if (choice.type === "LEGENDARY") {
        setLoadingMsg("Generating encounter data...");
        try {
          const shuffled = shuffleArray(selectedPool);
          const details = findDigimonInSheetData(shuffled[0]);
          details.level = "Ultra";
          details.maxHp = STAGE_STATS["Ultra"].maxHp;
          details.hp = STAGE_STATS["Ultra"].maxHp;
          details.baseMaxHp = STAGE_STATS["Ultra"].maxHp;
          details.power = STAGE_STATS["Ultra"].power;
          const scaledDetails = scaleEnemyForDifficulty(details);
          setIsLegendaryBattle(true); setIsWildBattle(false);
          setEnemySquad([scaledDetails]); setCurrentEnemyIdx(0);
          setActiveWheelType("COMBAT"); setWheelSegments(COMBAT_WHEEL_PLAYER);
          setCombatTurn("PLAYER"); setPhase("combat");
          resetCombatFloats();
          setAnnouncement(`⚔️ Your turn! Spin to attack ${scaledDetails.name}!`);
          if (sfx.startBGM) sfx.startBGM("BATTLE");
        } catch {switchToWorldWheel();}
        finally {setLoadingMsg("");}
      } else {
        // ✅ WILD: usually a single Digimon, but 30% of the time a pair shows up together
        setLoadingMsg("Generating encounter data...");
        try {
          const squadSize = Math.random() < 0.30 ? 2 : 1;
          const picks = pickUniqueRandom(selectedPool, squadSize);
          const builtSquad = picks.map((name) => scaleEnemyForDifficulty(findDigimonInSheetData(name)));
          setIsLegendaryBattle(false); setIsWildBattle(true);
          setEnemySquad(builtSquad); setCurrentEnemyIdx(0);
          setActiveWheelType("COMBAT"); setWheelSegments(COMBAT_WHEEL_PLAYER);
          setCombatTurn("PLAYER"); setPhase("combat");
          resetCombatFloats();
          if (squadSize === 2) addLog(`⚠️ Two Wild Digimon detected!`);
          setAnnouncement(`⚔️ Your turn! Spin to attack ${builtSquad[0].name}!`);
          if (sfx.startBGM) sfx.startBGM("BATTLE");
        } catch {switchToWorldWheel();}
        finally {setLoadingMsg("");}
      }
    }
  };

  const claimSubWheelDigimon = async (name) => {
    try {
      const details = findDigimonInSheetData(name);
      // ✅ Egg hatch fills bestiary
      saveBestiaryEntry(details.name);
      if (sfx.playItemSFX) sfx.playItemSFX();
      addCapturedDigimon(details, () => switchToWorldWheel());
    } catch {
      addLog("Data pipeline write error.");
      switchToWorldWheel();
    }
  };

  const evaluateCombatTurn = (action) => {
    const activeOwnIdx = party.findIndex((d) => d.hp > 0);
    const activeOwn = party[activeOwnIdx];
    let activeEnemy = enemySquad[currentEnemyIdx];
    if (activeOwnIdx === -1 || !activeOwn || !activeEnemy) return;

    if (combatTurn === "PLAYER") {
      let ownDmg = 0;
      const playerHasAdvantage = hasAttributeAdvantage(activeOwn.attribute, activeEnemy.attribute);
      const playerHasDisadvantage = hasAttributeDisadvantage(activeOwn.attribute, activeEnemy.attribute);
      if (action.type === "ATTACK" || action.type === "CRITICAL") {
        let base = activeOwn.power * 15 * temporaryBuffs.strengthMultiplier;
        if (action.type === "CRITICAL") base *= 1.8;
        if (playerHasAdvantage) base *= ATTRIBUTE_DAMAGE_BONUS;
        else if (playerHasDisadvantage) base *= ATTRIBUTE_DAMAGE_PENALTY;
        ownDmg = Math.round(base);
      }
      let nextEnemyHp = Math.max(0, activeEnemy.hp - ownDmg);
      const updatedSquad = [...enemySquad];
      updatedSquad[currentEnemyIdx] = {...activeEnemy, hp: nextEnemyHp};
      setEnemySquad(updatedSquad);

      if (action.type === "MISS") {
        if (sfx.playMiss) sfx.playMiss();
        addLog(`💨 ${activeOwn.name} missed!`);
      } else {
        triggerEnemyHit(action.type === "CRITICAL", ownDmg);
        if (action.type === "CRITICAL") {if (sfx.playCriticalHit) sfx.playCriticalHit();}
        else if (sfx.playHit) sfx.playHit();
        const playerTag = playerHasAdvantage ? " ⚡ADVANTAGE" : playerHasDisadvantage ? " 🛡️disadvantage" : "";
        addLog(`💥 ${activeOwn.name} dealt ${ownDmg}${action.type === "CRITICAL" ? " CRITICAL" : ""}${playerTag} dmg to ${activeEnemy.name}!`);
      }

      if (nextEnemyHp <= 0) {
        addLog(`💀 ${activeEnemy.name} defeated!`);
        addScore(SCORE_EVENTS.WILD_DEFEATED);
        const enemyTierStr = activeEnemy.level || "Child";
        setLastDefeatedEnemyTier(enemyTierStr);

        const nextTargetIdx = currentEnemyIdx + 1;
        if (nextTargetIdx < enemySquad.length) {
          setCurrentEnemyIdx(nextTargetIdx);
          setAnnouncement(`🎯 Next target: ${enemySquad[nextTargetIdx].name}! Your turn!`);
          return;
        }

        // ✅ Whole encounter cleared — battle item effects (Overdrive/Shield chips) only last one battle
        removeTemporaryBattleBuffs();

        if (sfx.playVictory) sfx.playVictory();
        if (isVillainBattle) {
          addScore(SCORE_EVENTS.VILLAIN_WAVE);
          if (!waveUsedItems) addScore(SCORE_EVENTS.WAVE_NO_ITEMS);
          if (villainWaveStage === 8) addScore(SCORE_EVENTS.CHRONOMON_DEFEATED);
        }
        if (isLegendaryBattle) {
          setPhase("sub_wheel");
          setActiveWheelType("LEGENDARY_CAPTURE_CHANCE");
          const legendaryCaptureChance = scaleOddsForDifficulty(65);
          setWheelSegments([
            {type: "CAPTURE_SUCCESS", label: "👑 Capture! ", weight: legendaryCaptureChance},
            {type: "CAPTURE_FAIL",    label: "❌ Fled ",     weight: 100 - legendaryCaptureChance}
          ]);
          setAnnouncement(`🎰 Legendary weakened! Spin to capture!`);
          return;
        }
        if (isWildBattle) {
          // ✅ Both/all wild Digimon are down now — line up a capture wheel spin for each one in turn
          advanceWildCaptureQueue(updatedSquad);
          return;
        }
        proceedToEvolutionWheel(enemyTierStr);
      } else {
        setCombatTurn("ENEMY");
        setWheelSegments(COMBAT_WHEEL_ENEMY);
        setAnnouncement(`⚠️ Enemy turn! ${activeEnemy.name} is preparing to attack...`);
      }

    } else {
      if (action.type === "HEAL") {
        if (sfx.playPotionSFX) sfx.playPotionSFX();
        const healAmount = Math.floor(activeEnemy.maxHp * 0.20);
        const updatedSquad = [...enemySquad];
        updatedSquad[currentEnemyIdx] = {...activeEnemy, hp: Math.min(activeEnemy.hp + healAmount, activeEnemy.maxHp)};
        setEnemySquad(updatedSquad);
        addLog(`💚 ${activeEnemy.name} healed +${healAmount} HP.`);
        triggerEnemyHeal(healAmount);
        setCombatTurn("PLAYER"); setWheelSegments(COMBAT_WHEEL_PLAYER);
        setAnnouncement(`⚔️ Your turn! ${activeEnemy.name} healed — spin to attack!`);
        return;
      }
      let enemyDmg = 0;
      const enemyHasAdvantage = hasAttributeAdvantage(activeEnemy.attribute, activeOwn.attribute);
      const enemyHasDisadvantage = hasAttributeDisadvantage(activeEnemy.attribute, activeOwn.attribute);
      if (action.type === "ATTACK" || action.type === "CRITICAL") {
        let base = activeEnemy.power * 15;
        if (action.type === "CRITICAL") base *= 1.5;
        if (enemyHasAdvantage) base *= ATTRIBUTE_DAMAGE_BONUS;
        else if (enemyHasDisadvantage) base *= ATTRIBUTE_DAMAGE_PENALTY;
        enemyDmg = Math.max(10, Math.round(base));
      }
      let nextOwnHp = Math.max(0, activeOwn.hp - enemyDmg);
      let isEmergencyRevive = false;
      if (nextOwnHp <= 0) {
        const aliveTeammates = party.filter((p, idx) => idx !== activeOwnIdx && p.hp > 0).length;
        if (aliveTeammates === 0 && inventory.revivePotion > 0) isEmergencyRevive = true;
      }
      const updatedParty = party.map((p, idx) => {
        if (idx !== activeOwnIdx) return p;
        if (isEmergencyRevive) return {...p, hp: Math.round(p.maxHp * 0.40)};
        return {...p, hp: nextOwnHp};
      });
      setParty(updatedParty);

      if (action.type === "MISS") {
        if (sfx.playMiss) sfx.playMiss();
        addLog(`💨 ${activeEnemy.name} missed!`);
      } else {
        triggerPlayerHit(action.type === "CRITICAL", enemyDmg);
        if (sfx.playHit) sfx.playHit();
        const enemyTag = enemyHasAdvantage ? " ⚡ADVANTAGE" : enemyHasDisadvantage ? " 🛡️disadvantage" : "";
        addLog(`🚨 ${activeEnemy.name} hit ${activeOwn.name} for ${enemyDmg}${action.type === "CRITICAL" ? " CRITICAL" : ""}${enemyTag} dmg!`);
      }

      if (isEmergencyRevive) {
        setInventory((prev) => ({...prev, revivePotion: Math.max(0, prev.revivePotion - 1)}));
        setWaveUsedItems(true);
        addLog(`✨ EMERGENCY: ${activeOwn.name} auto-revived to 40% HP!`);
        triggerPartyHeal(activeOwnIdx, Math.round(activeOwn.maxHp * 0.40));
        if (sfx.playPotionSFX) sfx.playPotionSFX();
        setCombatTurn("PLAYER"); setWheelSegments(COMBAT_WHEEL_PLAYER);
        setAnnouncement(`⚔️ Emergency revival! Fight back against ${activeEnemy.name}!`);
        return;
      }
      const aliveCount = updatedParty.filter((d) => d.hp > 0).length;
      if (aliveCount === 0) {
        removeTemporaryBattleBuffs();
        addLog("🚨 OVERRIDE TERMINATED: All squad members fainted.");
        if (sfx.playGameOver) sfx.playGameOver();
        addToLeaderboard({score, wave: villainWaveStage, victory: false});
        clearSave();
        setPhase("game_over");
      } else {
        setCombatTurn("PLAYER"); setWheelSegments(COMBAT_WHEEL_PLAYER);
        setAnnouncement(`⚔️ Your turn! Spin to counter ${activeEnemy.name}!`);
      }
    }
  };

  // ✅ Evolution chips: guaranteed instant evolution for a specific party/reserve Digimon,
  // gated to the exact tier jump the chip covers. Blocked if the target has no next evolution.
  const evolveWithChip = async (index, isReserve = false) => {
    if (isEvolvingRef.current) return;
    const pool = isReserve ? reserve : party;
    const target = pool[index];
    if (!target) return;
    const neededChip = EVO_CHIP_FOR_LEVEL[target.level];
    if (!neededChip) {addLog(`❌ ${target.name}'s tier can't be evolved with a chip.`); return;}
    if ((inventory[neededChip] || 0) <= 0) {addLog(`❌ You don't own an ${EVO_CHIP_LABEL[neededChip]}.`); return;}
    const lookupDetails = findDigimonInSheetData(target.name);
    const nextFormName = lookupDetails.nextFormName;
    if (!nextFormName || nextFormName.toLowerCase().trim() === "peak form" || nextFormName.trim() === "") {
      addLog(`🏋️ ${target.name} has achieved peak physical output.`);
      return;
    }

    isEvolvingRef.current = true;
    const evolvedDetails = findDigimonInSheetData(nextFormName);
    const setter = isReserve ? setReserve : setParty;
    const setEvolvingIdx = isReserve ? setEvolvingReserveIdx : setEvolvingPartyIdx;

    if (evoAnimEnabled) {
      setLoadingMsg("Restructuring digital data blocks...");
      setEvolvingIdx(index);
      if (sfx.playTransformSFX) sfx.playTransformSFX();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setter((prev) => prev.map((digi, idx) => idx !== index ? digi : evolvedDetails));
    setInventory((prev) => ({...prev, [neededChip]: prev[neededChip] - 1}));
    addLog(`🧬 Used ${EVO_CHIP_LABEL[neededChip]} — ${target.name} evolved into ${evolvedDetails.name}!`);

    if (evoAnimEnabled) {
      setLoadingMsg("");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setEvolvingIdx(null);
    } else if (sfx.playTransformSFX) {
      sfx.playTransformSFX();
    }
    isEvolvingRef.current = false;
  };

  // ✅ Escape Portal: safely flee an active Wild/Legendary battle (blocked during Nemesis Raids)
  const useEscapePortal = () => {
    if (inventory.escapePortal <= 0) {addLog("❌ No Escape Portals left."); return;}
    if (isVillainBattle) {addLog("❌ Escape Portals can't be used during a Nemesis Raid!"); return;}
    if (!isWildBattle && !isLegendaryBattle) return;
    setInventory((prev) => ({...prev, escapePortal: prev.escapePortal - 1}));
    addLog("🌀 Escaped the battle using an Escape Portal!");
    if (sfx.playItemSFX) sfx.playItemSFX();
    removeTemporaryBattleBuffs();
    resetCombatFloats();
    setEnemySquad([]); setCurrentEnemyIdx(0);
    setIsWildBattle(false); setIsLegendaryBattle(false);
    setWildCaptureQueue([]);
    switchToWorldWheel();
  };

  const usePotionOnDigimon = (index, isReserve = false) => {
    if (inventory.potion <= 0) {addLog("❌ No potions left."); return;}
    const pool = isReserve ? reserve : party;
    const target = pool[index];
    if (!target || target.hp <= 0 || target.hp >= target.maxHp) {addLog("❌ Potion aborted: invalid target."); return;}
    const healAmt = Math.min(50, target.maxHp - target.hp);
    const setter = isReserve ? setReserve : setParty;
    setter((prev) => prev.map((digi, idx) => idx !== index ? digi : {...digi, hp: Math.min(digi.maxHp, digi.hp + 50)}));
    setInventory((prev) => ({...prev, potion: Math.max(0, prev.potion - 1)}));
    setWaveUsedItems(true);
    addLog("🧪 Healed +50 HP.");
    if (!isReserve) triggerPartyHeal(index, healAmt);
    if (sfx.playPotionSFX) sfx.playPotionSFX();
  };

  const useRevivePotionOnDigimon = (index, isReserve = false) => {
    if (inventory.revivePotion <= 0) {addLog("❌ No revives left."); return;}
    const pool = isReserve ? reserve : party;
    const target = pool[index];
    if (!target || target.hp > 0) {addLog("❌ Revive aborted: target still operational."); return;}
    const reviveAmt = Math.round(target.maxHp * 0.40);
    const setter = isReserve ? setReserve : setParty;
    setter((prev) => prev.map((digi, idx) => idx !== index ? digi : {...digi, hp: Math.round(digi.maxHp * 0.40)}));
    setInventory((prev) => ({...prev, revivePotion: Math.max(0, prev.revivePotion - 1)}));
    setWaveUsedItems(true);
    addLog(`✨ Revived ${target.name} to 40% HP!`);
    if (!isReserve) triggerPartyHeal(index, reviveAmt);
    if (sfx.playPotionSFX) sfx.playPotionSFX();
  };

  const consumeStrengthChip = () => {
    if (inventory.chipStrength <= 0 || phase !== "combat") return;
    setTemporaryBuffs((prev) => ({...prev, strengthMultiplier: 1.15}));
    setInventory((prev) => ({...prev, chipStrength: prev.chipStrength - 1}));
    setWaveUsedItems(true);
    addLog(`💪 Overdrive online! +15% damage!`);
    if (sfx.playItemSFX) sfx.playItemSFX();
  };

  const consumeEnduranceChip = () => {
    if (inventory.chipEndurance <= 0 || phase !== "combat") return;
    const activeIdx = party.findIndex((d) => d.hp > 0);
    if (activeIdx === -1) return;
    setTemporaryBuffs((prev) => ({...prev, enduranceMultiplier: 1.20}));
    setParty((prevParty) => prevParty.map((member, idx) => {
      if (idx !== activeIdx) return member;
      const base = member.baseMaxHp || member.maxHp;
      return {...member, baseMaxHp: base, maxHp: Math.round(base * 1.20), hp: Math.round(member.hp * 1.20)};
    }));
    setInventory((prev) => ({...prev, chipEndurance: prev.chipEndurance - 1}));
    setWaveUsedItems(true);
    addLog(`🛡️ Shield online! +20% Max HP!`);
    if (sfx.playItemSFX) sfx.playItemSFX();
  };

  const swapPartyAndReserve = (partyIdx, targetIdx, isReserveTarget = false) => {
    if (isReserveTarget) {
      let nextParty = [...party];
      let nextReserve = [...reserve];
      const pTarget = party[partyIdx];
      const rTarget = reserve[targetIdx];
      if (rTarget) {nextParty[partyIdx] = rTarget; nextReserve[targetIdx] = pTarget;}
      else if (nextParty[partyIdx]) {nextParty.splice(partyIdx, 1); nextReserve.push(pTarget);}
      setParty(nextParty.filter(Boolean));
      setReserve(nextReserve.filter(Boolean));
      addLog(`🔄 Hot-swap complete.`);
    } else {
      if (partyIdx < 0 || partyIdx >= party.length || targetIdx < 0 || targetIdx >= party.length) return;
      setParty((prevParty) => {
        const next = [...prevParty];
        [next[partyIdx], next[targetIdx]] = [next[targetIdx], next[partyIdx]];
        return next;
      });
      addLog(`🔄 Party order updated.`);
    }
  };

  return {
    party, reserve, inventory, phase, loadingMsg, log, announcement, setAnnouncement, starters,
    activeWheelType, wheelSegments, enemySquad, currentEnemyIdx, worldSpinCount, combatTurn,
    lastDefeatedEnemyTier, villainWaveStage, isVillainBattle, isWildBattle, isLegendaryBattle,
    enemyHitAnim, playerHitAnim,
    partyHealAnim, enemyHealAnim,
    score, evolvingPartyIdx, evolvingReserveIdx, showResumePrompt, handleResume, fullRoster,
    evoAnimEnabled, toggleEvoAnimation,
    chooseStarter, usePotionOnDigimon, useRevivePotionOnDigimon, consumeStrengthChip,
    consumeEnduranceChip, swapPartyAndReserve, handlePhysicsSpinStopped, resetToStart, releaseDigimon,
    evolveWithChip, useEscapePortal,
    pendingCapture, resolvePendingCapture
  };
}
