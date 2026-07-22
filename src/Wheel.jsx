import React, {useEffect, useMemo, useRef, useState} from "react";
import {sfx} from "./utils/audio";

// ✅ Pure helper — hoisted out of the component so it isn't redefined on every render.
function getLabelLines(label) {
  if (label.length <= 12) return [label, ""];
  const midIdx = Math.floor(label.length / 2);
  const spaceBefore = label.lastIndexOf(" ", midIdx);
  const spaceAfter = label.indexOf(" ", midIdx);
  let splitPoint = spaceBefore;
  if (spaceBefore === -1 || (spaceAfter !== -1 && (midIdx - spaceBefore > spaceAfter - midIdx))) {
    splitPoint = spaceAfter;
  }
  if (splitPoint === -1) return [label.slice(0, 11), label.slice(11)];
  return [label.slice(0, splitPoint).trim(), label.slice(splitPoint).trim()];
}

// ✅ PERF: the wheel face (segment wedges + labels) only ever changes when `configuredSegments`
// or `colors` change — never on a rotation-only re-render (which happens ~60x/sec while
// spinning, driven by `currentRotation`). Splitting it into its own React.memo'd component
// means those frequent parent re-renders skip reconciling this subtree entirely; only the
// wrapping <svg>'s rotate() transform actually updates each frame.
const WheelSegments = React.memo(({configuredSegments, colors}) => (
  <>
    {configuredSegments.map((seg, i) => {
      const rad1 = ((seg.startAngle - 90) * Math.PI) / 180;
      const rad2 = ((seg.endAngle - 90) * Math.PI) / 180;
      const x1 = 100 + 96 * Math.cos(rad1);
      const y1 = 100 + 96 * Math.sin(rad1);
      const x2 = 100 + 96 * Math.cos(rad2);
      const y2 = 100 + 96 * Math.sin(rad2);
      const sliceSize = seg.endAngle - seg.startAngle;
      const largeArcFlag = sliceSize > 180 ? 1 : 0;
      const textRad = ((seg.midAngle - 90) * Math.PI) / 180;
      const labelX = 100 + 56 * Math.cos(textRad);
      const labelY = 100 + 56 * Math.sin(textRad);
      const labelRotation = seg.midAngle + 90;
      const [line1, line2] = getLabelLines(seg.label);

      return (
        <g key={i}>
          <path
            d={`M100,100 L${x1},${y1} A96,96 0 ${largeArcFlag} 1 ${x2},${y2} Z`}
            fill={colors[i % colors.length] || "#444"}
            stroke="#16171d" strokeWidth="1.5"
          />
          {line2 ? (
            <text
              x={labelX} y={labelY} fill="#fff" fontSize="7.2" fontWeight="900" textAnchor="middle"
              transform={`rotate(${labelRotation}, ${labelX}, ${labelY})`}
            >
              <tspan x={labelX} dy="-3.5">{line1}</tspan>
              <tspan x={labelX} dy="7.5">{line2}</tspan>
            </text>
          ) : (
            <text
              x={labelX} y={labelY} fill="#fff" fontSize="8.5" fontWeight="900" textAnchor="middle"
              transform={`rotate(${labelRotation}, ${labelX}, ${labelY})`}
              dy="2"
            >
              {line1}
            </text>
          )}
        </g>
      );
    })}
    <circle cx="100" cy="100" r="14" fill="#16171d" stroke="#333" strokeWidth="2" />
  </>
));

const Wheel = ({segments = [], colors = [], onSpinComplete, onSpinStart, size = 460, buttonContext = "", buttonClassName = "", disabled = false}) => {
  const [currentRotation, setCurrentRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  const rotationRef = useRef(0);
  const animFrameId = useRef(null);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const startAngleRef = useRef(0);
  const totalRotationRef = useRef(0);
  const lastTickSegmentRef = useRef(-1);
  const spinSeedRef = useRef(0);
  const isSpinningRef = useRef(false); // 🔒 synchronous lock — React state alone isn't fast enough to block a rapid double-click

  const totalWeight = segments.reduce((sum, s) => sum + (s.weight || 1), 0);

  // ✅ PERF: this used to run fresh on every render — including every requestAnimationFrame
  // tick while spinning (~60x/sec), redoing all the per-segment trig for no reason since only
  // `currentRotation` changes frame-to-frame, not the segment layout itself. Memoizing on
  // `segments`/`totalWeight` means it's only recomputed when the wheel's actual contents change.
  const configuredSegments = useMemo(() => {
    let accumulatedAngle = 0;
    return segments.map((seg) => {
      const sliceAngle = ((seg.weight || 1) / totalWeight) * 360;
      const start = accumulatedAngle;
      const end = accumulatedAngle + sliceAngle;
      accumulatedAngle += sliceAngle;
      return {...seg, startAngle: start, endAngle: end, midAngle: start + (sliceAngle / 2)};
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, totalWeight]);

  const startPhysicsSpin = () => {
    // ✅ BUGFIX: isSpinningRef is set synchronously below, so even two click events fired back-to-back
    // (before React re-renders with isSpinning:true) can't both pass this guard and start two
    // overlapping spins — which was the root cause of duplicate floating damage numbers.
    if (isSpinningRef.current || disabled || segments.length === 0) return;
    isSpinningRef.current = true;
    setIsSpinning(true);
    if (onSpinStart) onSpinStart();

    const chosenDuration = 2500 + Math.random() * 3500;
    const minRevolutions = 4;
    const maxRevolutions = 12;
    const totalRevolutions = minRevolutions + Math.random() * (maxRevolutions - minRevolutions);
    const totalDegrees = totalRevolutions * 360;

    spinSeedRef.current = Math.random() * 360;

    startTimeRef.current = performance.now();
    durationRef.current = chosenDuration;
    startAngleRef.current = rotationRef.current % 360;
    totalRotationRef.current = totalDegrees + spinSeedRef.current;

    lastTickSegmentRef.current = -1;

    const updatePhysicsFrame = (now) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / durationRef.current, 1);
      const easeOutQuintic = 1 - Math.pow(1 - progress, 5);

      const nextRotation = (startAngleRef.current + (totalRotationRef.current * easeOutQuintic)) % 360;
      rotationRef.current = nextRotation;
      setCurrentRotation(nextRotation);

      const pointerAngle = (360 - (nextRotation % 360)) % 360;
      const currentSegmentIdx = configuredSegments.findIndex(
        (seg) => pointerAngle >= seg.startAngle && pointerAngle < seg.endAngle
      );

      if (currentSegmentIdx !== lastTickSegmentRef.current && currentSegmentIdx !== -1) {
        const remainingProgress = 1 - progress;
        const currentSpeedEst = (totalRotationRef.current / durationRef.current) * remainingProgress * 15;
        const pitchModifier = Math.min(1200, 600 + (currentSpeedEst * 10));
        if (remainingProgress > 0.05) sfx.playTick(pitchModifier);
        lastTickSegmentRef.current = currentSegmentIdx;
      }

      if (progress < 1) {
        animFrameId.current = requestAnimationFrame(updatePhysicsFrame);
      } else {
        setIsSpinning(false);
        isSpinningRef.current = false;
        cancelAnimationFrame(animFrameId.current);

        const finalPointerAngle = (360 - (rotationRef.current % 360)) % 360;
        const finalSelectedIdx = configuredSegments.findIndex(
          (seg) => finalPointerAngle >= seg.startAngle && finalPointerAngle < seg.endAngle
        );

        if (onSpinComplete && finalSelectedIdx !== -1) onSpinComplete(finalSelectedIdx);
      }
    };

    animFrameId.current = requestAnimationFrame(updatePhysicsFrame);
  };

  useEffect(() => {
    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  const getButtonLabel = () => {
    if (isSpinning) return "COMPUTING MOMENTUM...";
    if (disabled) return "🧬 EVOLUTION IN PROGRESS...";
    if (buttonContext === "COMBAT") return "⚔️ ROLL COMBAT WHEEL";
    if (buttonContext === "PLAYER") return "⚔️ ROLL PLAYER ATTACK";
    if (buttonContext === "ENEMY") return "🎯 ROLL ENEMY MOVE";
    return "🎲 ACTIVATE CHANCE WHEEL";
  };

  return (
    <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "28px"}}>
      <div
        onClick={startPhysicsSpin}
        style={{
          position: "relative",
          width: size, height: size,
          cursor: (isSpinning || disabled) ? "not-allowed" : "pointer"
        }}
      >
        {/* Pointer arrow */}
        <svg
          width="46" height="40" viewBox="0 0 28 24"
          style={{position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none"}}
        >
          <polygon points="14,22 2,2 26,2" fill="#e74c3c" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>

        <svg
          viewBox="0 0 200 200" width={size} height={size}
          style={{transform: `rotate(${currentRotation}deg)`, width: "100%", height: "100%", willChange: "transform"}}
        >
          <WheelSegments configuredSegments={configuredSegments} colors={colors} />
        </svg>
      </div>

      {/* ✅ buttonClassName added for Space key shortcut targeting */}
      <button
        onClick={startPhysicsSpin}
        disabled={isSpinning || disabled}
        className={`spin-btn ${buttonClassName}`}
        style={{
          fontWeight: "bold",
          padding: "16px 48px",
          background: (isSpinning || disabled) ? "#444" : buttonContext === "ENEMY" ? "#e74c3c" : "#f0883e",
          color: "#fff",
          border: "none",
          borderRadius: "30px",
          cursor: (isSpinning || disabled) ? "not-allowed" : "pointer",
          fontSize: "1.1rem",
          letterSpacing: "1px",
          boxShadow: (isSpinning || disabled) ? "none" : buttonContext === "ENEMY" ? "0 0 15px rgba(231,76,60,0.4)" : "0 0 15px rgba(240,136,62,0.4)",
          transition: "all 0.2s"
        }}
      >
        {getButtonLabel()}
      </button>
    </div>
  );
};

export default Wheel;
