import React, {useState, useEffect, useLayoutEffect, useRef, useCallback} from "react";
import {createPortal} from "react-dom";
import Papa from "papaparse";
import {useDigimonGame, WHEEL_COLORS, getRank, SAVE_KEY as SHOP_SAVE_KEY, HIGHSCORE_KEY as SHOP_HIGHSCORE_KEY, BESTIARY_KEY as SHOP_BESTIARY_KEY, getLeaderboard as getShopLeaderboard, URLS as SHOP_URLS, getAttributeEmoji, ATTRIBUTE_ADVANTAGE, SCORE_EVENTS, SHOP_ITEMS, EVO_CHIP_FOR_LEVEL, EVO_CHIP_LABEL, EVO_CHIP_TARGET_TIER, EVO_CHIP_KEYS, getSellValue} from "./DigimonRoulette";
import {
  useDigimonGame as useDigimonGameRNG,
  WHEEL_COLORS as RNG_WHEEL_COLORS,
  SAVE_KEY as RNG_SAVE_KEY,
  HIGHSCORE_KEY as RNG_HIGHSCORE_KEY,
  BESTIARY_KEY as RNG_BESTIARY_KEY,
  getLeaderboard as getRngLeaderboard,
  EVO_CHIP_FOR_LEVEL as RNG_EVO_CHIP_FOR_LEVEL,
  EVO_CHIP_LABEL as RNG_EVO_CHIP_LABEL,
  EVO_CHIP_TARGET_TIER as RNG_EVO_CHIP_TARGET_TIER,
  EVO_CHIP_KEYS as RNG_EVO_CHIP_KEYS,
} from "./DigimonRouletteRNG";
import Wheel from "./Wheel";
import {sfx} from "./utils/audio";
import digiRouletteLogo from "./digiroulette-logo.svg";

// ============================================================
// ANIMATED NUMBER — counts up/down toward its target value instead of snapping instantly.
// Used wherever Digi Coin totals are displayed (Shop header, Inventory panel).
// ============================================================
const AnimatedNumber = ({value, duration = 500}) => {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <>{display}</>;
};

// ============================================================
// TUTORIAL STEPS — a generic overview (shown from the main menu,
// before a mode is picked) plus mode-specific step sets (shown
// from inside each mode, where the economy/item mechanics differ)
// ============================================================
const COMMON_STEPS_HEAD = [
  {icon:"🌍", title:"Welcome to DigiRoulette!", body:"A turn-based Digimon adventure powered by a spin wheel. Every action, battling, evolving is decided by fate. Choose your starter and begin your journey!"},
];
const COMMON_STEPS_TAIL = [
  {icon:"⚔️", title:"Combat", body:"You and the enemy take turns spinning the Combat Wheel. Land on 💥 Normal Attack, 🔥 Critical Hit, or 💨 Miss. Enemies can also 💚 Heal. Defeat all enemies to win!"},
  {icon:"🕸️", title:"Wild Capture", body:"After defeating a Wild Digimon, spin for a capture chance! Success adds it to your party or reserve box. Build a diverse team!"},
  {icon:"✨", title:"Evolution", body:"After battle, spin for an evolution chance. Higher-tier enemies give better odds. Watch your Digimon card light up and transform when evolution triggers!"},
  {icon:"📖", title:"Bestiary", body:"The Bestiary tracks every Digimon you've captured or hatched from eggs. Capture wild Digimon, legendary encounters, and hatch eggs to fill your collection."},
  {icon:"🚨", title:"Nemesis Raids", body:"Every 4 world spins, a Nemesis Raid triggers — 8 escalating waves. Wave 8 is CHRONOMON DM. Clear all 8 waves to save the Digital World! Shortcuts: Space=Spin, H=Heal."},
];

const GENERIC_TUTORIAL_STEPS = [
  ...COMMON_STEPS_HEAD,
  {icon:"🎲", title:"The World Wheel", body:"Spin the World Wheel each turn to explore — encounter Digimon, hatch eggs, train, and more. Every 4 spins triggers a Nemesis Raid!"},
  ...COMMON_STEPS_TAIL,
  {icon:"🛒🎲", title:"Two Ways to Play", body:"Shop Mode: earn Digi Coin from battles and spend it in the Digital Shop on your own terms. Full RNG Mode: no currency at all — potions, items, and evolution chips are all found straight from the wheel. Pick a mode from the main menu to see its full rules!"},
];

const SHOP_TUTORIAL_STEPS = [
  ...COMMON_STEPS_HEAD,
  {icon:"🎲", title:"The World Wheel", body:"Spin the World Wheel each turn. It lands on: ⚔️ Wild Encounter, 🥚 Digi-Egg hatch, 🛒 Visit Digital Shop, 👑 Legendary encounter, or 🏋️ Train to evolve. Every 4 spins triggers a Nemesis Raid!"},
  ...COMMON_STEPS_TAIL,
  {icon:"🪙", title:"Digi Coin & the Shop", body:"Defeating Wild or Legendary Digimon earns Digi Coin. Spend it in the Digital Shop on Potions, Chips, Revives, Evolution Chips, and Escape Portals — buy what you want, whenever you want."},
];

const RNG_TUTORIAL_STEPS = [
  ...COMMON_STEPS_HEAD,
  {icon:"🎲", title:"The World Wheel", body:"Spin the World Wheel each turn. It lands on: ⚔️ Wild Encounter, 🥚 Digi-Egg hatch, 🧪 Buy a Potion, 💎 Find Battle Item Mod, 👑 Legendary encounter, 🧬 Found Evolution Chip, or 🏋️ Train to evolve. Every 4 spins triggers a Nemesis Raid!"},
  ...COMMON_STEPS_TAIL,
  {icon:"💎", title:"No Shop — Everything's a Drop", body:"There's no currency here. Potions, battle items (Overdrive Chip, Shield Matrix, Revive Potion, Escape Portal), and Evolution Chips are all found directly from World Wheel spins."},
];

// ============================================================
// TUTORIAL POPUP
// ============================================================
const TutorialPopup = ({onClose, steps = GENERIC_TUTORIAL_STEPS}) => {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",boxSizing:"border-box"}}>
      <div style={{background:"#1b1c24",border:"2px solid #3498db",borderRadius:"16px",padding:"28px 24px",maxWidth:"480px",width:"100%",boxShadow:"0 0 40px rgba(52,152,219,0.3)",display:"flex",flexDirection:"column",gap:"16px"}}>
        <div style={{display:"flex",gap:"6px",justifyContent:"center"}}>
          {steps.map((_,i) => (
            <div key={i} onClick={() => setStep(i)} style={{width:i===step?"20px":"8px",height:"8px",borderRadius:"4px",background:i===step?"#3498db":"#30363d",cursor:"pointer",transition:"all 0.2s"}} />
          ))}
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:"3rem",marginBottom:"8px"}}>{current.icon}</div>
          <h2 style={{margin:"0 0 12px 0",color:"#58a6ff",fontSize:"1.3rem"}}>{current.title}</h2>
          <p style={{margin:0,color:"#c9d1d9",fontSize:"0.95rem",lineHeight:"1.6"}}>{current.body}</p>
        </div>
        <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
          {!isFirst && <button onClick={() => setStep(s => s-1)} style={{padding:"10px 20px",background:"#21262d",color:"#fff",border:"1px solid #30363d",borderRadius:"8px",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>← Back</button>}
          {!isLast
            ? <button onClick={() => setStep(s => s+1)} style={{padding:"10px 24px",background:"#3498db",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>Next →</button>
            : <button onClick={onClose} style={{padding:"10px 28px",background:"#2ecc71",color:"#000",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>🎮 Start Playing!</button>
          }
          {!isLast && <button onClick={onClose} style={{padding:"10px 16px",background:"transparent",color:"#8b949e",border:"1px solid #30363d",borderRadius:"8px",cursor:"pointer",fontSize:"0.85rem"}}>Skip</button>}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// #9 BESTIARY MODAL — tier categorized, capture/hatch only
// ============================================================

// ✅ Map sheet level values → display tier labels
// "Ultra" in sheet = "Mega" in display per user request
const TIER_CONFIG = [
  {key: "Baby",     label: "🥚 Baby",     color: "#9b59b6", match: (l) => l.toLowerCase().startsWith("baby")},
  {key: "Child",    label: "⚡ Child",    color: "#3498db", match: (l) => l.toLowerCase() === "child"},
  {key: "Adult",    label: "🔥 Adult",    color: "#e67e22", match: (l) => l.toLowerCase() === "adult"},
  {key: "Perfect",  label: "💎 Perfect",  color: "#2ecc71", match: (l) => l.toLowerCase() === "perfect"},
  {key: "Ultimate", label: "👑 Ultimate", color: "#e74c3c", match: (l) => l.toLowerCase() === "ultimate"},
  {key: "Mega",     label: "💀 Mega",     color: "#f1c40f", match: (l) => l.toLowerCase() === "ultra" || l.toLowerCase() === "mega"},
  {key: "Other",    label: "❓ Other",    color: "#8b949e", match: () => true},
];

function getTier(level) {
  return TIER_CONFIG.find((t) => t.match(level || "")) || TIER_CONFIG[TIER_CONFIG.length - 1];
}

const BestiaryModal = ({fullRoster, onClose, bestiaryKey}) => {
  const [activeTab, setActiveTab] = useState("Baby");
  const [searchQuery, setSearchQuery] = useState("");
  const [undiscoveredOnly, setUndiscoveredOnly] = useState(false);
  const discovered = (() => {try {return JSON.parse(localStorage.getItem(bestiaryKey) || "[]");} catch {return [];}})();
  const discoveredSet = new Set(discovered);
  const total = fullRoster.length;
  const found = discovered.length;

  // Group roster by tier
  const grouped = {};
  TIER_CONFIG.forEach((t) => {grouped[t.key] = [];});
  fullRoster.forEach((d) => {
    const tier = getTier(d.level);
    grouped[tier.key].push(d);
  });

  // Remove empty tiers
  const visibleTiers = TIER_CONFIG.filter((t) => grouped[t.key].length > 0);
  const currentTier = TIER_CONFIG.find((t) => t.key === activeTab) || visibleTiers[0];
  const currentList = grouped[activeTab] || [];
  const tierFound = currentList.filter((d) => discoveredSet.has(d.name)).length;
  // ✅ Search + "undiscovered only" filter — only affects what's shown in the grid,
  // tier counts/progress above still reflect the full tier
  const displayedList = currentList.filter((d) => {
    if (undiscoveredOnly && discoveredSet.has(d.name)) return false;
    if (searchQuery.trim() && !d.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",boxSizing:"border-box"}}>
      <div style={{background:"#1b1c24",border:"2px solid #3498db",borderRadius:"16px",padding:"20px",maxWidth:"740px",width:"100%",maxHeight:"88vh",display:"flex",flexDirection:"column",gap:"12px"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <h2 style={{margin:0,color:"#58a6ff",fontSize:"1.3rem"}}>📖 Digimon Bestiary</h2>
            <p style={{margin:"4px 0 0 0",color:"#8b949e",fontSize:"0.82rem"}}>
              {found} / {total} captured &nbsp;·&nbsp; {Math.round((found / Math.max(total,1)) * 100)}% complete
              &nbsp;·&nbsp; <span style={{color:"#8b949e",fontSize:"0.78rem"}}>Fill by: capturing wild, legendary, or hatching eggs</span>
            </p>
          </div>
          <button onClick={onClose} style={{background:"#21262d",color:"#fff",border:"1px solid #30363d",borderRadius:"8px",padding:"8px 16px",cursor:"pointer",fontWeight:"bold",flexShrink:0}}>✕ Close</button>
        </div>

        {/* Overall progress bar */}
        <div style={{background:"#0d1117",height:"6px",borderRadius:"4px",overflow:"hidden",flexShrink:0}}>
          <div style={{background:"#3498db",height:"100%",width:`${(found/Math.max(total,1))*100}%`,transition:"width 0.5s"}} />
        </div>

        {/* Tier tabs */}
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",flexShrink:0}}>
          {visibleTiers.map((t) => {
            const tList = grouped[t.key];
            const tFound = tList.filter((d) => discoveredSet.has(d.name)).length;
            const isActive = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                padding:"5px 12px",
                background: isActive ? t.color : "#21262d",
                color: isActive ? "#000" : "#8b949e",
                border: `1px solid ${isActive ? t.color : "#30363d"}`,
                borderRadius:"20px",
                cursor:"pointer",
                fontSize:"11px",
                fontWeight:"bold",
                transition:"all 0.2s",
              }}>
                {t.label} <span style={{opacity:0.8}}>({tFound}/{tList.length})</span>
              </button>
            );
          })}
        </div>

        {/* Tier progress bar */}
        <div style={{flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
            <span style={{fontSize:"11px",color:currentTier?.color,fontWeight:"bold"}}>{currentTier?.label}</span>
            <span style={{fontSize:"11px",color:"#8b949e"}}>{tierFound} / {currentList.length}</span>
          </div>
          <div style={{background:"#0d1117",height:"5px",borderRadius:"3px",overflow:"hidden"}}>
            <div style={{background:currentTier?.color || "#3498db",height:"100%",width:`${(tierFound/Math.max(currentList.length,1))*100}%`,transition:"width 0.4s"}} />
          </div>
        </div>

        {/* Search + filter */}
        <div style={{display:"flex",gap:"8px",flexShrink:0,alignItems:"center",flexWrap:"wrap"}}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search by name..."
            style={{flex:"1 1 160px",background:"#0d1117",border:"1px solid #30363d",borderRadius:"6px",padding:"6px 10px",color:"#c9d1d9",fontSize:"11px",outline:"none"}}
          />
          <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"10px",color:"#8b949e",cursor:"pointer",userSelect:"none"}}>
            <input type="checkbox" checked={undiscoveredOnly} onChange={(e) => setUndiscoveredOnly(e.target.checked)} />
            Undiscovered only
          </label>
        </div>

        {/* Digimon grid */}
        <div style={{overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(78px, 1fr))",gap:"8px",paddingRight:"4px"}}>
          {displayedList.length === 0 && (
            <p style={{gridColumn:"1 / -1",color:"#444",fontSize:"11px",fontStyle:"italic",textAlign:"center",padding:"20px 0"}}>No Digimon match your search.</p>
          )}
          {displayedList.map((d, i) => {
            const isFound = discoveredSet.has(d.name);
            return (
              <div key={i} style={{
                display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",
                background: isFound ? "#0d1117" : "#16171d",
                borderRadius:"8px",padding:"8px",
                border:`1px solid ${isFound ? currentTier?.color || "#3498db" : "#21262d"}`,
                opacity: isFound ? 1 : 0.45,
                transition:"opacity 0.2s",
              }}>
                <div style={{width:"52px",height:"52px",background:"#16171d",borderRadius:"6px",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",border:`1px solid ${isFound ? "#30363d" : "#1a1a1a"}`}}>
                  {isFound && d.imageUrl
                    ? <img src={d.imageUrl} alt={d.name} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} />
                    : <span style={{fontSize:"20px",filter:"grayscale(100%) brightness(0.25)"}}>❓</span>
                  }
                </div>
                <span style={{
                  fontSize:"9px",fontWeight:"bold",
                  color: isFound ? "#c9d1d9" : "#6e7681",
                  textAlign:"center",lineHeight:"1.2",
                  maxWidth:"70px",overflow:"hidden",
                  textOverflow:"ellipsis",whiteSpace:"nowrap"
                }}>
                  {d.name}
                </span>
                {isFound && (
                  <span style={{fontSize:"8px",color:currentTier?.color || "#8b949e",fontWeight:"bold"}}>
                    ✓ Caught
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// WAVE PROGRESS BAR
// ============================================================
// ============================================================
// ATTRIBUTE TRIANGLE — Vaccine beats Virus beats Data beats Vaccine
// ============================================================
// ============================================================
// SHOP PANEL — replaces the wheel in col-center when phase === "shop"
// ============================================================
// ============================================================
// INVENTORY PANEL — compact tabbed Battle Items / Evolution Chips
// ============================================================
const InventoryPanel = ({inventory, digiCoin, phase, isVillainBattle, isWildBattle, isLegendaryBattle, onUseStrength, onUseEndurance, onUseEscape, highlightedEvoTier, onToggleEvoHighlight, evoChipKeys = EVO_CHIP_KEYS, evoChipTargetTier = EVO_CHIP_TARGET_TIER, evoChipLabel = EVO_CHIP_LABEL}) => {
  const [tab, setTab] = useState("battle");
  const canEscape = phase === "combat" && !isVillainBattle && (isWildBattle || isLegendaryBattle);

  const BATTLE_ROWS = [
    {icon: "🧪", label: "Potion", count: inventory.potion, onUse: null, disabled: true, hint: "Use from a Digimon's Heal button", tag: "manual"},
    {icon: "✨", label: "Revive Potion", count: inventory.revivePotion, onUse: null, disabled: true, hint: "Auto-used when your last active Digimon faints", tag: "auto"},
    {icon: "💪", label: "Strength Chip", count: inventory.chipStrength, onUse: onUseStrength, disabled: inventory.chipStrength <= 0 || phase !== "combat"},
    {icon: "🛡️", label: "Endurance Chip", count: inventory.chipEndurance, onUse: onUseEndurance, disabled: inventory.chipEndurance <= 0 || phase !== "combat"},
    {icon: "🌀", label: "Escape Portal", count: inventory.escapePortal, onUse: onUseEscape, disabled: inventory.escapePortal <= 0 || !canEscape},
  ];

  return (
    <div style={{background:"#21262d",padding:"10px",borderRadius:"12px",border:"1px solid #30363d",flexShrink:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
        <span style={{fontSize:"0.85rem",fontWeight:"bold",color:"#c9d1d9"}}>🎒 Inventory</span>
        {typeof digiCoin === "number" && <span style={{fontSize:"0.85rem",fontWeight:"bold",color:"#f1c40f"}}>🪙 <AnimatedNumber value={digiCoin} /></span>}
      </div>

      <div style={{display:"flex",gap:"4px",marginBottom:"6px"}}>
        <button onClick={() => setTab("battle")} style={{flex:1,padding:"5px 0",fontSize:"10px",fontWeight:"bold",borderRadius:"6px",border:`1px solid ${tab==="battle"?"#3498db":"#30363d"}`,background:tab==="battle"?"#0d2137":"transparent",color:tab==="battle"?"#58a6ff":"#8b949e",cursor:"pointer"}}>Battle Items</button>
        <button onClick={() => setTab("evo")} style={{flex:1,padding:"5px 0",fontSize:"10px",fontWeight:"bold",borderRadius:"6px",border:`1px solid ${tab==="evo"?"#9b59b6":"#30363d"}`,background:tab==="evo"?"#221a2e":"transparent",color:tab==="evo"?"#c792ea":"#8b949e",cursor:"pointer"}}>Evolution</button>
      </div>

      {tab === "battle" ? (
        <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:"5px",maxHeight:"90px",overflowY:"auto",paddingRight:"2px"}}>
          {BATTLE_ROWS.map((row) => (
            <div key={row.label} style={{background:"#0d1117",border:"1px solid #30363d",borderRadius:"7px",padding:"6px 7px",display:"flex",alignItems:"center",gap:"5px",minHeight:"30px"}}>
              <span style={{fontSize:"14px",flexShrink:0}}>{row.icon}</span>
              <span style={{fontSize:"10px",color:"#c9d1d9",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.label}</span>
              <span style={{fontSize:"11px",fontWeight:"bold",color:"#fff",flexShrink:0}}>{row.count}</span>
              {row.onUse ? (
                <button onClick={row.onUse} disabled={row.disabled} style={{fontSize:"9px",fontWeight:"bold",padding:"3px 7px",borderRadius:"5px",border:"none",cursor:row.disabled?"not-allowed":"pointer",background:row.disabled?"#30363d":"#4f46e5",color:row.disabled?"#6e7681":"#fff",flexShrink:0}}>Use</button>
              ) : (
                <span style={{fontSize:"8px",color:"#6e7681",flexShrink:0}} title={row.hint}>{row.tag || "manual"}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:"5px"}}>
            {evoChipKeys.map((key) => {
              const count = inventory[key] || 0;
              const tier = evoChipTargetTier[key];
              const isActive = highlightedEvoTier === tier;
              return (
                <button
                  key={key}
                  onClick={() => count > 0 && onToggleEvoHighlight(tier)}
                  disabled={count <= 0}
                  style={{background:isActive?"#2d2410":"#0d1117",border:`1px solid ${isActive?"#f1c40f":"#30363d"}`,borderRadius:"7px",padding:"6px 7px",display:"flex",alignItems:"center",gap:"5px",minHeight:"30px",cursor:count>0?"pointer":"default",opacity:count>0?1:0.45,textAlign:"left"}}
                >
                  <span style={{fontSize:"14px",flexShrink:0}}>🧬</span>
                  <span style={{fontSize:"10px",color:isActive?"#f1c40f":"#c9d1d9",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{evoChipLabel[key]}</span>
                  <span style={{fontSize:"11px",fontWeight:"bold",color:"#fff",flexShrink:0}}>{count}</span>
                </button>
              );
            })}
          </div>
          <p style={{margin:"6px 2px 0",fontSize:"9px",color:"#8b949e",lineHeight:"1.4"}}>Tap a chip, then tap the pulsing yellow Digimon to evolve it instantly.</p>
        </div>
      )}
    </div>
  );
};

const ShopPanel = ({digiCoin, onBuy, onLeave, shopItems = SHOP_ITEMS}) => {
  const [pulseItem, setPulseItem] = useState(null); // {key, ts} | null
  const [toasts, setToasts] = useState([]); // [{id, label}]

  // ✅ Purchase confirmation: a brief pulse on the item card + button, plus a small toast —
  // both self-clear so purchases stay rapid-fire and never block further buying.
  const handleBuy = (item) => {
    if (digiCoin < item.price) return;
    onBuy(item.key);
    setPulseItem({key: item.key, ts: Date.now()});
    const toastId = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, {id: toastId, label: `+${item.icon} ${item.label}`}]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toastId)), 1300);
  };

  useEffect(() => {
    if (!pulseItem) return;
    const t = setTimeout(() => setPulseItem(null), 450);
    return () => clearTimeout(t);
  }, [pulseItem]);

  return (
    <div style={{width:"100%",flexGrow:1,display:"flex",flexDirection:"column",gap:"8px",minHeight:0,position:"relative"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#16171d",border:"1px solid #f1c40f",borderRadius:"10px",padding:"8px 12px"}}>
        <span style={{fontSize:"0.85rem",fontWeight:"bold",color:"#fff"}}>🛒 Digital Shop</span>
        <span style={{fontSize:"0.9rem",fontWeight:"bold",color:"#f1c40f"}}>🪙 <AnimatedNumber value={digiCoin} /></span>
      </div>

      {/* Purchase toasts */}
      <div style={{position:"absolute",top:"46px",right:"6px",zIndex:40,display:"flex",flexDirection:"column",gap:"4px",alignItems:"flex-end",pointerEvents:"none"}}>
        {toasts.map((t) => (
          <div key={t.id} className="shop-toast" style={{background:"#0d1117",border:"1px solid #f1c40f",borderRadius:"8px",padding:"4px 10px",fontSize:"10px",fontWeight:"bold",color:"#f1c40f",boxShadow:"0 2px 8px rgba(0,0,0,0.5)",whiteSpace:"nowrap"}}>{t.label}</div>
        ))}
      </div>

      <div style={{flexGrow:1,overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))",gap:"6px",paddingRight:"2px"}}>
        {shopItems.map((item) => {
          const affordable = digiCoin >= item.price;
          const isPulsing = pulseItem?.key === item.key;
          return (
            <div key={item.key} className={isPulsing ? "shop-item-pulse" : ""} style={{background:"#0d1117",border:`1px solid ${isPulsing ? "#2ecc71" : "#30363d"}`,borderRadius:"8px",padding:"8px",display:"flex",flexDirection:"column",gap:"4px",transition:"border-color 0.3s"}}>
              <div style={{fontSize:"11px",fontWeight:"bold",color:"#fff"}}>{item.icon} {item.label}</div>
              <div style={{fontSize:"9px",color:"#8b949e",lineHeight:"1.3",flexGrow:1}}>{item.desc}</div>
              <button
                onClick={() => handleBuy(item)}
                disabled={!affordable}
                style={{fontSize:"10px",fontWeight:"bold",padding:"5px 0",borderRadius:"6px",border:"none",cursor:affordable?"pointer":"not-allowed",background:isPulsing?"#2ecc71":affordable?"#f1c40f":"#30363d",color:isPulsing?"#000":affordable?"#000":"#8b949e",transition:"background-color 0.2s"}}
              >
                {isPulsing ? "✓ Bought!" : `🪙 ${item.price}`}
              </button>
            </div>
          );
        })}
      </div>
      <button onClick={onLeave} style={{padding:"10px 0",background:"#21262d",color:"#c9d1d9",border:"1px solid #30363d",borderRadius:"10px",fontWeight:"bold",cursor:"pointer",fontSize:"0.85rem"}}>🚪 Leave Shop</button>
    </div>
  );
};

// ✅ PERF: no props at all — wrapping in memo means combat's frequent re-renders (hit flashes,
// screen shake, HP animations) never touch this subtree.
const AttributeTriangle = React.memo(() => {
  const [showTip, setShowTip] = useState(false);
  return (
    <div
      style={{background:"#16171d",border:"1px solid #333",borderRadius:"10px",padding:"4px 6px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative",cursor:"help"}}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <svg viewBox="0 0 100 100" width="88" height="88">
        <defs>
          <marker id="attrArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0,0 6,3 0,6" fill="#8b949e" />
          </marker>
        </defs>
        <line x1="50" y1="28" x2="72" y2="65" stroke="#8b949e" strokeWidth="1.65" markerEnd="url(#attrArrow)" />
        <line x1="74" y1="80" x2="26" y2="80" stroke="#8b949e" strokeWidth="1.65" markerEnd="url(#attrArrow)" />
        <line x1="28" y1="65" x2="46" y2="28" stroke="#8b949e" strokeWidth="1.65" markerEnd="url(#attrArrow)" />
        <circle cx="50" cy="16" r="16" fill="#0d1117" stroke="#3498db" strokeWidth="1" />
        <text x="50" y="23" textAnchor="middle" fontSize="24">💉</text>
        <circle cx="84" cy="84" r="16" fill="#0d1117" stroke="#e74c3c" strokeWidth="1" />
        <text x="84" y="91" textAnchor="middle" fontSize="24">🦠</text>
        <circle cx="16" cy="84" r="16" fill="#0d1117" stroke="#2ecc71" strokeWidth="1" />
        <text x="16" y="91" textAnchor="middle" fontSize="24">💾</text>
      </svg>
      {showTip && (
        <div style={{position:"absolute",top:"100%",right:"0",marginTop:"8px",zIndex:50,background:"#0d1117",border:"1px solid #3498db",borderRadius:"8px",padding:"8px 10px",width:"150px",boxShadow:"0 4px 14px rgba(0,0,0,0.6)",textAlign:"left",cursor:"default"}}>
          <div style={{fontSize:"10px",color:"#c9d1d9",lineHeight:"1.7"}}>
            <div>💉 Vaccine ➜ 🦠 Virus</div>
            <div>🦠 Virus ➜ 💾 Data</div>
            <div>💾 Data ➜ 💉 Vaccine</div>
          </div>
          <hr style={{border:"none",borderTop:"1px solid #30363d",margin:"6px 0"}} />
          <div style={{fontSize:"10px",lineHeight:"1.6"}}>
            <div style={{color:"#56d364"}}>⚡ Attacking the type you beat: +10% dmg</div>
            <div style={{color:"#ff7b72"}}>🛡️ Attacking the type that beats you: −10% dmg</div>
          </div>
        </div>
      )}
    </div>
  );
});

// ✅ PERF: single primitive prop (villainWaveStage) — only re-renders when the wave actually
// advances, not on every combat-animation-driven GameCore re-render.
const WaveProgressBar = React.memo(({villainWaveStage}) => (
  <div style={{background:"#0d1117",border:"1px solid #30363d",borderRadius:"8px",padding:"6px 10px",display:"flex",flexDirection:"column",gap:"4px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontSize:"10px",color:"#8b949e",fontWeight:"bold"}}>🚨 NEMESIS RAID PROGRESS</span>
      <span style={{fontSize:"10px",fontWeight:"bold",color:villainWaveStage>=8?"#2ecc71":villainWaveStage>=6?"#e74c3c":"#e67e22"}}>
        {villainWaveStage>=8?"✅ CLEARED":`Wave ${villainWaveStage}/8`}
      </span>
    </div>
    <div style={{display:"flex",gap:"3px"}}>
      {Array.from({length:8},(_,i) => (
        <div key={i} style={{flex:1,height:"8px",borderRadius:"3px",background:i<villainWaveStage?(i===7?"#e74c3c":"#2ecc71"):(i===7?"#3d1a1a":"#21262d"),border:i===7?"1px solid #e74c3c":"1px solid #30363d",transition:"background 0.3s"}} />
      ))}
    </div>
    <div style={{display:"flex",justifyContent:"space-between"}}>
      <span style={{fontSize:"9px",color:"#444"}}>Start</span>
      <span style={{fontSize:"9px",color:"#e74c3c"}}>💀 Boss</span>
    </div>
  </div>
));

// ============================================================
// PARTY SLOT
// ============================================================
const slotStyle = {
  width:"100%",aspectRatio:"1 / 1",maxWidth:"90px",
  borderRadius:"10px",border:"2px solid #30363d",
  display:"flex",alignItems:"center",justifyContent:"center",
  background:"#1e1e24",overflow:"hidden",cursor:"pointer",padding:0,
  transition:"border-color 0.3s, box-shadow 0.3s",
};

// ✅ PERF: up to 9 of these render at once (3 party + 6 reserve), and GameCore re-renders
// frequently (hit animations, HP flashes, timers). Memoizing means an unrelated slot's props
// changing doesn't force every other slot to re-render too.
const PartySlot = React.memo(({digimon, onClick, selected, animClass, animKey, hitFlash, isEvolving, floatEvent = null, reducedMotion = false, showInfo = false, onToggleInfo, evoChipCount = 0, onEvolveWithChip, isHighlightedForEvo = false, onRelease, onSell, sellValue = null, evoChipForLevel = EVO_CHIP_FOR_LEVEL}) => {
  const isLowHp = digimon && digimon.hp > 0 && (digimon.hp / digimon.maxHp) <= 0.2;
  const cardRef = useRef(null);
  const [popupPos, setPopupPos] = useState(null);
  const POPUP_WIDTH = 168;

  // ✅ Popup is portaled to document.body (so it still escapes the Reserve Box's
  // overflow:auto clipping — that's why it can't just be position:absolute inside the slot),
  // but its position is now computed from the card's actual on-screen rect so it renders
  // directly above that specific card instead of centered on the whole viewport.
  const computePopupPos = () => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const gap = 10;
    const halfWidth = POPUP_WIDTH / 2;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, halfWidth + 8),
      window.innerWidth - halfWidth - 8
    );
    const top = Math.max(rect.top - gap, 8);
    setPopupPos({top, left});
  };

  useLayoutEffect(() => {
    if (!showInfo) {setPopupPos(null); return;}
    computePopupPos();
    const handle = () => computePopupPos();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInfo]);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (digimon && onToggleInfo) onToggleInfo();
  };
  const neededChip = digimon ? evoChipForLevel[digimon.level] : null;
  const hasNextEvolution = digimon && digimon.nextFormName && digimon.nextFormName.toLowerCase().trim() !== "peak form";
  const showEvoPulse = isHighlightedForEvo && hasNextEvolution;
  const handleClick = (e) => {
    if (showEvoPulse && evoChipCount > 0 && onEvolveWithChip) {
      e.stopPropagation();
      onEvolveWithChip();
      return;
    }
    if (onClick) onClick(e);
  };
  return (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:"90px",gap:"3px",position:"relative"}}>
    {floatEvent && (
      <div key={floatEvent.ts} className="float-num" style={{position:"absolute",top:"12px",left:"78%",color:floatEvent.color,zIndex:20}}>{floatEvent.text}</div>
    )}
    {showInfo && digimon && popupPos && createPortal(
      <>
        {/* Invisible click-catcher — closes the popup on any outside click, no dark backdrop */}
        <div onClick={() => onToggleInfo && onToggleInfo()} style={{position:"fixed",inset:0,zIndex:997}} />
        <div
          onClick={(e) => e.stopPropagation()}
          style={{position:"fixed",top:popupPos.top,left:popupPos.left,transform:"translate(-50%, -100%)",zIndex:998,background:"#0d1117",border:"1px solid #3498db",borderRadius:"8px",padding:"10px 12px",width:`${POPUP_WIDTH}px`,maxWidth:"85vw",boxShadow:"0 8px 30px rgba(0,0,0,0.6)",textAlign:"left"}}
        >
          <div style={{position:"absolute",bottom:"-6px",left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:"6px solid #3498db"}} />
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
            <span style={{fontSize:"11px",fontWeight:"bold",color:"#58a6ff"}}>{digimon.name}</span>
            <button onClick={(e) => {e.stopPropagation(); if (onToggleInfo) onToggleInfo();}} style={{background:"none",border:"none",color:"#8b949e",cursor:"pointer",fontSize:"12px",padding:0,lineHeight:1}}>✕</button>
          </div>
          <div style={{fontSize:"9px",color:"#c9d1d9",lineHeight:"1.6"}}>
            <div>🧬 Attribute: <b style={{color:"#f1c40f"}}>{digimon.attribute || "Unknown"}</b></div>
            <div>⭐ Level: <b style={{color:"#2ecc71"}}>{digimon.level || "Unknown"}</b></div>
            <div>✨ Next: <b style={{color:"#e67e22"}}>{digimon.nextFormName || "Peak Form"}</b></div>
          </div>
          {neededChip && evoChipCount > 0 && hasNextEvolution && (
            <p style={{margin:"6px 0 0 0",fontSize:"8px",color:"#c792ea",lineHeight:"1.3"}}>🧬 Tap this Digimon while its chip is highlighted in Inventory to evolve.</p>
          )}
          {onSell && digimon?.hp <= 0 && (
            <p style={{margin:"6px 0 0 0",fontSize:"8px",color:"#8b949e",lineHeight:"1.3"}}>🪙 Revive before selling — fainted Digimon can't be sold.</p>
          )}
          {onSell && digimon?.hp > 0 && digimon?.maxHp > 0 && digimon.hp < digimon.maxHp / 2 && (
            <p style={{margin:"6px 0 0 0",fontSize:"8px",color:"#e67e22",lineHeight:"1.3"}}>🪙 Below half HP — sell price cut in half.</p>
          )}
          {(onRelease || (onSell && sellValue != null && digimon?.hp > 0)) && (
            <div style={{display:"flex",gap:"5px",marginTop:"8px"}}>
              {onSell && sellValue != null && digimon?.hp > 0 && (
                <button
                  onClick={(e) => {e.stopPropagation(); onSell(); if (onToggleInfo) onToggleInfo();}}
                  style={{flex:1,fontSize:"9px",fontWeight:"bold",padding:"5px 0",borderRadius:"5px",border:"1px solid #f1c40f",cursor:"pointer",background:"#2d2410",color:"#f1c40f"}}
                >
                  🪙 Sell {sellValue}
                </button>
              )}
              {onRelease && (
                <button
                  onClick={(e) => {e.stopPropagation(); onRelease(); if (onToggleInfo) onToggleInfo();}}
                  style={{flex:1,fontSize:"9px",fontWeight:"bold",padding:"5px 0",borderRadius:"5px",border:"1px solid #e74c3c",cursor:"pointer",background:"#2d1a1a",color:"#e74c3c"}}
                >
                  🌐 Release
                </button>
              )}
            </div>
          )}
        </div>
      </>,
      document.body
    )}
    {digimon?.name && (
      <span style={{fontSize:"10px",fontWeight:"bold",color:isEvolving?"#f1c40f":"#58a6ff",textAlign:"center",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",width:"100%",transition:"color 0.3s"}}>
        {digimon.name}
      </span>
    )}
    <button
      ref={cardRef}
      key={animKey}
      onClick={digimon ? handleClick : undefined}
      onDoubleClick={handleDoubleClick}
      disabled={!digimon}
      className={`${animClass || ""} ${isEvolving && !reducedMotion ? "evo-glow" : ""} ${isLowHp && !reducedMotion ? "low-hp-pulse" : ""} ${showEvoPulse && !reducedMotion ? "evo-chip-pulse" : ""}`}
      style={{...slotStyle,border:showEvoPulse?"2px solid #f1c40f":selected?"3px solid #3498db":isEvolving?"2px solid #f1c40f":isLowHp?"2px solid #e74c3c":slotStyle.border,opacity:digimon?.hp<=0?0.6:1}}
    >
      {digimon?.image ? (
        <div style={{textAlign:"center",position:"relative",width:"100%",height:"100%"}}>
          <img src={digimon.image} alt={digimon.name} style={{width:"90%",height:"90%",objectFit:"contain",marginTop:"5%",filter:digimon.hp<=0?"grayscale(100%)":isEvolving?"brightness(4) saturate(0)":"none",transition:isEvolving?"filter 0.4s ease":"filter 0.6s ease"}} />
          <span style={{position:"absolute",top:"2px",left:"2px",fontSize:"12px",background:"rgba(0,0,0,0.65)",borderRadius:"5px",padding:"1px 3px",lineHeight:1}} title={digimon.attribute || "Unknown"}>{getAttributeEmoji(digimon.attribute)}</span>
          <div style={{position:"absolute",bottom:0,left:0,right:0,background:digimon.hp<=0?"rgba(231,76,60,0.95)":isLowHp?"rgba(231,76,60,0.75)":"rgba(0,0,0,0.85)",fontSize:9,fontWeight:"bold",color:"#fff",padding:"2px 0"}}>
            {digimon.hp<=0?"DEAD":`HP:${digimon.hp}/${digimon.maxHp}`}
          </div>
        </div>
      ) : (
        <span style={{color:"#444",fontSize:"20px"}}>🥚</span>
      )}
    </button>
    {digimon && (
      <div style={{width:"100%",background:"#331c1c",height:"4px",borderRadius:"3px",overflow:"hidden",position:"relative"}}>
        <div style={{background:digimon.hp<=0?"#e74c3c":"#2ecc71",height:"100%",width:`${Math.max(0,Math.min(100,(digimon.hp/digimon.maxHp)*100))}%`,transition:"width 0.3s ease"}} />
        {hitFlash && <div style={{position:"absolute",inset:0,background:"rgba(231,76,60,0.7)",borderRadius:"3px",animation:"hpFlash 0.35s ease-out forwards"}} />}
      </div>
    )}
  </div>
  );
});

// ============================================================
// SETTINGS MODAL
// ============================================================
// ============================================================
// LEADERBOARD MODAL
// ============================================================
const SCORE_EXPLAINERS = [
  {icon: "⚔️", label: "Defeat a Wild Digimon", pts: SCORE_EVENTS.WILD_DEFEATED},
  {icon: "🕸️", label: "Capture a Wild Digimon", pts: SCORE_EVENTS.WILD_CAPTURED},
  {icon: "👑", label: "Capture a Legendary", pts: SCORE_EVENTS.LEGENDARY_CAPTURED},
  {icon: "🚨", label: "Clear a Nemesis wave", pts: SCORE_EVENTS.VILLAIN_WAVE},
  {icon: "🎯", label: "Clear a wave without using items", pts: SCORE_EVENTS.WAVE_NO_ITEMS},
  {icon: "💀", label: "Defeat the Wave 8 boss", pts: SCORE_EVENTS.CHRONOMON_DEFEATED},
];

const LeaderboardModal = ({onClose, getLeaderboard}) => {
  const entries = getLeaderboard();
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",boxSizing:"border-box"}}>
      <div style={{background:"#1b1c24",border:"2px solid #f1c40f",borderRadius:"16px",padding:"24px",maxWidth:"460px",width:"100%",maxHeight:"88vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:"14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h2 style={{margin:0,color:"#f1c40f",fontSize:"1.2rem"}}>🏆 Leaderboard</h2>
          <button onClick={onClose} style={{background:"#21262d",color:"#fff",border:"1px solid #30363d",borderRadius:"8px",padding:"6px 14px",cursor:"pointer",fontWeight:"bold"}}>✕ Close</button>
        </div>

        {entries.length === 0 ? (
          <p style={{margin:"12px 0",color:"#8b949e",fontSize:"0.85rem",textAlign:"center",fontStyle:"italic"}}>No runs recorded yet. Finish a run to claim the top spot!</p>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {entries.map((e, i) => {
              const medal = ["🥇","🥈","🥉"][i] || `#${i + 1}`;
              const dateStr = e.date ? new Date(e.date).toLocaleDateString() : "";
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:"12px",background:"#0d1117",border:"1px solid #30363d",borderRadius:"10px",padding:"10px 14px"}}>
                  <span style={{fontSize:"1.2rem",minWidth:"32px",textAlign:"center"}}>{medal}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"1rem",fontWeight:"bold",color:"#fff"}}>{e.score.toLocaleString()} pts</div>
                    <div style={{fontSize:"0.75rem",color:"#8b949e"}}>{e.rankLabel} · {e.victory ? "👑 Victory" : `💀 Fell on Wave ${e.wave}`} · {dateStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{background:"#0d1117",border:"1px solid #30363d",borderRadius:"10px",padding:"12px 14px"}}>
          <h3 style={{margin:"0 0 8px 0",color:"#58a6ff",fontSize:"0.85rem"}}>📊 How Scoring Works</h3>
          <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
            {SCORE_EXPLAINERS.map((s, i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:"0.75rem",color:"#c9d1d9"}}>
                <span>{s.icon} {s.label}</span>
                <b style={{color:"#f1c40f"}}>+{s.pts}</b>
              </div>
            ))}
          </div>
          <p style={{margin:"8px 0 0 0",fontSize:"0.7rem",color:"#8b949e",lineHeight:"1.4"}}>
            🏆 Clearing all 8 Nemesis waves multiplies your final score based on how much of your team's HP is left (roughly 1×–2×) — the healthier your team, the bigger the bonus.
          </p>
        </div>
      </div>
    </div>
  );
};

const SettingsModal = ({onClose, musicVolume, onMusicVolumeChange, sfxVolume, onSfxVolumeChange, isMuted, onToggleMute, reducedMotion, onToggleReducedMotion, evoAnimEnabled, onToggleEvoAnimation, onRestart}) => (
  <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",boxSizing:"border-box"}}>
    <div style={{background:"#1b1c24",border:"2px solid #3498db",borderRadius:"16px",padding:"24px",maxWidth:"400px",width:"100%",display:"flex",flexDirection:"column",gap:"18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{margin:0,color:"#58a6ff",fontSize:"1.2rem"}}>⚙️ Settings</h2>
        <button onClick={onClose} style={{background:"#21262d",color:"#fff",border:"1px solid #30363d",borderRadius:"8px",padding:"6px 14px",cursor:"pointer",fontWeight:"bold"}}>✕ Close</button>
      </div>

      <div style={{opacity:isMuted?0.45:1,transition:"opacity 0.2s"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
          <label style={{fontSize:"0.85rem",color:"#c9d1d9",fontWeight:"bold"}}>🎵 Music Volume</label>
          <span style={{fontSize:"0.8rem",color:"#8b949e"}}>{Math.round(musicVolume * 100)}%</span>
        </div>
        <input
          type="range" min="0" max="100" value={Math.round(musicVolume * 100)}
          onChange={(e) => onMusicVolumeChange(parseInt(e.target.value, 10) / 100)}
          disabled={isMuted}
          style={{width:"100%",accentColor:"#3498db"}}
        />
      </div>

      <div style={{opacity:isMuted?0.45:1,transition:"opacity 0.2s"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
          <label style={{fontSize:"0.85rem",color:"#c9d1d9",fontWeight:"bold"}}>💥 SFX Volume</label>
          <span style={{fontSize:"0.8rem",color:"#8b949e"}}>{Math.round(sfxVolume * 100)}%</span>
        </div>
        <input
          type="range" min="0" max="100" value={Math.round(sfxVolume * 100)}
          onChange={(e) => onSfxVolumeChange(parseInt(e.target.value, 10) / 100)}
          disabled={isMuted}
          style={{width:"100%",accentColor:"#e67e22"}}
        />
      </div>

      <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontSize:"0.85rem",color:"#c9d1d9"}}>
        <span>🔇 Mute all audio</span>
        <input type="checkbox" checked={isMuted} onChange={onToggleMute} />
      </label>

      <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontSize:"0.85rem",color:"#c9d1d9"}}>
        <span>🎬 Evolution animation</span>
        <input type="checkbox" checked={evoAnimEnabled} onChange={onToggleEvoAnimation} />
      </label>

      <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontSize:"0.85rem",color:"#c9d1d9"}}>
        <span>🩹 Reduced motion (screen shake)</span>
        <input type="checkbox" checked={reducedMotion} onChange={onToggleReducedMotion} />
      </label>

      <p style={{margin:0,fontSize:"0.7rem",color:"#444",lineHeight:"1.4"}}>Mute overrides both sliders without changing your saved levels.</p>

      {onRestart && (
        <button
          onClick={() => {if (window.confirm("Restart your run? This cannot be undone.")) {onRestart(); onClose();}}}
          style={{background:"#e74c3c",color:"#fff",border:"none",borderRadius:"8px",padding:"10px 16px",fontWeight:"bold",fontSize:"0.85rem",cursor:"pointer",marginTop:"4px"}}
        >
          🔄 Restart Run
        </button>
      )}
    </div>
  </div>
);

// ============================================================
// RESERVE FULL MODAL — shown when a capture/hatch can't fit
// ============================================================
const ReserveFullModal = ({pendingCapture, reserve, onResolve}) => {
  if (!pendingCapture) return null;
  const {reward} = pendingCapture;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",boxSizing:"border-box"}}>
      <div style={{background:"#1b1c24",border:"2px solid #f1c40f",borderRadius:"16px",padding:"22px",maxWidth:"420px",width:"100%",display:"flex",flexDirection:"column",gap:"14px",textAlign:"center"}}>
        <div style={{fontSize:"1.8rem"}}>📦</div>
        <h3 style={{margin:0,color:"#f1c40f"}}>Reserve Box is Full!</h3>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"10px"}}>
          <div style={{width:"56px",height:"56px",background:"#0d1117",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #3498db",flexShrink:0}}>
            <img src={reward.image} alt={reward.name} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} />
          </div>
          <p style={{margin:0,color:"#c9d1d9",fontSize:"0.85rem",textAlign:"left"}}>
            <b style={{color:"#58a6ff"}}>{reward.name}</b> wants to join, but your Reserve Box is full. Release a current member to make room, or let it go.
          </p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"8px"}}>
          {reserve.map((d, idx) => (
            <button key={idx} onClick={() => onResolve(idx)} style={{background:"#0d1117",border:"1px solid #30363d",borderRadius:"8px",padding:"6px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}}>
              <div style={{width:"36px",height:"36px",background:"#16171d",borderRadius:"6px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <img src={d.image} alt={d.name} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} />
              </div>
              <span style={{fontSize:"8px",color:"#c9d1d9",fontWeight:"bold",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{d.name}</span>
              <span style={{fontSize:"7px",color:"#e74c3c",fontWeight:"bold"}}>Release &amp; swap</span>
            </button>
          ))}
        </div>
        <button onClick={() => onResolve(null)} style={{padding:"10px 0",background:"#21262d",color:"#ff7b72",border:"1px solid #e74c3c",borderRadius:"8px",cursor:"pointer",fontWeight:"bold",fontSize:"0.85rem"}}>
          🌐 Let {reward.name} go instead
        </button>
      </div>
    </div>
  );
};

// ============================================================
// MAIN GAME SCREEN
// ============================================================
function GameCore({game, mode, wheelColors, evoChipForLevel, evoChipLabel, evoChipTargetTier, evoChipKeys, shopItems, saveKey, highscoreKey, bestiaryKey, getLeaderboard, onExitMode, onSwitchMode}) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showBestiary, setShowBestiary] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [releaseConfirm, setReleaseConfirm] = useState(null);
  const [sellConfirm, setSellConfirm] = useState(null); // {index, isReserve} | null — Shop mode only
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [infoPopup, setInfoPopup] = useState(null); // {type: 'party'|'reserve', idx} | null
  const [highlightedEvoTier, setHighlightedEvoTier] = useState(null);

  const [enemyAnimState, setEnemyAnimState] = useState(null);
  const [playerAnimState, setPlayerAnimState] = useState(null);
  const [screenFlash, setScreenFlash] = useState(null);
  const [partyHpFlash, setPartyHpFlash] = useState({});

  // ✅ Settings: independent music/SFX volume, mute, and reduced motion — persisted across sessions
  const [musicVolume, setMusicVolume] = useState(() => {
    try {const v = localStorage.getItem("digiroulette_music_volume"); return v === null ? 1.0 : parseFloat(v);} catch {return 1.0;}
  });
  const [sfxVolume, setSfxVolume] = useState(() => {
    try {const v = localStorage.getItem("digiroulette_sfx_volume"); return v === null ? 1.0 : parseFloat(v);} catch {return 1.0;}
  });
  const [isMuted, setIsMuted] = useState(() => {
    try {return localStorage.getItem("digiroulette_muted") === "true";} catch {return false;}
  });
  const [reducedMotion, setReducedMotion] = useState(() => {
    try {return localStorage.getItem("digiroulette_reduced_motion") === "true";} catch {return false;}
  });

  useEffect(() => {
    sfx.setMusicVolume(musicVolume);
  }, [musicVolume]);

  useEffect(() => {
    sfx.setSfxVolume(sfxVolume);
  }, [sfxVolume]);

  const handleMusicVolumeChange = (v) => {
    setMusicVolume(v);
    try {localStorage.setItem("digiroulette_music_volume", String(v));} catch {}
  };
  const handleSfxVolumeChange = (v) => {
    setSfxVolume(v);
    try {localStorage.setItem("digiroulette_sfx_volume", String(v));} catch {}
  };
  const handleToggleMute = () => {
    const nowMuted = sfx.toggleMute();
    setIsMuted(nowMuted);
    try {localStorage.setItem("digiroulette_muted", String(nowMuted));} catch {}
  };
  const handleToggleReducedMotion = (e) => {
    const next = e.target.checked;
    setReducedMotion(next);
    try {localStorage.setItem("digiroulette_reduced_motion", String(next));} catch {}
  };


  const lastEnemyTs = useRef(0);
  const lastPlayerTs = useRef(0);
  const lowHpWarnedRef = useRef(new Set());

  useEffect(() => {
    const seen = localStorage.getItem("digiroulette_tutorial_seen");
    if (!seen) setShowTutorial(true);
  }, []);



  useEffect(() => {
    if (game.phase === "start") {
      setHighlightedEvoTier(null);
      setInfoPopup(null);
    }
  }, [game.phase]);

  // ✅ Low-HP urgency cue: play a one-shot warning the moment the active fighter first drops
  // below 20% HP, and clear the flag once they recover or a new fighter takes over.
  useEffect(() => {
    const activeIdx = game.party.findIndex((d) => d && d.hp > 0);
    if (activeIdx === -1) return;
    const digi = game.party[activeIdx];
    if (!digi || !digi.maxHp) return;
    const ratio = digi.hp / digi.maxHp;
    if (ratio <= 0.2) {
      if (!lowHpWarnedRef.current.has(activeIdx)) {
        lowHpWarnedRef.current.add(activeIdx);
        if (sfx.playLowHpWarning) sfx.playLowHpWarning();
      }
    } else {
      lowHpWarnedRef.current.delete(activeIdx);
    }
  }, [game.party]);

  useEffect(() => {
    if (!game.enemyHitAnim) return;
    if (game.enemyHitAnim.ts === lastEnemyTs.current) return;
    lastEnemyTs.current = game.enemyHitAnim.ts;
    const {type} = game.enemyHitAnim;
    setEnemyAnimState({type, ts: game.enemyHitAnim.ts});
    setScreenFlash(type);
    const dur = type === "crit" ? 500 : 350;
    const t = setTimeout(() => {setEnemyAnimState(null); setScreenFlash(null);}, dur);
    return () => clearTimeout(t);
  }, [game.enemyHitAnim]);

  useEffect(() => {
    if (!game.playerHitAnim) return;
    if (game.playerHitAnim.ts === lastPlayerTs.current) return;
    lastPlayerTs.current = game.playerHitAnim.ts;
    const {type} = game.playerHitAnim;
    setPlayerAnimState({type, ts: game.playerHitAnim.ts});
    setScreenFlash(type);
    const activeIdx = game.party.findIndex((d) => d && d.hp > 0);
    if (activeIdx !== -1) {
      setPartyHpFlash((prev) => ({...prev, [activeIdx]: true}));
      setTimeout(() => setPartyHpFlash((prev) => ({...prev, [activeIdx]: false})), 400);
    }
    const dur = type === "crit" ? 500 : 350;
    const t = setTimeout(() => {setPlayerAnimState(null); setScreenFlash(null);}, dur);
    return () => clearTimeout(t);
  }, [game.playerHitAnim]);

  const handleCloseTutorial = () => {
    localStorage.setItem("digiroulette_tutorial_seen", "true");
    setShowTutorial(false);
  };

  const handleSpinComplete = (selectedIndex) => {
    setIsWheelSpinning(false);
    if (game.wheelSegments?.[selectedIndex]) setLastResult(game.wheelSegments[selectedIndex].label);
    game.handlePhysicsSpinStopped(selectedIndex);
  };

  const handleSlotClick = (type, index) => {
    // ✅ Party order changes / hot-swaps are locked out while the wheel is actively spinning
    if (isWheelSpinning) return;
    if (!selectedSlot) {setSelectedSlot({type, index}); return;}
    if (selectedSlot.type === "party" && type === "reserve") game.swapPartyAndReserve(selectedSlot.index, index, true);
    else if (selectedSlot.type === "reserve" && type === "party") game.swapPartyAndReserve(index, selectedSlot.index, true);
    else if (selectedSlot.type === "party" && type === "party" && selectedSlot.index !== index) game.swapPartyAndReserve(selectedSlot.index, index, false);
    setSelectedSlot(null);
  };

  const handleKeyDown = useCallback((e) => {
    if (["loading","resume_prompt"].includes(game.phase) || showTutorial || showBestiary || showSettings || showLeaderboard || releaseConfirm || sellConfirm || game.pendingCapture) return;
    if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT") return;
    if (e.code === "Space") {
      e.preventDefault();
      // ✅ FIX 2: Blur focused element first so Space never re-fires Heal/Revive/Release
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
      const btn = document.querySelector(".spin-btn");
      if (btn && !btn.disabled) btn.click();
    }
    if (e.code === "KeyH") {
      const idx = game.party.findIndex((d) => d && d.hp > 0 && d.hp < d.maxHp);
      if (idx !== -1 && game.inventory.potion > 0) game.usePotionOnDigimon(idx, false);
    }
  }, [game, showTutorial, showBestiary, showSettings, showLeaderboard, releaseConfirm, sellConfirm]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isBossWave = game.villainWaveStage === 8;
  const activePartyIdx = game.party.findIndex((d) => d && d.hp > 0);
  const enemyAnimClass = reducedMotion ? "" : (enemyAnimState?.type === "crit" ? "enemy-shake-crit" : enemyAnimState?.type === "hit" ? "enemy-shake" : "");
  const enemyAnimKey = enemyAnimState?.ts || 0;
  const playerAnimClass = reducedMotion ? "" : (playerAnimState?.type === "crit" ? "player-shake-crit" : playerAnimState?.type === "hit" ? "player-shake" : "");
  const playerAnimKey = playerAnimState?.ts || 0;

  // ✅ Floating damage/heal numbers — derived directly from state every render, keyed by their
  // event timestamp. No array, no push, no effect: React's own keyed reconciliation guarantees
  // exactly one node per event, so a duplicate number is structurally impossible here.
  const enemyFloatEvent = (() => {
    const hit = game.enemyHitAnim?.amount ? {ts: game.enemyHitAnim.ts, text: `-${game.enemyHitAnim.amount}`, color: game.enemyHitAnim.type === "crit" ? "#ffcf40" : "#ff5c5c"} : null;
    const heal = game.enemyHealAnim?.amount ? {ts: game.enemyHealAnim.ts, text: `+${game.enemyHealAnim.amount}`, color: "#56d364"} : null;
    if (hit && heal) return hit.ts >= heal.ts ? hit : heal;
    return hit || heal || null;
  })();
  const partyFloatEvents = {};
  if (game.playerHitAnim?.amount && activePartyIdx !== -1) {
    partyFloatEvents[activePartyIdx] = {ts: game.playerHitAnim.ts, text: `-${game.playerHitAnim.amount}`, color: game.playerHitAnim.type === "crit" ? "#ffcf40" : "#ff5c5c"};
  }
  if (game.partyHealAnim?.amount) {
    const existing = partyFloatEvents[game.partyHealAnim.idx];
    if (!existing || game.partyHealAnim.ts >= existing.ts) {
      partyFloatEvents[game.partyHealAnim.idx] = {ts: game.partyHealAnim.ts, text: `+${game.partyHealAnim.amount}`, color: "#56d364"};
    }
  }

  // ── RESUME PROMPT ─────────────────────────────────────────
  if (game.phase === "resume_prompt" || game.showResumePrompt) {
    const save = (() => {try {return JSON.parse(localStorage.getItem(saveKey) || "{}");} catch {return {};}})();
    const savedDate = save.savedAt ? new Date(save.savedAt).toLocaleString() : "Unknown";
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#16171d",color:"#fff"}}>
        <div style={{background:"#1b1c24",border:"2px solid #3498db",borderRadius:"16px",padding:"32px 28px",maxWidth:"420px",width:"90%",textAlign:"center",display:"flex",flexDirection:"column",gap:"20px"}}>
          <div style={{fontSize:"2.5rem"}}>💾</div>
          <h2 style={{margin:0,color:"#58a6ff"}}>Resume Previous Run?</h2>
          <p style={{margin:0,color:"#c9d1d9",fontSize:"0.9rem"}}>
            A saved run was found from <b>{savedDate}</b>.<br />
            Wave <b>{save.villainWaveStage || 0}</b> reached, Score: <b>{save.score || 0}</b>.
          </p>
          <div style={{display:"flex",gap:"12px",justifyContent:"center"}}>
            <button onClick={() => game.handleResume(false)} style={{padding:"12px 24px",background:"#21262d",color:"#fff",border:"1px solid #30363d",borderRadius:"8px",cursor:"pointer",fontWeight:"bold",fontSize:"0.95rem"}}>🆕 New Run</button>
            <button onClick={() => game.handleResume(true)} style={{padding:"12px 24px",background:"#3498db",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:"bold",fontSize:"0.95rem"}}>▶️ Resume</button>
          </div>
          {onExitMode && <button onClick={onExitMode} style={{background:"transparent",border:"none",color:"#6e7681",fontSize:"0.8rem",cursor:"pointer",textDecoration:"underline"}}>🏠 Back to Main Menu</button>}
        </div>
      </div>
    );
  }

  // ── LOADING ──────────────────────────────────────────────
  if (game.phase === "loading") {
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#16171d",color:"#fff",flexDirection:"column",gap:"16px"}}>
        <div style={{fontSize:"2rem"}}>⚡</div>
        <p style={{color:"#58a6ff",fontWeight:"bold"}}>{game.loadingMsg}</p>
      </div>
    );
  }

  // ── START SCREEN ─────────────────────────────────────────
  if (game.phase === "start") {
    const highScore = parseInt(localStorage.getItem(highscoreKey) || "0");
    const bestiaryCount = (() => {try {return JSON.parse(localStorage.getItem(bestiaryKey) || "[]").length;} catch {return 0;}})();
    return (
      <>
        {showTutorial && <TutorialPopup onClose={handleCloseTutorial} steps={mode === "shop" ? SHOP_TUTORIAL_STEPS : RNG_TUTORIAL_STEPS} />}
        {showBestiary && <BestiaryModal fullRoster={game.fullRoster} onClose={() => setShowBestiary(false)} bestiaryKey={bestiaryKey} />}
        {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} getLeaderboard={getLeaderboard} />}
        {showSettings && <SettingsModal
          onClose={() => setShowSettings(false)}
          musicVolume={musicVolume} onMusicVolumeChange={handleMusicVolumeChange}
          sfxVolume={sfxVolume} onSfxVolumeChange={handleSfxVolumeChange}
          isMuted={isMuted} onToggleMute={handleToggleMute}
          reducedMotion={reducedMotion} onToggleReducedMotion={handleToggleReducedMotion}
          evoAnimEnabled={game.evoAnimEnabled} onToggleEvoAnimation={game.toggleEvoAnimation}
        />}
        <div style={{padding:"24px 16px",width:"90vw",maxWidth:"900px",margin:"24px auto",textAlign:"center",background:"#16171d",color:"#fff",borderRadius:"16px",border:"2px solid #2d3139",boxShadow:"0 10px 30px rgba(0,0,0,0.5)"}}>
          {onExitMode && (
            <div style={{display:"flex",justifyContent:"center",gap:"8px",marginBottom:"10px",flexWrap:"wrap"}}>
              <button onClick={onExitMode} style={{fontSize:"10px",fontWeight:"bold",padding:"5px 12px",borderRadius:"20px",border:"1px solid #30363d",background:"#21262d",color:"#8b949e",cursor:"pointer"}}>
                🏠 Home
              </button>
              {onSwitchMode && (
                <button onClick={onSwitchMode} style={{fontSize:"10px",fontWeight:"bold",padding:"5px 12px",borderRadius:"20px",border:"1px solid #30363d",background:"#21262d",color:"#8b949e",cursor:"pointer"}}>
                  🔄 Switch to {mode === "shop" ? "RNG Mode" : "Shop Mode"}
                </button>
              )}
            </div>
          )}
          <h1 style={{color:"#3498db",marginBottom:"6px",fontSize:"clamp(1.4rem,4vw,2.2rem)"}}>Initialize Digital Partner Node</h1>
          <p style={{color:"#8b949e",fontSize:"clamp(0.85rem,2.5vw,1.1rem)",marginTop:0,marginBottom:"12px"}}>Select your starter Digimon to begin:</p>
          {highScore > 0 && (
            <div style={{display:"inline-block",background:"#1b1c24",border:"1px solid #f1c40f",borderRadius:"8px",padding:"6px 16px",marginBottom:"16px"}}>
              <span style={{color:"#f1c40f",fontWeight:"bold",fontSize:"0.9rem"}}>🏆 Best Score: {highScore.toLocaleString()} — {getRank(highScore).rank} {getRank(highScore).label}</span>
            </div>
          )}
          <div style={{display:"flex",gap:"10px",justifyContent:"center",marginBottom:"20px",flexWrap:"wrap"}}>
            <button onClick={() => setShowTutorial(true)} style={{padding:"8px 20px",background:"#21262d",color:"#58a6ff",border:"1px solid #3498db",borderRadius:"8px",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>📖 How to Play</button>
            <button onClick={() => setShowBestiary(true)} style={{padding:"8px 20px",background:"#21262d",color:"#e67e22",border:"1px solid #e67e22",borderRadius:"8px",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>
              📖 Bestiary ({bestiaryCount}/{game.fullRoster.length})
            </button>
            <button onClick={() => setShowLeaderboard(true)} style={{padding:"8px 20px",background:"#21262d",color:"#f1c40f",border:"1px solid #f1c40f",borderRadius:"8px",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>🏆 Leaderboard</button>
            <button onClick={() => setShowSettings(true)} style={{padding:"8px 20px",background:"#21262d",color:"#c9d1d9",border:"1px solid #30363d",borderRadius:"8px",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>⚙️ Settings</button>
          </div>
          {game.loadingMsg && <h3 style={{color:"#db6d28"}}>⏳ {game.loadingMsg}</h3>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(120px, 1fr))",gap:"12px",marginTop:"8px"}}>
            {(game.starters||[]).map((s) => (
              <button key={s.dapiName} onClick={() => game.chooseStarter(s)}
                style={{padding:"10px",background:"#21262d",color:"#fff",border:"1px solid #30363d",borderRadius:"12px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"8px",transition:"transform 0.2s"}}
                onMouseEnter={(e) => e.currentTarget.style.transform="scale(1.04)"}
                onMouseLeave={(e) => e.currentTarget.style.transform="none"}
              >
                <div style={{width:"72px",height:"72px",background:"#16171d",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",padding:"4px"}}>
                  <img src={s.image} alt={s.name} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} />
                </div>
                <span style={{fontSize:"0.85rem",fontWeight:"bold"}}>{s.dapiName}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  // ── GAME OVER ────────────────────────────────────────────
  if (game.phase === "game_over") {
    const rank = getRank(game.score);
    const highScore = parseInt(localStorage.getItem(highscoreKey) || "0");
    return (
      <>
      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} getLeaderboard={getLeaderboard} />}
      <div style={{padding:"40px 20px",width:"90vw",maxWidth:"700px",margin:"40px auto",textAlign:"center",background:"#1c1214",color:"#fff",borderRadius:"16px",border:"2px solid #442326"}}>
        <h1 style={{color:"#ff7b72",margin:"0 0 12px 0",fontSize:"clamp(1.6rem,5vw,2.5rem)"}}>💀 RUN TERMINATED</h1>
        <div style={{background:"#0d1117",border:"1px solid #30363d",borderRadius:"12px",padding:"16px",margin:"12px 0"}}>
          <div style={{fontSize:"2rem",fontWeight:"bold",color:"#e67e22"}}>{game.score.toLocaleString()}</div>
          <div style={{fontSize:"1.1rem",color:"#fff",fontWeight:"bold"}}>{rank.rank} — {rank.label}</div>
          {game.score > 0 && game.score >= highScore && <div style={{fontSize:"0.85rem",color:"#f1c40f",marginTop:"4px"}}>🏆 New High Score!</div>}
        </div>
        <div style={{background:"#0d1117",border:"2px solid #30363d",borderRadius:"12px",padding:"16px",margin:"20px 0",textAlign:"left",height:"160px",overflowY:"auto"}}>
          <h4 style={{margin:"0 0 8px 0",color:"#8b949e"}}>Final Logs:</h4>
          {game.log.slice(0,8).map((l,i) => <p key={i} style={{margin:"4px 0",fontSize:"13px",fontFamily:"monospace",color:"#ff7b72"}}>{l}</p>)}
        </div>
        <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={game.resetToStart} style={{padding:"14px 36px",background:"#ff7b72",color:"#000",border:"none",borderRadius:"30px",fontWeight:"bold",cursor:"pointer",fontSize:"1rem"}}>
            🔄 INITIALIZE NEW RUN
          </button>
          <button onClick={() => setShowLeaderboard(true)} style={{padding:"14px 28px",background:"#21262d",color:"#f1c40f",border:"1px solid #f1c40f",borderRadius:"30px",fontWeight:"bold",cursor:"pointer",fontSize:"1rem"}}>
            🏆 Leaderboard
          </button>
          {onExitMode && (
            <button onClick={onExitMode} style={{padding:"14px 28px",background:"#21262d",color:"#c9d1d9",border:"1px solid #30363d",borderRadius:"30px",fontWeight:"bold",cursor:"pointer",fontSize:"1rem"}}>
              🏠 Home
            </button>
          )}
        </div>
      </div>
      </>
    );
  }

  // ── VICTORY ──────────────────────────────────────────────
  if (game.phase === "victory") {
    const allDigimon = [...game.party,...game.reserve].filter(Boolean);
    const rank = getRank(game.score);
    const highScore = parseInt(localStorage.getItem(highscoreKey) || "0");
    return (
      <>
      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} getLeaderboard={getLeaderboard} />}
      <div style={{padding:"40px 20px",width:"90vw",maxWidth:"800px",margin:"40px auto",textAlign:"center",background:"#121c14",color:"#fff",borderRadius:"16px",border:"2px solid #234426",boxShadow:"0 0 40px rgba(46,204,113,0.2)"}}>
        <div style={{fontSize:"3rem",marginBottom:"8px"}}>🏆</div>
        <h1 style={{color:"#2ecc71",margin:"0 0 8px 0",fontSize:"clamp(1.6rem,5vw,2.5rem)"}}>DIGITAL WORLD SAVED!</h1>
        <p style={{color:"#c9d1d9",fontSize:"1rem",lineHeight:"1.6",marginBottom:"16px"}}>All 8 Nemesis Waves cleared. Chronomon DM has been defeated.</p>
        <div style={{background:"#0d1117",border:"2px solid #f1c40f",borderRadius:"12px",padding:"16px",marginBottom:"20px"}}>
          <div style={{fontSize:"2.5rem",fontWeight:"bold",color:"#f1c40f"}}>{game.score.toLocaleString()}</div>
          <div style={{fontSize:"1.3rem",color:"#fff",fontWeight:"bold",marginTop:"4px"}}>{rank.rank} — {rank.label}</div>
          {game.score >= highScore && <div style={{fontSize:"0.85rem",color:"#2ecc71",marginTop:"6px"}}>🌟 New High Score!</div>}
        </div>
        <div style={{background:"#0d1117",border:"1px solid #234426",borderRadius:"12px",padding:"20px",marginBottom:"24px"}}>
          <h3 style={{margin:"0 0 16px 0",color:"#2ecc71",fontSize:"1rem"}}>🏅 YOUR FINAL TEAM</h3>
          <div style={{display:"flex",flexWrap:"wrap",gap:"12px",justifyContent:"center"}}>
            {allDigimon.map((digi,idx) => (
              <div key={idx} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",background:"#16171d",borderRadius:"10px",padding:"10px",border:"1px solid #234426",minWidth:"80px"}}>
                <div style={{width:"70px",height:"70px",background:"#0d1117",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                  <img src={digi.image} alt={digi.name} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} />
                </div>
                <span style={{fontSize:"11px",fontWeight:"bold",color:"#58a6ff",textAlign:"center"}}>{digi.name}</span>
                <span style={{fontSize:"10px",color:"#2ecc71"}}>{digi.level}</span>
                <span style={{fontSize:"9px",color:"#8b949e"}}>HP: {digi.hp}/{digi.maxHp}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={game.resetToStart} style={{padding:"14px 36px",background:"#2ecc71",color:"#000",border:"none",borderRadius:"30px",fontWeight:"bold",cursor:"pointer",fontSize:"1rem"}}>
            🔄 PLAY AGAIN
          </button>
          <button onClick={() => setShowLeaderboard(true)} style={{padding:"14px 28px",background:"#21262d",color:"#f1c40f",border:"1px solid #f1c40f",borderRadius:"30px",fontWeight:"bold",cursor:"pointer",fontSize:"1rem"}}>
            🏆 Leaderboard
          </button>
          {onExitMode && (
            <button onClick={onExitMode} style={{padding:"14px 28px",background:"#21262d",color:"#c9d1d9",border:"1px solid #30363d",borderRadius:"30px",fontWeight:"bold",cursor:"pointer",fontSize:"1rem"}}>
              🏠 Home
            </button>
          )}
        </div>
      </div>
      </>
    );
  }

  // ── MAIN GAME ────────────────────────────────────────────
  return (
    <>
      {showTutorial && <TutorialPopup onClose={handleCloseTutorial} steps={mode === "shop" ? SHOP_TUTORIAL_STEPS : RNG_TUTORIAL_STEPS} />}
      {showBestiary && <BestiaryModal fullRoster={game.fullRoster} onClose={() => setShowBestiary(false)} bestiaryKey={bestiaryKey} />}
      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} getLeaderboard={getLeaderboard} />}
      {showSettings && <SettingsModal
        onClose={() => setShowSettings(false)}
        musicVolume={musicVolume} onMusicVolumeChange={handleMusicVolumeChange}
        sfxVolume={sfxVolume} onSfxVolumeChange={handleSfxVolumeChange}
        isMuted={isMuted} onToggleMute={handleToggleMute}
        reducedMotion={reducedMotion} onToggleReducedMotion={handleToggleReducedMotion}
        evoAnimEnabled={game.evoAnimEnabled} onToggleEvoAnimation={game.toggleEvoAnimation}
        onRestart={game.resetToStart}
      />}

      {releaseConfirm && (() => {
        const pool = releaseConfirm.isReserve ? game.reserve : game.party;
        const target = pool[releaseConfirm.index];
        return (
          <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"#1b1c24",border:"2px solid #e74c3c",borderRadius:"12px",padding:"24px",maxWidth:"320px",width:"90%",textAlign:"center",display:"flex",flexDirection:"column",gap:"16px"}}>
              <div style={{fontSize:"2rem"}}>🌐</div>
              <h3 style={{margin:0,color:"#ff7b72"}}>Release Digimon?</h3>
              <p style={{margin:0,color:"#c9d1d9",fontSize:"0.9rem"}}>Release <b style={{color:"#58a6ff"}}>{target?.name}</b> back to the Digital World? This cannot be undone.</p>
              <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
                <button onClick={() => setReleaseConfirm(null)} style={{padding:"10px 20px",background:"#21262d",color:"#fff",border:"1px solid #30363d",borderRadius:"8px",cursor:"pointer",fontWeight:"bold"}}>Cancel</button>
                <button onClick={() => {game.releaseDigimon(releaseConfirm.index,releaseConfirm.isReserve); setReleaseConfirm(null);}} style={{padding:"10px 20px",background:"#e74c3c",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:"bold"}}>Release</button>
              </div>
            </div>
          </div>
        );
      })()}

      {sellConfirm && (() => {
        const pool = sellConfirm.isReserve ? game.reserve : game.party;
        const target = pool[sellConfirm.index];
        const value = target ? getSellValue(target.level, target.hp, target.maxHp) : 0;
        return (
          <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"#1b1c24",border:"2px solid #f1c40f",borderRadius:"12px",padding:"24px",maxWidth:"320px",width:"90%",textAlign:"center",display:"flex",flexDirection:"column",gap:"16px"}}>
              <div style={{fontSize:"2rem"}}>🪙</div>
              <h3 style={{margin:0,color:"#f1c40f"}}>Sell Digimon?</h3>
              <p style={{margin:0,color:"#c9d1d9",fontSize:"0.9rem"}}>Sell <b style={{color:"#58a6ff"}}>{target?.name}</b> for <b style={{color:"#f1c40f"}}>🪙 {value}</b>? This cannot be undone.</p>
              <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
                <button onClick={() => setSellConfirm(null)} style={{padding:"10px 20px",background:"#21262d",color:"#fff",border:"1px solid #30363d",borderRadius:"8px",cursor:"pointer",fontWeight:"bold"}}>Cancel</button>
                <button onClick={() => {game.sellDigimon(sellConfirm.index,sellConfirm.isReserve); setSellConfirm(null);}} style={{padding:"10px 20px",background:"#f1c40f",color:"#000",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:"bold"}}>🪙 Sell</button>
              </div>
            </div>
          </div>
        );
      })()}

      <ReserveFullModal pendingCapture={game.pendingCapture} reserve={game.reserve} onResolve={game.resolvePendingCapture} />

      <style>{`
        .game-root{display:flex;flex-direction:row;gap:10px;padding:10px;width:100vw;height:100vh;max-height:100vh;box-sizing:border-box;background:#16171d;color:#fff;overflow:hidden;position:relative;}
        .col-left{width:26%;display:flex;flex-direction:column;gap:8px;overflow:hidden;height:100%;box-sizing:border-box;}
        .col-center{width:46%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;overflow:hidden;height:100%;box-sizing:border-box;}
        .col-right{width:28%;display:flex;flex-direction:column;gap:10px;overflow:hidden;height:100%;box-sizing:border-box;}
        @keyframes shake{0%,100%{transform:translateX(0) rotate(0deg);}15%{transform:translateX(-9px) rotate(-2.5deg);}30%{transform:translateX(9px) rotate(2.5deg);}45%{transform:translateX(-6px) rotate(-1.5deg);}60%{transform:translateX(6px) rotate(1.5deg);}75%{transform:translateX(-3px);}90%{transform:translateX(3px);}}
        @keyframes shake-crit{0%,100%{transform:translateX(0) rotate(0deg) scale(1);}10%{transform:translateX(-12px) rotate(-3deg) scale(1.04);}25%{transform:translateX(12px) rotate(3deg) scale(1.04);}40%{transform:translateX(-8px) rotate(-2deg) scale(1.02);}55%{transform:translateX(8px) rotate(2deg) scale(1.02);}70%{transform:translateX(-4px);}85%{transform:translateX(4px);}}
        .enemy-shake{animation:shake 0.35s ease-in-out;}
        .enemy-shake-crit{animation:shake-crit 0.50s ease-in-out;}
        .player-shake{animation:shake 0.35s ease-in-out;}
        .player-shake-crit{animation:shake-crit 0.50s ease-in-out;}
        @keyframes flash-hit{0%,100%{box-shadow:none}50%{box-shadow:inset 0 0 0 4px rgba(231,76,60,0.55)}}
        @keyframes flash-crit{0%,100%{box-shadow:none}25%{box-shadow:inset 0 0 0 7px rgba(240,136,62,0.80)}75%{box-shadow:inset 0 0 0 7px rgba(231,76,60,0.80)}}
        .screen-flash-hit{animation:flash-hit 0.35s ease-in-out;}
        .screen-flash-crit{animation:flash-crit 0.50s ease-in-out;}
        @keyframes evo-glow-pulse{0%,100%{box-shadow:0 0 8px 2px #f1c40f,0 0 20px 4px rgba(241,196,15,0.4);}50%{box-shadow:0 0 20px 8px #fff,0 0 40px 12px rgba(241,196,15,0.9);}}
        .evo-glow{animation:evo-glow-pulse 0.6s ease-in-out infinite;border:2px solid #f1c40f !important;}
        @keyframes hpFlash{0%{opacity:1;}100%{opacity:0;}}
        @keyframes floatUp{0%{opacity:1;transform:translate(-50%,0);}100%{opacity:0;transform:translate(-50%,-38px);}}
        .float-num{font-size:22px;font-weight:900;letter-spacing:0.5px;pointer-events:none;animation:floatUp 0.9s ease-out forwards;text-shadow:-1.5px -1.5px 0 #000,1.5px -1.5px 0 #000,-1.5px 1.5px 0 #000,1.5px 1.5px 0 #000,0 2px 4px rgba(0,0,0,0.6);}
        @keyframes lowHpPulse{0%,100%{box-shadow:0 0 6px 2px rgba(231,76,60,0.5);}50%{box-shadow:0 0 16px 6px rgba(231,76,60,0.95);}}
        .low-hp-pulse{animation:lowHpPulse 0.9s ease-in-out infinite;}
        @keyframes evoChipPulse{0%,100%{box-shadow:0 0 6px 2px rgba(241,196,15,0.5);border-color:#f1c40f;}50%{box-shadow:0 0 18px 7px rgba(241,196,15,0.95);border-color:#fff8dc;}}
        .evo-chip-pulse{animation:evoChipPulse 0.8s ease-in-out infinite;}
        @keyframes shopItemPulse{0%{transform:scale(1);}30%{transform:scale(1.05);}100%{transform:scale(1);}}
        .shop-item-pulse{animation:shopItemPulse 0.45s ease-out;}
        @keyframes shopToastIn{0%{opacity:0;transform:translateY(-6px);}15%{opacity:1;transform:translateY(0);}80%{opacity:1;}100%{opacity:0;transform:translateY(-6px);}}
        .shop-toast{animation:shopToastIn 1.3s ease-out forwards;}
        @media(max-width:768px) and (orientation:landscape){.game-root{gap:6px;padding:6px;}.col-left{width:24%;}.col-center{width:42%;}.col-right{width:34%;}}
        @media(max-width:768px) and (orientation:portrait){.game-root{flex-direction:column;height:auto;min-height:100vh;overflow-y:auto;}.col-left,.col-center,.col-right{width:100%;height:auto;}}
      `}</style>

      <div className={`game-root ${reducedMotion?"":(screenFlash==="crit"?"screen-flash-crit":screenFlash==="hit"?"screen-flash-hit":"")}`}>

        <div style={{position:"absolute",top:"8px",left:"50%",transform:"translateX(-50%)",zIndex:100,display:"flex",gap:"8px",flexWrap:"wrap",justifyContent:"center"}}>
          <button onClick={() => setShowTutorial(true)} style={{background:"#21262d",color:"#58a6ff",border:"1px solid #3498db",borderRadius:"6px",padding:"5px 10px",fontWeight:"bold",fontSize:"11px",cursor:"pointer"}}>📖 Help</button>
          <button onClick={() => setShowBestiary(true)} style={{background:"#21262d",color:"#e67e22",border:"1px solid #e67e22",borderRadius:"6px",padding:"5px 10px",fontWeight:"bold",fontSize:"11px",cursor:"pointer"}}>📖 Dex</button>
          <button onClick={() => setShowLeaderboard(true)} style={{background:"#21262d",color:"#f1c40f",border:"1px solid #f1c40f",borderRadius:"6px",padding:"5px 10px",fontWeight:"bold",fontSize:"11px",cursor:"pointer"}}>🏆 Board</button>
          <button onClick={() => setShowSettings(true)} style={{background:"#21262d",color:"#c9d1d9",border:"1px solid #30363d",borderRadius:"6px",padding:"5px 10px",fontWeight:"bold",fontSize:"11px",cursor:"pointer"}}>⚙️ Settings</button>
        </div>

        {/* ── COL 1: BATTLE ZONE ── */}
        <div className="col-left" style={{background:"#21262d",padding:"10px",borderRadius:"12px",border:"1px solid #30363d"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <h2 style={{margin:0,color:"#e74c3c",fontSize:"clamp(0.9rem,2vw,1.2rem)"}}>⚔️ Battle</h2>
            <span style={{fontSize:"10px",fontWeight:"bold",background:"#30363d",padding:"3px 7px",borderRadius:"8px",color:"#e67e22"}}>{game.worldSpinCount}/4</span>
          </div>
          {game.villainWaveStage > 0 && <WaveProgressBar villainWaveStage={game.villainWaveStage} />}
          {game.enemySquad[game.currentEnemyIdx] ? (
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {game.enemySquad.length > 1 && (
                <div style={{background:"#111217",borderRadius:"6px",padding:"4px",border:"1px solid #2d3139",display:"flex",gap:"4px",justifyContent:"center"}}>
                  {game.enemySquad.map((enemy,idx) => idx===game.currentEnemyIdx?null:(
                    <div key={idx} style={{width:"32px",height:"32px",background:"#16171d",borderRadius:"4px",border:"1px solid #30363d",padding:"2px",opacity:enemy.hp<=0?0.3:0.85}}>
                      <img src={enemy.image} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} />
                    </div>
                  ))}
                </div>
              )}
              <div style={{background:isBossWave?"#1a0a0a":"#0d1117",padding:"8px",borderRadius:"10px",border:`1px solid ${isBossWave?"#e74c3c":"#30363d"}`,textAlign:"center",boxShadow:isBossWave?"0 0 20px rgba(231,76,60,0.3)":"none"}}>
                {isBossWave && <div style={{fontSize:"10px",fontWeight:"bold",color:"#e74c3c",marginBottom:"4px",letterSpacing:"1px"}}>💀 FINAL BOSS</div>}
                <h3 style={{margin:"2px 0",color:isBossWave?"#ff4444":"#ff7b72",fontSize:"clamp(0.8rem,1.8vw,1rem)"}}>
                  {game.enemySquad[game.currentEnemyIdx].name}
                  <span style={{color:"#e67e22",fontSize:"10px",marginLeft:"4px"}}>Lv.{game.enemySquad[game.currentEnemyIdx].level}</span>
                </h3>
                <div style={{width:"100%",height:"clamp(80px,10vh,120px)",background:"#16171d",borderRadius:"6px",overflow:"hidden",marginBottom:"4px",position:"relative"}}>
                  <div key={`${game.enemySquad[game.currentEnemyIdx].id}-${enemyAnimKey}`} className={enemyAnimClass} style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <img src={game.enemySquad[game.currentEnemyIdx].image} alt="Enemy" style={{maxHeight:"95%",maxWidth:"95%",objectFit:"contain"}} />
                  </div>
                  <span style={{position:"absolute",top:"4px",left:"4px",fontSize:"14px",background:"rgba(0,0,0,0.65)",borderRadius:"5px",padding:"1px 4px",lineHeight:1}} title={game.enemySquad[game.currentEnemyIdx].attribute || "Unknown"}>{getAttributeEmoji(game.enemySquad[game.currentEnemyIdx].attribute)}</span>
                  {enemyFloatEvent && (
                    <div key={enemyFloatEvent.ts} className="float-num" style={{position:"absolute",top:"22%",left:"64%",color:enemyFloatEvent.color,zIndex:20}}>{enemyFloatEvent.text}</div>
                  )}
                </div>
                <p style={{margin:"0 0 3px 0",fontSize:"11px"}}>HP: <b>{game.enemySquad[game.currentEnemyIdx].hp}/{game.enemySquad[game.currentEnemyIdx].maxHp}</b></p>
                <div style={{background:"#331c1c",height:"5px",borderRadius:"3px"}}>
                  <div style={{background:isBossWave?"#e74c3c":"#ff7b72",height:"100%",width:`${(game.enemySquad[game.currentEnemyIdx].hp/game.enemySquad[game.currentEnemyIdx].maxHp)*100}%`,transition:"width 0.3s"}} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{padding:"16px 8px",textAlign:"center",background:"#0d1117",borderRadius:"10px",color:"#8b949e",fontSize:"0.8rem",fontStyle:"italic",border:"1px dashed #30363d"}}>No active threat.<br />Spin the wheel!</div>
          )}
          <div style={{background:"#0d1117",padding:"8px",borderRadius:"8px",flexGrow:1,overflowY:"auto",border:"1px solid #30363d",minHeight:0}}>
            {/* ✅ PERF: log is newest-first; only render the most recent slice — this list re-renders
                on every combat tick, so keeping it short keeps that path cheap. */}
            {game.log.slice(0, 60).map((l,idx) => (
              <p key={idx} style={{margin:"3px 0",fontSize:"13px",fontFamily:"monospace",lineHeight:"1.4",color:l.includes("🎉")||l.includes("👑")||l.includes("💚")?"#56d364":l.includes("🚨")||l.includes("💀")?"#ff7b72":"#c9d1d9"}}>{l}</p>
            ))}
          </div>
        </div>

        {/* ── COL 2: WHEEL ── */}
        <div className="col-center" style={{background:"#1b1c24",padding:"12px",borderRadius:"12px",border:`1px solid ${isBossWave?"#e74c3c":"#2d3139"}`}}>
          <div style={{width:"100%",display:"flex",gap:"6px",alignItems:"stretch"}}>
            <div style={{flex:1,background:isBossWave?"#1a0808":"#21262d",border:`1px solid ${isBossWave?"#e74c3c":"#30363d"}`,borderRadius:"10px",padding:"8px 10px",boxSizing:"border-box"}}>
              <h4 style={{margin:0,color:isBossWave?"#e74c3c":"#58a6ff",fontSize:"10px",letterSpacing:"1px"}}>{isBossWave?"💀 FINAL BOSS ALERT":"📢 SYSTEM STATUS"}</h4>
              <p style={{margin:"3px 0 0 0",fontSize:"clamp(0.75rem,1.8vw,0.95rem)",fontWeight:"bold",color:"#fff",lineHeight:"1.3"}}>{game.announcement}</p>
            </div>
            <AttributeTriangle />
          </div>
          {game.phase === "shop" ? (
            <ShopPanel digiCoin={game.digiCoin} onBuy={game.buyShopItem} onLeave={game.leaveShop} shopItems={shopItems} />
          ) : (
            <>
              <span style={{background:"#16171d",padding:"5px 10px",borderRadius:"10px",fontSize:"10px",fontWeight:"bold",color:"#f0883e",border:"1px solid #333"}}>
                {game.activeWheelType==="WORLD"&&"🌍 CORE EXPLORATION MATRIX"}
                {game.activeWheelType==="EGG_SUB"&&"🥚 INCUBATOR REEL"}
                {game.activeWheelType==="POTION_SUB"&&"🧪 POTION SUPPLY"}
                {game.activeWheelType==="ITEM_DROP"&&"💎 ITEM DROP"}
                {game.activeWheelType==="EVOCHIP_DROP"&&"🧬 EVOLUTION CHIP FOUND"}
                {game.activeWheelType==="COMBAT"&&"⚔️ BATTLE MATRIX"}
                {game.activeWheelType==="POST_BATTLE_CHANCE"&&"🎰 EVOLUTION CHECK"}
                {game.activeWheelType==="POST_BATTLE_TARGET"&&"🧬 CHOOSE EVOLUTION TARGET"}
                {game.activeWheelType==="LEGENDARY_CAPTURE_CHANCE"&&"👑 LEGENDARY CAPTURE"}
                {game.activeWheelType==="WILD_CAPTURE_CHANCE"&&"🕸️ WILD CAPTURE"}
              </span>
              <div style={{width:"100%",background:lastResult?"#0d2137":"#0d1117",border:`2px solid ${lastResult?"#3498db":"#30363d"}`,borderRadius:"10px",padding:"8px 12px",boxSizing:"border-box",textAlign:"center",minHeight:"38px",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s"}}>
                {lastResult
                  ? <p style={{margin:0,fontWeight:"bold",color:"#58a6ff",fontSize:"clamp(0.8rem,1.8vw,1rem)"}}>🎯 Landed: {lastResult}</p>
                  : <p style={{margin:0,color:"#444",fontSize:"0.8rem",fontStyle:"italic"}}>Spin the wheel to see your result</p>
                }
              </div>
              <div style={{display:"flex",flexGrow:1,alignItems:"center",justifyContent:"center",minHeight:0}}>
                <Wheel
                  segments={game.wheelSegments}
                  colors={isBossWave?["#e74c3c","#c0392b","#922b21","#7b241c","#e74c3c","#c0392b","#922b21"]:wheelColors}
                  onSpinComplete={handleSpinComplete}
                  onSpinStart={() => {setIsWheelSpinning(true); setInfoPopup(null); setHighlightedEvoTier(null);}}
                  size={Math.min(280,window.innerWidth*0.28)}
                  buttonContext={game.activeWheelType}
                  buttonClassName="spin-btn"
                  disabled={game.evolvingPartyIdx !== null || game.evolvingReserveIdx !== null}
                />
              </div>
              <div style={{fontSize:"9px",color:"#444",textAlign:"center"}}>Space: Spin &nbsp;|&nbsp; H: Heal</div>
            </>
          )}
        </div>

        {/* ── COL 3: SQUAD + BOX + ITEMS ── */}
        <div className="col-right">
          <div style={{background:"#21262d",padding:"10px",borderRadius:"12px",border:"1px solid #30363d",flexShrink:0}}>
            <h3 style={{margin:"0 0 8px 0",color:"#3498db",fontSize:"clamp(0.8rem,1.8vw,1rem)",fontWeight:"bold"}}>⚔️ Party (Max 3){isWheelSpinning && <span style={{fontSize:"9px",color:"#8b949e",fontWeight:"normal",marginLeft:"6px"}}>🔒 locked while spinning</span>}</h3>
            <div style={{display:"flex",gap:"6px",justifyContent:"space-between",alignItems:"flex-start"}}>
              {[0,1,2].map((idx) => {
                const digi = game.party[idx];
                const isActiveFighter = idx === activePartyIdx;
                const isEvolving = game.evolvingPartyIdx === idx;
                return (
                  <div key={idx} style={{display:"flex",flexDirection:"column",gap:"2px",alignItems:"center",flex:1}}>
                    <PartySlot digimon={digi} onClick={() => handleSlotClick("party",idx)} selected={selectedSlot?.type==="party"&&selectedSlot.index===idx} animClass={isActiveFighter?playerAnimClass:""} animKey={isActiveFighter?playerAnimKey:0} hitFlash={isActiveFighter&&partyHpFlash[idx]} isEvolving={isEvolving} floatEvent={partyFloatEvents[idx]} reducedMotion={reducedMotion} showInfo={infoPopup?.type==="party"&&infoPopup.idx===idx} onToggleInfo={() => setInfoPopup((prev) => (prev&&prev.type==="party"&&prev.idx===idx) ? null : {type:"party", idx})} evoChipCount={digi ? (game.inventory[evoChipForLevel[digi.level]] || 0) : 0} evoChipForLevel={evoChipForLevel} onEvolveWithChip={() => {game.evolveWithChip(idx, false); setHighlightedEvoTier(null);}} isHighlightedForEvo={digi ? highlightedEvoTier === digi.level : false} onRelease={() => setReleaseConfirm({index:idx,isReserve:false})} onSell={mode==="shop"&&game.sellDigimon ? () => setSellConfirm({index:idx,isReserve:false}) : undefined} sellValue={mode==="shop"&&digi ? getSellValue(digi.level, digi.hp, digi.maxHp) : null} />
                    {digi && (
                      <div style={{display:"flex",flexDirection:"column",gap:"2px",width:"100%"}}>
                        {/* ✅ FIX 2: onMouseUp blur prevents Space from re-firing these buttons */}
                        <button onClick={() => game.usePotionOnDigimon(idx,false)} onMouseUp={(e) => e.currentTarget.blur()} disabled={game.inventory.potion<=0||digi.hp>=digi.maxHp||digi.hp<=0} style={{width:"100%",fontSize:"9px",fontWeight:"bold",background:"#238636",color:"#fff",border:"none",borderRadius:"4px",padding:"2px 0",cursor:"pointer"}}>Heal [H]</button>
                        {digi.hp<=0 && <button onClick={() => game.useRevivePotionOnDigimon(idx,false)} onMouseUp={(e) => e.currentTarget.blur()} disabled={game.inventory.revivePotion<=0} style={{width:"100%",fontSize:"9px",fontWeight:"bold",background:"#9b59b6",color:"#fff",border:"none",borderRadius:"4px",padding:"2px 0",cursor:"pointer"}}>Revive</button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{background:"#21262d",padding:"10px",borderRadius:"12px",border:"1px solid #30363d",flexGrow:1,minHeight:0,display:"flex",flexDirection:"column"}}>
            <h3 style={{margin:"0 0 8px 0",color:"#8b949e",fontSize:"clamp(0.8rem,1.8vw,1rem)",fontWeight:"bold"}}>📦 Reserve Box</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"6px",overflowY:"auto",alignItems:"flex-start"}}>
              {[0,1,2,3,4,5].map((idx) => {
                const resDigi = game.reserve[idx];
                return (
                  <div key={idx} style={{display:"flex",flexDirection:"column",gap:"2px",alignItems:"center"}}>
                    <PartySlot digimon={resDigi} onClick={() => handleSlotClick("reserve",idx)} selected={selectedSlot?.type==="reserve"&&selectedSlot.index===idx} animClass="" animKey={0} hitFlash={false} isEvolving={game.evolvingReserveIdx===idx} reducedMotion={reducedMotion} showInfo={infoPopup?.type==="reserve"&&infoPopup.idx===idx} onToggleInfo={() => setInfoPopup((prev) => (prev&&prev.type==="reserve"&&prev.idx===idx) ? null : {type:"reserve", idx})} evoChipCount={resDigi ? (game.inventory[evoChipForLevel[resDigi.level]] || 0) : 0} evoChipForLevel={evoChipForLevel} onEvolveWithChip={() => {game.evolveWithChip(idx, true); setHighlightedEvoTier(null);}} isHighlightedForEvo={resDigi ? highlightedEvoTier === resDigi.level : false} onRelease={() => setReleaseConfirm({index:idx,isReserve:true})} onSell={mode==="shop"&&game.sellDigimon ? () => setSellConfirm({index:idx,isReserve:true}) : undefined} sellValue={mode==="shop"&&resDigi ? getSellValue(resDigi.level, resDigi.hp, resDigi.maxHp) : null} />
                    {resDigi && (
                      <div style={{display:"flex",flexDirection:"column",gap:"2px",width:"100%"}}>
                        <button onClick={() => game.usePotionOnDigimon(idx,true)} onMouseUp={(e) => e.currentTarget.blur()} disabled={game.inventory.potion<=0||resDigi.hp<=0||resDigi.hp>=resDigi.maxHp} style={{fontSize:"9px",fontWeight:"bold",background:"#238636",color:"#fff",border:"none",borderRadius:"4px",padding:"2px 0",cursor:"pointer",width:"100%"}}>Heal</button>
                        {resDigi.hp<=0 && <button onClick={() => game.useRevivePotionOnDigimon(idx,true)} onMouseUp={(e) => e.currentTarget.blur()} disabled={game.inventory.revivePotion<=0} style={{fontSize:"9px",fontWeight:"bold",background:"#9b59b6",color:"#fff",border:"none",borderRadius:"4px",padding:"2px 0",cursor:"pointer",width:"100%"}}>Revive</button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <InventoryPanel
            inventory={game.inventory}
            digiCoin={game.digiCoin}
            phase={game.phase}
            isVillainBattle={game.isVillainBattle}
            isWildBattle={game.isWildBattle}
            isLegendaryBattle={game.isLegendaryBattle}
            onUseStrength={game.consumeStrengthChip}
            onUseEndurance={game.consumeEnduranceChip}
            onUseEscape={game.useEscapePortal}
            highlightedEvoTier={highlightedEvoTier}
            onToggleEvoHighlight={(tier) => setHighlightedEvoTier((prev) => prev === tier ? null : tier)}
            evoChipKeys={evoChipKeys}
            evoChipTargetTier={evoChipTargetTier}
            evoChipLabel={evoChipLabel}
          />
        </div>
      </div>
    </>
  );
}

// ============================================================
// MAIN MENU — per-mode Continue / New Run / Dex / Board
// ============================================================
const timeAgoLabel = (ts) => {
  if (!ts) return "";
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
};

const getSaveSummary = (saveKey) => {
  try {
    const save = JSON.parse(localStorage.getItem(saveKey) || "null");
    if (!save || !save.phase || save.phase === "start") return null;
    return save;
  } catch {return null;}
};

const MenuModeCard = ({icon, label, accent, accentBg, highscoreKey, saveKey, onContinue, onNewRun, onBestiary, onLeaderboard}) => {
  const bestScore = parseInt(localStorage.getItem(highscoreKey) || "0");
  const save = getSaveSummary(saveKey);
  return (
    <div style={{width:"100%",background:"#1b1c24",border:`2px solid ${accent}`,borderRadius:"16px",padding:"22px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:"10px",boxSizing:"border-box"}}>
      <span style={{fontSize:"44px"}}>{icon}</span>
      <span style={{fontSize:"17px",fontWeight:"bold",color:accent}}>{label}</span>
      <span style={{fontSize:"12px",color:accent,background:accentBg,borderRadius:"20px",padding:"3px 12px"}}>Best {bestScore.toLocaleString()}</span>

      {save ? (
        <>
          <button onClick={onContinue} style={{width:"100%",marginTop:"8px",background:accentBg,border:`1px solid ${accent}`,borderRadius:"10px",padding:"12px 0",cursor:"pointer",color:accent,fontSize:"14px",fontWeight:"bold"}}>▶️ Continue</button>
          <span style={{fontSize:"11px",color:"#8b949e"}}>wave {save.villainWaveStage || 0} &middot; saved {timeAgoLabel(save.savedAt)}</span>
          <button onClick={onNewRun} style={{width:"100%",marginTop:"4px",background:"transparent",border:"1px solid #30363d",borderRadius:"10px",padding:"10px 0",cursor:"pointer",color:"#c9d1d9",fontSize:"12px",fontWeight:"bold"}}>New run</button>
        </>
      ) : (
        <>
          <button onClick={onNewRun} style={{width:"100%",marginTop:"8px",background:"transparent",border:"1px solid #30363d",borderRadius:"10px",padding:"12px 0",cursor:"pointer",color:"#c9d1d9",fontSize:"14px",fontWeight:"bold"}}>New run</button>
          <span style={{fontSize:"11px",color:"#444"}}>no saved run</span>
        </>
      )}

      <div style={{display:"flex",gap:"8px",width:"100%",marginTop:"8px"}}>
        <button onClick={onBestiary} style={{flex:1,background:"#21262d",border:"1px solid #30363d",borderRadius:"8px",padding:"9px 0",cursor:"pointer",color:"#e67e22",fontSize:"11px",fontWeight:"bold"}}>📖 Dex</button>
        <button onClick={onLeaderboard} style={{flex:1,background:"#21262d",border:"1px solid #30363d",borderRadius:"8px",padding:"9px 0",cursor:"pointer",color:"#f1c40f",fontSize:"11px",fontWeight:"bold"}}>🏆 Board</button>
      </div>
    </div>
  );
};

const OverwriteConfirmModal = ({modeLabel, onCancel, onConfirm}) => (
  <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:"#1b1c24",border:"2px solid #e74c3c",borderRadius:"12px",padding:"24px",maxWidth:"320px",width:"90%",textAlign:"center",display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{fontSize:"2rem"}}>⚠️</div>
      <h3 style={{margin:0,color:"#ff7b72"}}>Overwrite saved run?</h3>
      <p style={{margin:0,color:"#c9d1d9",fontSize:"0.9rem"}}>Starting a new {modeLabel} run will erase your current saved progress. This cannot be undone.</p>
      <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
        <button onClick={onCancel} style={{padding:"10px 20px",background:"#21262d",color:"#fff",border:"1px solid #30363d",borderRadius:"8px",cursor:"pointer",fontWeight:"bold"}}>Cancel</button>
        <button onClick={onConfirm} style={{padding:"10px 20px",background:"#e74c3c",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:"bold"}}>Overwrite</button>
      </div>
    </div>
  </div>
);

// ✅ Tiny loading veil shown while the main menu fetches the shared species roster for its
// standalone Bestiary view (only needed the first time Dex is opened from the menu; cached after).
const MenuLoadingOverlay = () => (
  <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"14px",color:"#fff"}}>
    <div style={{fontSize:"2rem"}}>⚡</div>
    <p style={{color:"#58a6ff",fontWeight:"bold"}}>Loading species data...</p>
  </div>
);

const MainMenuScreen = ({onContinue, onNewRun, onBestiary, onLeaderboard, onTutorial, onSettings, difficulty, onDifficultyChange}) => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#16171d",padding:"16px",boxSizing:"border-box"}}>
    <div style={{width:"100%",maxWidth:"760px",background:"#16171d",borderRadius:"20px",border:"2px solid #2d3139",padding:"40px 32px",boxSizing:"border-box",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <div style={{textAlign:"center",marginBottom:"32px"}}>
        <img src={digiRouletteLogo} alt="DigiRoulette" style={{maxWidth:"380px",width:"90%",height:"auto",display:"block",margin:"0 auto"}} />
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",marginTop:"12px"}}>
          <span style={{fontSize:"11px",color:"#8b949e",fontWeight:"bold"}}>🎚️ Difficulty</span>
          <div style={{display:"flex",gap:"5px"}}>
            {[{key:"easy",label:"Easy",color:"#2ecc71"},{key:"normal",label:"Normal",color:"#3498db"},{key:"hard",label:"Hard",color:"#e74c3c"}].map((d) => (
              <button
                key={d.key}
                onClick={() => onDifficultyChange(d.key)}
                style={{padding:"5px 14px",borderRadius:"20px",border:`1px solid ${difficulty===d.key?d.color:"#30363d"}`,background:difficulty===d.key?`${d.color}22`:"#21262d",color:difficulty===d.key?d.color:"#8b949e",fontWeight:"bold",fontSize:"11px",cursor:"pointer"}}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:"18px",flexWrap:"wrap",justifyContent:"center",width:"100%"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"12px",flex:"1 1 280px",maxWidth:"340px"}}>
          <MenuModeCard
            icon="🛒" label="Shop mode" accent="#f1c40f" accentBg="#2d2410"
            highscoreKey={SHOP_HIGHSCORE_KEY} saveKey={SHOP_SAVE_KEY}
            onContinue={() => onContinue("shop")}
            onNewRun={() => onNewRun("shop")}
            onBestiary={() => onBestiary("shop")}
            onLeaderboard={() => onLeaderboard("shop")}
          />
          <button onClick={onTutorial} style={{width:"100%",background:"#21262d",border:"1px solid #3498db",borderRadius:"10px",padding:"12px 0",cursor:"pointer",color:"#58a6ff",fontSize:"13px",fontWeight:"bold",boxSizing:"border-box"}}>📖 How to play</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"12px",flex:"1 1 280px",maxWidth:"340px"}}>
          <MenuModeCard
            icon="🎲" label="Full RNG mode" accent="#c792ea" accentBg="#221a2e"
            highscoreKey={RNG_HIGHSCORE_KEY} saveKey={RNG_SAVE_KEY}
            onContinue={() => onContinue("rng")}
            onNewRun={() => onNewRun("rng")}
            onBestiary={() => onBestiary("rng")}
            onLeaderboard={() => onLeaderboard("rng")}
          />
          <button onClick={onSettings} style={{width:"100%",background:"#21262d",border:"1px solid #30363d",borderRadius:"10px",padding:"12px 0",cursor:"pointer",color:"#c9d1d9",fontSize:"13px",fontWeight:"bold",boxSizing:"border-box"}}>⚙️ Settings</button>
        </div>
      </div>
    </div>
  </div>
);

// ============================================================
// PER-MODE WRAPPERS — each calls exactly one game-logic hook,
// keeping the two gameplay files fully independent of each other
// ============================================================
const ShopModeApp = ({onExitMode, onSwitchMode, autoResume}) => {
  const game = useDigimonGame(autoResume);
  return (
    <GameCore
      game={game}
      mode="shop"
      wheelColors={WHEEL_COLORS}
      evoChipForLevel={EVO_CHIP_FOR_LEVEL}
      evoChipLabel={EVO_CHIP_LABEL}
      evoChipTargetTier={EVO_CHIP_TARGET_TIER}
      evoChipKeys={EVO_CHIP_KEYS}
      shopItems={SHOP_ITEMS}
      saveKey={SHOP_SAVE_KEY}
      highscoreKey={SHOP_HIGHSCORE_KEY}
      bestiaryKey={SHOP_BESTIARY_KEY}
      getLeaderboard={getShopLeaderboard}
      onExitMode={onExitMode}
      onSwitchMode={onSwitchMode}
    />
  );
};

const RngModeApp = ({onExitMode, onSwitchMode, autoResume}) => {
  const game = useDigimonGameRNG(autoResume);
  return (
    <GameCore
      game={game}
      mode="rng"
      wheelColors={RNG_WHEEL_COLORS}
      evoChipForLevel={RNG_EVO_CHIP_FOR_LEVEL}
      evoChipLabel={RNG_EVO_CHIP_LABEL}
      evoChipTargetTier={RNG_EVO_CHIP_TARGET_TIER}
      evoChipKeys={RNG_EVO_CHIP_KEYS}
      shopItems={null}
      saveKey={RNG_SAVE_KEY}
      highscoreKey={RNG_HIGHSCORE_KEY}
      bestiaryKey={RNG_BESTIARY_KEY}
      getLeaderboard={getRngLeaderboard}
      onExitMode={onExitMode}
      onSwitchMode={onSwitchMode}
    />
  );
};

// ============================================================
// TOP-LEVEL EXPORT — main menu is always the entry point
// ============================================================
export default function GameScreen() {
  const [mode, setMode] = useState(null);
  const [autoResume, setAutoResume] = useState(false);
  const [overwriteConfirm, setOverwriteConfirm] = useState(null); // "shop" | "rng" | null
  const [showMenuTutorial, setShowMenuTutorial] = useState(false);
  const [showMenuSettings, setShowMenuSettings] = useState(false);
  const [menuBestiaryMode, setMenuBestiaryMode] = useState(null); // "shop" | "rng" | null
  const [menuLeaderboardMode, setMenuLeaderboardMode] = useState(null); // "shop" | "rng" | null
  const [menuFullRoster, setMenuFullRoster] = useState([]);
  const [menuRosterLoading, setMenuRosterLoading] = useState(false);

  // ✅ Menu theme plays on the main menu, and keeps playing straight through the mode's
  // starter-picker screen too (that mode doesn't call startBGM again until a starter is
  // chosen or a save is resumed, so the same track just carries over — no extra wiring needed).
  useEffect(() => {
    if (!mode && sfx.startBGM) sfx.startBGM("MENU");
  }, [mode]);

  const [menuMusicVolume, setMenuMusicVolume] = useState(() => {
    try {const v = localStorage.getItem("digiroulette_music_volume"); return v === null ? 1.0 : parseFloat(v);} catch {return 1.0;}
  });
  const [menuSfxVolume, setMenuSfxVolume] = useState(() => {
    try {const v = localStorage.getItem("digiroulette_sfx_volume"); return v === null ? 1.0 : parseFloat(v);} catch {return 1.0;}
  });
  const [menuIsMuted, setMenuIsMuted] = useState(() => {
    try {return localStorage.getItem("digiroulette_muted") === "true";} catch {return false;}
  });
  const [menuReducedMotion, setMenuReducedMotion] = useState(() => {
    try {return localStorage.getItem("digiroulette_reduced_motion") === "true";} catch {return false;}
  });
  const [menuEvoAnimEnabled, setMenuEvoAnimEnabled] = useState(() => {
    try {const v = localStorage.getItem("digiroulette_evo_anim"); return v === null ? true : v === "true";} catch {return true;}
  });
  const [menuDifficulty, setMenuDifficulty] = useState(() => {
    try {return localStorage.getItem("digiroulette_difficulty") || "normal";} catch {return "normal";}
  });

  const handleMenuMusicVolumeChange = (v) => {
    setMenuMusicVolume(v);
    sfx.setMusicVolume(v);
    try {localStorage.setItem("digiroulette_music_volume", String(v));} catch {}
  };
  const handleMenuSfxVolumeChange = (v) => {
    setMenuSfxVolume(v);
    sfx.setSfxVolume(v);
    try {localStorage.setItem("digiroulette_sfx_volume", String(v));} catch {}
  };
  const handleMenuToggleMute = () => {
    const nowMuted = sfx.toggleMute();
    setMenuIsMuted(nowMuted);
    try {localStorage.setItem("digiroulette_muted", String(nowMuted));} catch {}
  };
  const handleMenuToggleReducedMotion = (e) => {
    const next = e.target.checked;
    setMenuReducedMotion(next);
    try {localStorage.setItem("digiroulette_reduced_motion", String(next));} catch {}
  };
  const handleMenuDifficultyChange = (next) => {
    setMenuDifficulty(next);
    try {localStorage.setItem("digiroulette_difficulty", next);} catch {}
  };
  const handleMenuToggleEvoAnimation = () => {
    setMenuEvoAnimEnabled((prev) => {
      const next = !prev;
      try {localStorage.setItem("digiroulette_evo_anim", String(next));} catch {}
      return next;
    });
  };

  const enterMode = (m, resume = false) => {
    setAutoResume(resume);
    setMode(m);
  };

  // ✅ Instant Switch Mode: jumps straight into the other mode. If it has a save, resume it
  // immediately (same instant-resume path as Continue); otherwise land on its starter picker.
  const switchMode = (target) => {
    const saveKey = target === "shop" ? SHOP_SAVE_KEY : RNG_SAVE_KEY;
    const hasSave = getSaveSummary(saveKey) !== null;
    enterMode(target, hasSave);
  };

  const handleNewRun = (m) => {
    const saveKey = m === "shop" ? SHOP_SAVE_KEY : RNG_SAVE_KEY;
    const hasSave = (() => {try {return localStorage.getItem(saveKey) !== null;} catch {return false;}})();
    if (hasSave) setOverwriteConfirm(m);
    else enterMode(m);
  };

  const confirmOverwrite = () => {
    const m = overwriteConfirm;
    const saveKey = m === "shop" ? SHOP_SAVE_KEY : RNG_SAVE_KEY;
    try {localStorage.removeItem(saveKey);} catch {}
    setOverwriteConfirm(null);
    enterMode(m);
  };

  const handleExitMode = () => {
    setMode(null);
    setInitialModal(null);
  };

  // ✅ Fetches the shared species roster once (cached in state) so the main menu's Bestiary
  // can open instantly without entering a mode. Both modes draw from the same Google Sheets,
  // so this reuses Shop mode's URLs as a read-only data source — it doesn't touch either
  // mode's own logic or its save/progress data.
  const fetchMenuRosterOnce = () => {
    if (menuFullRoster.length > 0 || menuRosterLoading) return;
    setMenuRosterLoading(true);
    const fetchAndParse = (url) => new Promise((resolve, reject) => {
      Papa.parse(url, {download: true, header: true, skipEmptyLines: true, complete: (res) => resolve(res.data), error: (err) => reject(err)});
    });
    Promise.all(Object.values(SHOP_URLS).map(fetchAndParse))
      .then((results) => {
        const master = results.flat();
        setMenuFullRoster(master.map((d) => ({name: d.name, imageUrl: d.imageUrl || "", level: d.level || "Child"})));
      })
      .catch((err) => console.error("Menu roster fetch failed:", err))
      .finally(() => setMenuRosterLoading(false));
  };

  const openMenuBestiary = (m) => {
    fetchMenuRosterOnce();
    setMenuBestiaryMode(m);
  };

  if (!mode) {
    return (
      <>
        <MainMenuScreen
          onContinue={(m) => enterMode(m, true)}
          onNewRun={handleNewRun}
          onBestiary={openMenuBestiary}
          onLeaderboard={(m) => setMenuLeaderboardMode(m)}
          onTutorial={() => setShowMenuTutorial(true)}
          onSettings={() => setShowMenuSettings(true)}
          difficulty={menuDifficulty}
          onDifficultyChange={handleMenuDifficultyChange}
        />
        {showMenuTutorial && <TutorialPopup onClose={() => setShowMenuTutorial(false)} />}
        {showMenuSettings && <SettingsModal
          onClose={() => setShowMenuSettings(false)}
          musicVolume={menuMusicVolume} onMusicVolumeChange={handleMenuMusicVolumeChange}
          sfxVolume={menuSfxVolume} onSfxVolumeChange={handleMenuSfxVolumeChange}
          isMuted={menuIsMuted} onToggleMute={handleMenuToggleMute}
          reducedMotion={menuReducedMotion} onToggleReducedMotion={handleMenuToggleReducedMotion}
          evoAnimEnabled={menuEvoAnimEnabled} onToggleEvoAnimation={handleMenuToggleEvoAnimation}
        />}
        {menuLeaderboardMode && (
          <LeaderboardModal
            onClose={() => setMenuLeaderboardMode(null)}
            getLeaderboard={menuLeaderboardMode === "shop" ? getShopLeaderboard : getRngLeaderboard}
          />
        )}
        {menuBestiaryMode && (menuRosterLoading
          ? <MenuLoadingOverlay />
          : <BestiaryModal
              fullRoster={menuFullRoster}
              bestiaryKey={menuBestiaryMode === "shop" ? SHOP_BESTIARY_KEY : RNG_BESTIARY_KEY}
              onClose={() => setMenuBestiaryMode(null)}
            />
        )}
        {overwriteConfirm && (
          <OverwriteConfirmModal
            modeLabel={overwriteConfirm === "shop" ? "Shop mode" : "Full RNG mode"}
            onCancel={() => setOverwriteConfirm(null)}
            onConfirm={confirmOverwrite}
          />
        )}
      </>
    );
  }
  if (mode === "shop") return <ShopModeApp onExitMode={handleExitMode} onSwitchMode={() => switchMode("rng")} autoResume={autoResume} />;
  return <RngModeApp onExitMode={handleExitMode} onSwitchMode={() => switchMode("shop")} autoResume={autoResume} />;
}
