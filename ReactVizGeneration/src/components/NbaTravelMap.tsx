import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";

interface ArcRow {
  season: string;
  date: string;
  game_id: string;
  team: string;
  team_name: string;
  opponent: string;
  home_away: string;
  rest_days?: number;
  isWin?: boolean;
  pts?: number;
  oppPts?: number;
  ortg?: number;
  travel_miles?: number;
  city?: string;

  from_lat: number;
  from_lon: number;
  to_lat: number;
  to_lon: number;

  dateObj?: Date;
}

const width = 960;
const height = 600;

function arcLineString(d: ArcRow, n = 100): GeoJSON.LineString {
  const a: [number, number] = [d.from_lon, d.from_lat];
  const b: [number, number] = [d.to_lon, d.to_lat];

  // Use geoInterpolate to create a great-circle arc with many points for smooth curves
  const interp = d3.geoInterpolate(a, b);
  const coords = d3.range(n).map((i) => interp(i / (n - 1)));

  return { type: "LineString", coordinates: coords };
}

export default function NBATravelMap() {
  const [arcs, setArcs] = useState<ArcRow[]>([]);
  const [usTopo, setUsTopo] = useState<any>(null);

  const [dateIndex, setDateIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [prevDateIndex, setPrevDateIndex] = useState(0);

  useEffect(() => {
    async function load() {
      const [mapData, arcData] = await Promise.all([
        d3.json("/data/states-10m.json"),
        d3.json("/data/travel_arcs.json"),
      ]);

      const cleaned = (arcData as any[]).map((d) => {
        const from_lat = +d.from_lat;
        const from_lon = +d.from_lon;
        const to_lat = +d.to_lat;
        const to_lon = +d.to_lon;

        return {
          ...d,
          from_lat,
          from_lon,
          to_lat,
          to_lon,
          pts: d.pts == null ? undefined : +d.pts,
          oppPts: d.oppPts == null ? undefined : +d.oppPts,
          ortg: d.ortg == null ? undefined : +d.ortg,
          travel_miles: d.travel_miles == null ? undefined : +d.travel_miles,
          rest_days: d.rest_days == null ? undefined : +d.rest_days,
          dateObj: new Date(d.date),
        } as ArcRow;
      });

      // Basic validity filter (NaNs / missing coords)
      const validCoords = cleaned.filter(
        (d) =>
          Number.isFinite(d.from_lat) &&
          Number.isFinite(d.from_lon) &&
          Number.isFinite(d.to_lat) &&
          Number.isFinite(d.to_lon)
      );

      // Optional: drop “no travel” arcs (home→home same coords)
      const nonZero = validCoords.filter(
        (d) => !(d.from_lat === d.to_lat && d.from_lon === d.to_lon)
      );

      nonZero.sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());

      console.log("Loaded arcs:", cleaned.length);
      console.log("Valid coords arcs:", validCoords.length);
      console.log("Non-zero arcs:", nonZero.length);

      setUsTopo(mapData);
      setArcs(nonZero);
      setDateIndex(0);
    }

    load().catch((err) => console.error("Load failed:", err));
  }, []);

    const states = useMemo(() => {
    if (!usTopo) return null;
    return feature(usTopo, usTopo.objects.states) as any;
    }, [usTopo]);

  const projection = useMemo(() => {
    if (!states) return null;
    return d3.geoAlbersUsa().fitSize([width, height], states);
  }, [states]);

  const path = useMemo(() => {
    if (!projection) return null;
    return d3.geoPath(projection);
  }, [projection]);

  // Unique dates
  const dates = useMemo(() => {
    const s = new Set(arcs.map((d) => d.date));
    return Array.from(s).sort();
  }, [arcs]);

  const currentDate = dates[dateIndex];

  // Filter to visible arcs
  const visibleArcs = useMemo(() => {
    if (!currentDate) return [];
    return arcs.filter((d) => d.date <= currentDate);
  }, [arcs, currentDate]);

  // Filter further: only arcs whose endpoints can be projected
  const drawableArcs = useMemo(() => {
    if (!projection) return [];
    const out = visibleArcs.filter((d) => {
      const a = projection([d.from_lon, d.from_lat]);
      const b = projection([d.to_lon, d.to_lat]);
      return a != null && b != null;
    });
    console.log("Visible arcs:", visibleArcs.length, "Drawable arcs:", out.length);
    return out;
  }, [visibleArcs, projection]);

  // Get arcs that were added since the last frame (for plane animation)
  const animatingArcs = useMemo(() => {
    const prevVisibleCount = arcs.filter((d) => d.date <= dates[prevDateIndex]).length;
    const currentVisibleCount = drawableArcs.length;
    
    if (currentVisibleCount <= prevVisibleCount) return [];
    
    // Return the newly added arcs
    return drawableArcs.slice(prevVisibleCount);
  }, [drawableArcs, prevDateIndex, dates, arcs]);

  useEffect(() => {
    if (!isPlaying) return;
    if (!dates.length) return;

    const timer = window.setInterval(() => {
      setDateIndex((i) => {
        const newIndex = i < dates.length - 1 ? i + 1 : i;
        setPrevDateIndex(i);
        return newIndex;
      });
    }, 400);

    return () => window.clearInterval(timer);
  }, [isPlaying, dates.length]);

  if (!states || !path || !projection) return <div>Loading map…</div>;

  return (
    <div style={{ width, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 8 }}>
        <button onClick={() => setIsPlaying((p) => !p)}>{isPlaying ? "Pause" : "Play"}</button>

        <input
          type="range"
          min={0}
          max={Math.max(dates.length - 1, 0)}
          value={dateIndex}
          onChange={(e) => {
            setIsPlaying(false);
            setDateIndex(Number(e.target.value));
          }}
          style={{ width: 420 }}
        />

        <div style={{ fontFamily: "system-ui, sans-serif" }}>
          <b>Date:</b> {currentDate ?? "—"}{" "}
          <span style={{ marginLeft: 12 }}>
            <b>Trips shown:</b> {drawableArcs.length}
          </span>
        </div>
      </div>

      <svg width={width} height={height}>
        <defs>
          {/* Airplane marker */}
          <g id="airplane-marker">
            <circle cx="0" cy="0" r="4" fill="blue" opacity="0.9" />
            <polygon points="0,-6 -3,2 0,0 3,2" fill="blue" opacity="0.9" />
          </g>
        </defs>
        
        <g>
          {states.features.map((f: any) => (
            <path
              key={f.id}
              d={path(f)!}
              fill="none"
              stroke="gray"
              strokeWidth={0.6}
              opacity={0.4}
            />
          ))}
        </g>

        <g>
          {drawableArcs.map((d) => {
            const geo = arcLineString(d, 100);
            const arcPath = path(geo);
            if (!arcPath) return null; // critical guard

            // choose color based on win/loss; default grey if unknown
            const strokeColor = d.isWin == null ? "gray" : d.isWin ? "green" : "red";

            return (
              <path
                key={`${d.team}-${d.game_id}`}
                d={arcPath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={2.5}
                opacity={0.8}
              />
            );
          })}
        </g>

        {/* Animated planes on recently added arcs */}
        <g>
          {animatingArcs.map((d) => {
            const geo = arcLineString(d, 100);
            const arcPath = path(geo);
            if (!arcPath) return null;

            const strokeColor = d.isWin == null ? "gray" : d.isWin ? "green" : "red";

            return (
              <g key={`plane-${d.team}-${d.game_id}`}>
                <path
                  d={arcPath}
                  fill="none"
                  stroke="none"
                  id={`arc-path-${d.team}-${d.game_id}`}
                />
                <g
                  style={{
                    animation: `travel-plane 2s ease-in-out forwards`,
                  } as any}
                >
                  <animateMotion
                    dur="2s"
                    repeatCount="1"
                    fill="freeze"
                  >
                    <mpath href={`#arc-path-${d.team}-${d.game_id}`} />
                  </animateMotion>
                  {/* plane shape uses the same color as the arc */}
                  <circle cx="0" cy="0" r="4" fill={strokeColor} opacity="0.9" />
                  <polygon points="0,-6 -3,2 0,0 3,2" fill={strokeColor} opacity="0.9" />
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}