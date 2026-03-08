import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ArcRow {
  season: string;
  date: string;
  game_id: string;
  team: string;           // e.g. "LAL"
  team_name: string;      // e.g. "Los Angeles Lakers"
  opponent: string;
  home_away: string;
  rest_days?: number;
  isWin?: boolean;
  pts?: number;
  oppPts?: number;
  ortg?: number;
  drtg?: number;
  netrtg?: number;
  travel_miles?: number;
  tz_crossed?: number;
  fatigue_index?: number; // 0–100
  city?: string;

  from_lat: number;
  from_lon: number;
  to_lat: number;
  to_lon: number;
  dateObj?: Date;
}

interface TooltipData {
  x: number;
  y: number;
  arc: ArcRow;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WIDTH = 960;
const HEIGHT = 580;

// Fatigue color scale: blue (rested) → amber → red (exhausted)
const FATIGUE_SCALE = d3
  .scaleSequential(d3.interpolateRgbBasis(["#38bdf8", "#facc15", "#ef4444"]))
  .domain([0, 100]);

const DEFAULT_FATIGUE_COLOR = "#64748b";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function arcLineString(d: ArcRow, n = 80): GeoJSON.LineString {
  const a: [number, number] = [d.from_lon, d.from_lat];
  const b: [number, number] = [d.to_lon, d.to_lat];
  const interp = d3.geoInterpolate(a, b);
  const coords = d3.range(n).map((i) => interp(i / (n - 1)));
  return { type: "LineString", coordinates: coords };
}

function strokeWidth(miles?: number): number {
  if (!miles) return 1.5;
  // thin (1) for short hops, thick (5) for coast-to-coast
  return d3.scaleLinear().domain([0, 3000]).range([1, 5]).clamp(true)(miles);
}

function fatigueColor(fi?: number): string {
  if (fi == null) return DEFAULT_FATIGUE_COLOR;
  return FATIGUE_SCALE(fi);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NBATravelMap() {
  const [allArcs, setAllArcs] = useState<ArcRow[]>([]);
  const [usTopo, setUsTopo] = useState<any>(null);

  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [dateIndex, setDateIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [mapData, arcData] = await Promise.all([
        d3.json("/data/states-10m.json"),
        d3.json("/data/travel_arcs.json"),
      ]);

      const cleaned = (arcData as any[]).map((d) => ({
        ...d,
        from_lat: +d.from_lat,
        from_lon: +d.from_lon,
        to_lat: +d.to_lat,
        to_lon: +d.to_lon,
        pts: d.pts == null ? undefined : +d.pts,
        oppPts: d.oppPts == null ? undefined : +d.oppPts,
        ortg: d.ortg == null ? undefined : +d.ortg,
        drtg: d.drtg == null ? undefined : +d.drtg,
        netrtg: d.netrtg == null ? undefined : +d.netrtg,
        travel_miles: d.travel_miles == null ? undefined : +d.travel_miles,
        tz_crossed: d.tz_crossed == null ? undefined : +d.tz_crossed,
        fatigue_index: d.fatigue_index == null ? undefined : +d.fatigue_index,
        rest_days: d.rest_days == null ? undefined : +d.rest_days,
        dateObj: new Date(d.date),
      })) as ArcRow[];

      const valid = cleaned
        .filter(
          (d) =>
            Number.isFinite(d.from_lat) &&
            Number.isFinite(d.from_lon) &&
            Number.isFinite(d.to_lat) &&
            Number.isFinite(d.to_lon) &&
            !(d.from_lat === d.to_lat && d.from_lon === d.to_lon)
        )
        .sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());

      setUsTopo(mapData);
      setAllArcs(valid);

      // Default to first team + season
      const firstTeam = valid[0]?.team ?? "";
      const firstSeason = valid[0]?.season ?? "";
      setSelectedTeam(firstTeam);
      setSelectedSeason(firstSeason);
    }
    load().catch(console.error);
  }, []);

  // ── Derived team / season lists ────────────────────────────────────────────
  const teams = useMemo(() => {
    const map = new Map<string, string>();
    allArcs.forEach((d) => {
      if (!map.has(d.team)) map.set(d.team, d.team_name || d.team);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allArcs]);

  const seasons = useMemo(() => {
    const set = new Set(allArcs.filter((d) => d.team === selectedTeam).map((d) => d.season));
    return Array.from(set).sort();
  }, [allArcs, selectedTeam]);

  // Reset season when team changes
  useEffect(() => {
    if (seasons.length) setSelectedSeason(seasons[seasons.length - 1]);
    setDateIndex(0);
    setIsPlaying(false);
  }, [selectedTeam]);

  // ── Filter to team + season ────────────────────────────────────────────────
  const teamArcs = useMemo(() => {
    return allArcs.filter(
      (d) => d.team === selectedTeam && d.season === selectedSeason
    );
  }, [allArcs, selectedTeam, selectedSeason]);

  const dates = useMemo(() => {
    const s = new Set(teamArcs.map((d) => d.date));
    return Array.from(s).sort();
  }, [teamArcs]);

  const currentDate = dates[dateIndex] ?? "";

  const visibleArcs = useMemo(
    () => teamArcs.filter((d) => d.date <= currentDate),
    [teamArcs, currentDate]
  );

  const latestArc = visibleArcs[visibleArcs.length - 1];

  // ── Map setup ──────────────────────────────────────────────────────────────
  const states = useMemo(() => {
    if (!usTopo) return null;
    return feature(usTopo, usTopo.objects.states) as any;
  }, [usTopo]);

  const projection = useMemo(() => {
    if (!states) return null;
    return d3.geoAlbersUsa().fitSize([WIDTH, HEIGHT], states);
  }, [states]);

  const path = useMemo(() => {
    if (!projection) return null;
    return d3.geoPath(projection);
  }, [projection]);

  const drawableArcs = useMemo(() => {
    if (!projection) return [];
    return visibleArcs.filter((d) => {
      const a = projection([d.from_lon, d.from_lat]);
      const b = projection([d.to_lon, d.to_lat]);
      return a != null && b != null;
    });
  }, [visibleArcs, projection]);

  // Net rating baseline for circle sizing
  const seasonNetRtgValues = useMemo(
    () => teamArcs.map((d) => d.netrtg).filter((v) => v != null) as number[],
    [teamArcs]
  );
  const seasonMeanNetRtg = useMemo(() => {
    if (!seasonNetRtgValues.length) return 0;
    return d3.mean(seasonNetRtgValues) ?? 0;
  }, [seasonNetRtgValues]);

  // Circle size: deviation from season mean NetRtg
  function circleRadius(netrtg?: number): number {
    if (netrtg == null) return 5;
    const dev = netrtg - seasonMeanNetRtg;
    return Math.max(3, 5 + dev * 0.6);
  }

  // ── Playback ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || !dates.length) return;
    const timer = window.setInterval(() => {
      setDateIndex((i) => {
        if (i >= dates.length - 1) {
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 300);
    return () => clearInterval(timer);
  }, [isPlaying, dates.length]);

  // ── Tooltip handlers ───────────────────────────────────────────────────────
  function handleArcHover(e: React.MouseEvent<SVGPathElement>, arc: ArcRow) {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    setTooltip({
      x: e.clientX - svgRect.left + 12,
      y: e.clientY - svgRect.top - 10,
      arc,
    });
  }

  if (!states || !path || !projection)
    return (
      <div style={{ color: "#94a3b8", padding: 40, fontFamily: "monospace" }}>
        Loading…
      </div>
    );

  const teamDisplayName =
    teams.find(([abbr]) => abbr === selectedTeam)?.[1] ?? selectedTeam;

  return (
    <div
      style={{
        background: "#0b1120",
        minHeight: "100vh",
        fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
        color: "#e2e8f0",
        padding: "24px",
      }}
    >
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.25em",
            color: "#f59e0b",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          NBA Travel Fatigue &amp; Performance
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            color: "#f8fafc",
            letterSpacing: "-0.03em",
          }}
        >
          {teamDisplayName || "Select a team"}{" "}
          <span style={{ color: "#475569", fontWeight: 400 }}>
            {selectedSeason}
          </span>
        </h1>
      </div>

      {/* ── Controls ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
          background: "#111827",
          borderRadius: 8,
          padding: "12px 16px",
          border: "1px solid #1e293b",
        }}
      >
        {/* Team selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em" }}>
            TEAM
          </label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#e2e8f0",
              borderRadius: 4,
              padding: "5px 8px",
              fontFamily: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {teams.map(([abbr, name]) => (
              <option key={abbr} value={abbr}>
                {name} ({abbr})
              </option>
            ))}
          </select>
        </div>

        {/* Season selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em" }}>
            SEASON
          </label>
          <select
            value={selectedSeason}
            onChange={(e) => {
              setSelectedSeason(e.target.value);
              setDateIndex(0);
              setIsPlaying(false);
            }}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#e2e8f0",
              borderRadius: 4,
              padding: "5px 8px",
              fontFamily: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 36, background: "#1e293b" }} />

        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying((p) => !p)}
          style={{
            background: isPlaying ? "#dc2626" : "#f59e0b",
            color: "#0b1120",
            border: "none",
            borderRadius: 4,
            padding: "7px 16px",
            fontFamily: "inherit",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.08em",
            cursor: "pointer",
          }}
        >
          {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
        </button>

        {/* Reset */}
        <button
          onClick={() => {
            setIsPlaying(false);
            setDateIndex(0);
          }}
          style={{
            background: "transparent",
            color: "#64748b",
            border: "1px solid #334155",
            borderRadius: 4,
            padding: "7px 14px",
            fontFamily: "inherit",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ↩ RESET
        </button>

        {/* Date + progress */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>DATE</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              {currentDate || "—"}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(dates.length - 1, 0)}
            value={dateIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setDateIndex(Number(e.target.value));
            }}
            style={{ width: "100%", accentColor: "#f59e0b" }}
          />
        </div>

        {/* Trip counter */}
        <div
          style={{
            fontSize: 12,
            color: "#94a3b8",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>
            {drawableArcs.length}
          </span>{" "}
          / {teamArcs.length} trips
        </div>
      </div>

      {/* ── Map ── */}
      <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #1e293b" }}>
        <svg
          ref={svgRef}
          width={WIDTH}
          height={HEIGHT}
          style={{ background: "#0d1b2e", display: "block" }}
        >
          {/* State outlines */}
          <g>
            {states.features.map((f: any) => (
              <path
                key={f.id}
                d={path(f)!}
                fill="#0f2135"
                stroke="#1e3a5f"
                strokeWidth={0.5}
              />
            ))}
          </g>

          {/* Travel arcs */}
          <g>
            {drawableArcs.map((d) => {
              const geo = arcLineString(d, 80);
              const arcPath = path(geo);
              if (!arcPath) return null;
              const isLatest = d === latestArc;

              return (
                <path
                  key={`${d.team}-${d.game_id}`}
                  d={arcPath}
                  fill="none"
                  stroke={fatigueColor(d.fatigue_index)}
                  strokeWidth={isLatest ? strokeWidth(d.travel_miles) + 1 : strokeWidth(d.travel_miles)}
                  opacity={isLatest ? 1 : 0.45}
                  strokeLinecap="round"
                  onMouseMove={(e) => handleArcHover(e, d)}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </g>

          {/* Destination circles (NetRtg deviation) */}
          <g>
            {drawableArcs.map((d) => {
              if (!projection) return null;
              const pt = projection([d.to_lon, d.to_lat]);
              if (!pt) return null;
              const r = circleRadius(d.netrtg);
              const isLatest = d === latestArc;

              return (
                <circle
                  key={`dot-${d.team}-${d.game_id}`}
                  cx={pt[0]}
                  cy={pt[1]}
                  r={isLatest ? r + 2 : r}
                  fill={fatigueColor(d.fatigue_index)}
                  stroke={isLatest ? "#f8fafc" : "#0b1120"}
                  strokeWidth={isLatest ? 1.5 : 0.5}
                  opacity={isLatest ? 1 : 0.7}
                  onMouseMove={(e) => handleArcHover(e, d)}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </g>

          {/* Animated plane on latest arc */}
          {latestArc && (() => {
            const geo = arcLineString(latestArc, 80);
            const arcPath = path(geo);
            if (!arcPath) return null;
            const pid = `latest-arc-${latestArc.game_id}`;
            return (
              <g key={`plane-${latestArc.game_id}`}>
                <path id={pid} d={arcPath} fill="none" stroke="none" />
                <g>
                  <animateMotion dur="0.6s" repeatCount="1" fill="freeze">
                    <mpath href={`#${pid}`} />
                  </animateMotion>
                  <circle r={5} fill="#ffffff" opacity={0.95} />
                  <polygon points="0,-7 -3,3 0,1 3,3" fill="#ffffff" opacity={0.95} />
                </g>
              </g>
            );
          })()}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y,
              pointerEvents: "none",
              background: "rgba(11,17,32,0.97)",
              border: `1px solid ${fatigueColor(tooltip.arc.fatigue_index)}`,
              borderRadius: 6,
              padding: "10px 14px",
              fontSize: 12,
              lineHeight: 1.7,
              color: "#e2e8f0",
              maxWidth: 220,
              boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 4,
                color: "#f8fafc",
              }}
            >
              {tooltip.arc.city ?? tooltip.arc.opponent}{" "}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: tooltip.arc.isWin ? "#4ade80" : "#f87171",
                }}
              >
                {tooltip.arc.isWin == null
                  ? ""
                  : tooltip.arc.isWin
                  ? `W ${tooltip.arc.pts}–${tooltip.arc.oppPts}`
                  : `L ${tooltip.arc.pts}–${tooltip.arc.oppPts}`}
              </span>
            </div>
            <div style={{ color: "#94a3b8", marginBottom: 6, fontSize: 11 }}>
              {tooltip.arc.date} · vs {tooltip.arc.opponent}
            </div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                {[
                  ["Rest", tooltip.arc.rest_days != null ? `${tooltip.arc.rest_days.toFixed(1)} days` : "—"],
                  ["Travel", tooltip.arc.travel_miles != null ? `${Math.round(tooltip.arc.travel_miles).toLocaleString()} mi` : "—"],
                  ["TZ crossed", tooltip.arc.tz_crossed != null ? tooltip.arc.tz_crossed : "—"],
                  ["Fatigue Index", tooltip.arc.fatigue_index != null ? tooltip.arc.fatigue_index.toFixed(1) : "—"],
                  ["ORtg", tooltip.arc.ortg != null ? tooltip.arc.ortg.toFixed(1) : "—"],
                  ["DRtg", tooltip.arc.drtg != null ? tooltip.arc.drtg.toFixed(1) : "—"],
                  ["NetRtg", tooltip.arc.netrtg != null ? tooltip.arc.netrtg.toFixed(1) : "—"],
                ].map(([label, val]) => (
                  <tr key={label as string}>
                    <td style={{ color: "#64748b", paddingRight: 12, fontSize: 11 }}>{label}</td>
                    <td style={{ color: "#e2e8f0", textAlign: "right" }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            background: "rgba(11,17,32,0.92)",
            border: "1px solid #1e293b",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 11,
          }}
        >
          <div style={{ color: "#64748b", letterSpacing: "0.1em", marginBottom: 8 }}>
            FATIGUE INDEX
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#38bdf8" }}>● Low</span>
            <div
              style={{
                width: 60,
                height: 6,
                borderRadius: 3,
                background: "linear-gradient(to right, #38bdf8, #facc15, #ef4444)",
              }}
            />
            <span style={{ color: "#ef4444" }}>High</span>
          </div>
          <div style={{ color: "#64748b", marginTop: 8 }}>
            Arc width = miles · Circle = NetRtg
          </div>
        </div>
      </div>

      {/* ── Stats strip ── */}
      {latestArc && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "LAST GAME", value: `vs ${latestArc.opponent}`, sub: latestArc.date },
            {
              label: "RESULT",
              value: latestArc.isWin == null ? "—" : latestArc.isWin ? `W ${latestArc.pts}–${latestArc.oppPts}` : `L ${latestArc.pts}–${latestArc.oppPts}`,
              color: latestArc.isWin == null ? undefined : latestArc.isWin ? "#4ade80" : "#f87171",
            },
            { label: "FATIGUE INDEX", value: latestArc.fatigue_index != null ? latestArc.fatigue_index.toFixed(1) : "—", color: fatigueColor(latestArc.fatigue_index) },
            { label: "TRAVEL", value: latestArc.travel_miles != null ? `${Math.round(latestArc.travel_miles).toLocaleString()} mi` : "—" },
            { label: "REST", value: latestArc.rest_days != null ? `${latestArc.rest_days.toFixed(1)} days` : "—" },
            { label: "NET RTG", value: latestArc.netrtg != null ? latestArc.netrtg.toFixed(1) : "—" },
          ].map(({ label, value, sub, color }) => (
            <div
              key={label}
              style={{
                background: "#111827",
                border: "1px solid #1e293b",
                borderRadius: 6,
                padding: "8px 14px",
                minWidth: 110,
              }}
            >
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em" }}>
                {label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: color ?? "#f8fafc" }}>
                {value}
              </div>
              {sub && <div style={{ fontSize: 10, color: "#64748b" }}>{sub}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
