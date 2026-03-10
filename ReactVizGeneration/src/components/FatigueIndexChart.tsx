import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

interface GameRow {
  game_id: string;
  game_date: string;
  team_slug: string;
  fatigue_index: number | null;
  game_number: number;
  players_out: number;
}

/** Injury spell: one player out from startDate until endDate (endDate exclusive) */
interface InjurySpell {
  teamSlug: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // null = still out at end of data
}

/** Map injury dataset team names to team_slug */
const TEAM_NAME_TO_SLUG: Record<string, string> = {
  "Hawks": "ATL", "Celtics": "BOS", "Nets": "BKN", "Hornets": "CHA", "Bulls": "CHI",
  "Cavaliers": "CLE", "Mavericks": "DAL", "Nuggets": "DEN", "Pistons": "DET",
  "Warriors": "GSW", "Rockets": "HOU", "Pacers": "IND", "Clippers": "LAC",
  "Lakers": "LAL", "Grizzlies": "MEM", "Heat": "MIA", "Bucks": "MIL",
  "Timberwolves": "MIN", "Pelicans": "NOP", "Knicks": "NYK", "Thunder": "OKC",
  "Magic": "ORL", "76ers": "PHI", "Suns": "PHX", "Trail Blazers": "POR",
  "Blazers": "POR", "Kings": "SAC", "Spurs": "SAS", "Raptors": "TOR",
  "Jazz": "UTA", "Wizards": "WAS",
};

const WIDTH = 800;
const HEIGHT = 400;
const MARGIN = { top: 24, right: 24, bottom: 48, left: 56 };

/** Theme aligned with NbaTravelMap_v3 */
const CHART_THEME = {
  fontFamily: "'IBM Plex Mono','Courier New',monospace",
  bgPage: "#0f172a",
  bgChart: "#0a1628",
  border: "#1e293b",
  borderLight: "#334155",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  axis: "#64748b",
  lineLow: "#38bdf8",
  lineMid: "#facc15",
  lineHigh: "#ef4444",
} as const;

const TEAM_COLORS: Record<string, string> = {
  ATL: "#C8102E", BOS: "#007A33", BKN: "#aaaaaa", CHA: "#1D1160", CHI: "#CE1141",
  CLE: "#860038", DAL: "#00538C", DEN: "#FEC524", DET: "#C8102E", GSW: "#1D428A",
  HOU: "#CE1141", IND: "#FDBB30", LAC: "#C8102E", LAL: "#FDB927", MEM: "#5D76A9",
  MIA: "#98002E", MIL: "#00471B", MIN: "#78BE20", NOP: "#0C2340", NYK: "#F58426",
  OKC: "#007AC1", ORL: "#0077C0", PHI: "#006BB6", PHX: "#E56020", POR: "#E03A3E",
  SAC: "#5A2D81", SAS: "#C4CED4", TOR: "#CE1141", UTA: "#F9A01B", WAS: "#E31837",
};

/** Season label e.g. "2023-24" -> date range for that NBA season (Oct - Jun) */
function seasonDateRange(seasonLabel: string): { startDate: string; endDate: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(seasonLabel.trim());
  if (!m) return null;
  const startYear = parseInt(m[1], 10);
  const endYear = startYear + 1;
  return {
    startDate: `${startYear}-10-01`,
    endDate: `${endYear}-06-30`,
  };
}

export default function FatigueIndexChart() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [injuryRows, setInjuryRows] = useState<Record<string, unknown>[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("ATL");
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      d3.csv("/data/team_game_master_2015-2025.csv"),
      d3.csv("/data/injury_data.csv"),
    ])
      .then(([teamRows, injuryData]) => {
        setRawData(teamRows);
        setInjuryRows(injuryData);
        if (teamRows.length && !selectedSeason) {
          const excluded = new Set(["2014-15", "2015-16"]);
          const seasonKeys = [...new Set(teamRows.map((r) => String(r.season ?? "").replace(/^"|"$/g, "")).filter(Boolean))]
            .filter((s) => !excluded.has(s))
            .sort()
            .reverse();
          if (seasonKeys.length) setSelectedSeason((s) => s || seasonKeys[0]);
        }
        if (teamRows.length && !selectedTeam) {
          const teams = [...new Set(teamRows.map((r) => r.team_slug).filter(Boolean))] as string[];
          teams.sort();
          if (teams.length) setSelectedTeam(teams[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load data", err);
        setLoading(false);
      });
  }, []);

  const teams = useMemo(() => {
    const t = [...new Set(rawData.map((r) => r.team_slug).filter(Boolean))] as string[];
    return t.sort();
  }, [rawData]);

  const availableSeasons = useMemo(() => {
    const excluded = new Set(["2014-15", "2015-16"]);
    const s = [...new Set(rawData.map((r) => String(r.season ?? "").replace(/^"|"$/g, "")).filter(Boolean))]
      .filter((season) => !excluded.has(season))
      .sort()
      .reverse();
    return s;
  }, [rawData]);

  /** Currently displayed season (e.g. "2023-24") and its date range, from selected season */
  const displaySeason = useMemo(() => {
    if (!selectedSeason) return null;
    const range = seasonDateRange(selectedSeason);
    return range ? { seasonLabel: selectedSeason, ...range } : null;
  }, [selectedSeason]);

  /** Build injury spells from CSV: each spell = player out from Relinquished date until Acquired date */
  const injurySpells = useMemo(() => {
    const spells: InjurySpell[] = [];
    const byTeamPlayer = new Map<string, { startDate: string; rowIndex: number }>();
    const parseDate = (s: unknown) => {
      const str = String(s ?? "").trim();
      if (!str || str === "Date") return null;
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : str;
    };
    const slug = (name: unknown) => TEAM_NAME_TO_SLUG[String(name ?? "").trim()];
    const rows = [...injuryRows].sort((a, b) => {
      const da = new Date(String(a.Date ?? "")).getTime();
      const db = new Date(String(b.Date ?? "")).getTime();
      return da - db;
    });
    for (const r of rows) {
      const teamSlug = slug(r.Team);
      if (!teamSlug) continue;
      const dateStr = parseDate(r.Date);
      if (!dateStr) continue;
      const rel = String(r.Relinquished ?? "").trim();
      const acq = String(r.Acquired ?? "").trim();
      if (rel) {
        spells.push({ teamSlug, startDate: dateStr, endDate: null });
        byTeamPlayer.set(`${teamSlug}|${rel}`, { startDate: dateStr, rowIndex: spells.length - 1 });
      }
      if (acq) {
        const key = `${teamSlug}|${acq}`;
        const open = byTeamPlayer.get(key);
        if (open != null) {
          spells[open.rowIndex].endDate = dateStr;
          byTeamPlayer.delete(key);
        }
      }
    }
    return spells;
  }, [injuryRows]);

  /** Only spells that started within the displayed season (not before). May end in or after the season. */
  const injurySpellsInSeason = useMemo(() => {
    if (!displaySeason) return injurySpells;
    const seasonStart = new Date(displaySeason.startDate).getTime();
    return injurySpells.filter((s) => {
      const spellStart = new Date(s.startDate).getTime();
      return spellStart >= seasonStart;
    });
  }, [injurySpells, displaySeason]);

  /** Count players out for a team on a given date (YYYY-MM-DD), only from spells in the displayed season */
  const countPlayersOut = useMemo(() => {
    return (teamSlug: string, gameDateStr: string) => {
      const d = new Date(gameDateStr).getTime();
      if (isNaN(d)) return 0;
      let count = 0;
      for (const s of injurySpellsInSeason) {
        if (s.teamSlug !== teamSlug) continue;
        const start = new Date(s.startDate).getTime();
        if (d < start) continue;
        if (s.endDate != null) {
          const end = new Date(s.endDate).getTime();
          if (d >= end) continue;
        }
        count += 1;
      }
      return count;
    };
  }, [injurySpellsInSeason]);

  const chartData = useMemo(() => {
    if (!rawData.length || !selectedSeason) return [];

    const filtered = rawData.filter((r) => r.team_slug === selectedTeam && String(r.season ?? "").replace(/^"|"$/g, "") === selectedSeason);
    const games = filtered
      .map((r) => {
        const fatigue =
          r.fatigue_index != null && r.fatigue_index !== "" && String(r.fatigue_index).toUpperCase() !== "NA"
            ? Number(r.fatigue_index)
            : null;
        return { game_date: String(r.game_date ?? ""), fatigue_index: fatigue };
      })
      .sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime());

    return games.map((d, i) => ({
      game_id: "",
      game_date: d.game_date,
      team_slug: selectedTeam,
      fatigue_index: d.fatigue_index,
      game_number: i + 1,
      players_out: countPlayersOut(selectedTeam, d.game_date),
    })) as GameRow[];
  }, [rawData, selectedTeam, selectedSeason, countPlayersOut]);

  /** League-wide average number of players out per game for the selected season (for color scale) */
  const leagueAvgPlayersOutPerGame = useMemo(() => {
    if (!rawData.length || !selectedSeason) return 1;
    const seasonRows = rawData.filter((r) => String(r.season ?? "").replace(/^"|"$/g, "") === selectedSeason);
    if (!seasonRows.length) return 1;
    let sum = 0;
    for (const r of seasonRows) {
      const team = r.team_slug as string;
      const date = String(r.game_date ?? "").trim();
      if (team && date) sum += countPlayersOut(team, date);
    }
    return sum / seasonRows.length;
  }, [rawData, selectedSeason, countPlayersOut]);

  const pointsWithFatigue = useMemo(
    () => chartData.filter((d) => d.fatigue_index != null && Number.isFinite(d.fatigue_index)),
    [chartData]
  );

  /** Worst consecutive 5-game stretch by average fatigue index for the selected team */
  const worst5GameStretch = useMemo(() => {
    if (chartData.length < 5) return null;
    let maxAvg = -Infinity;
    let bestStart = 0;
    for (let i = 0; i <= chartData.length - 5; i++) {
      const slice = chartData.slice(i, i + 5);
      const valid = slice.filter((d) => d.fatigue_index != null && Number.isFinite(d.fatigue_index));
      if (valid.length < 3) continue;
      const avg = valid.reduce((s, d) => s + (d.fatigue_index ?? 0), 0) / valid.length;
      if (avg > maxAvg) {
        maxAvg = avg;
        bestStart = i;
      }
    }
    if (maxAvg === -Infinity) return null;
    const start = chartData[bestStart];
    const end = chartData[bestStart + 4];
    return {
      startGameNumber: start.game_number,
      endGameNumber: end.game_number,
      avgFatigue: maxAvg,
    };
  }, [chartData]);

  /** Average fatigue index per team for the displayed season, sorted highest to lowest */
  const allTeamsAvgFatigue = useMemo(() => {
    if (!rawData.length || !displaySeason) return [];
    const seasonLabel = displaySeason.seasonLabel;
    const byTeam = new Map<string, number[]>();
    for (const r of rawData) {
      const s = String(r.season ?? "").replace(/^"|"$/g, "");
      if (s !== seasonLabel || !r.team_slug) continue;
      const f =
        r.fatigue_index != null && r.fatigue_index !== "" && String(r.fatigue_index).toUpperCase() !== "NA"
          ? Number(r.fatigue_index)
          : null;
      if (f == null || !Number.isFinite(f)) continue;
      if (!byTeam.has(r.team_slug as string)) byTeam.set(r.team_slug as string, []);
      byTeam.get(r.team_slug as string)!.push(f);
    }
    return [...byTeam.entries()]
      .map(([teamSlug, vals]) => ({
        teamSlug,
        avgFatigue: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
      }))
      .sort((a, b) => b.avgFatigue - a.avgFatigue);
  }, [rawData, displaySeason]);

  useEffect(() => {
    if (!chartData.length) return;
    console.log(`[FatigueIndexChart] Players out per game — Team: ${selectedTeam}`);
    chartData.forEach((d) => {
      console.log(`  Game ${d.game_number} (${d.game_date}): ${d.players_out} players out`);
    });
    console.log(`[FatigueIndexChart] Summary — min: ${Math.min(...chartData.map((x) => x.players_out))}, max: ${Math.max(...chartData.map((x) => x.players_out))}`);
  }, [chartData, selectedTeam]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("style", `background: ${CHART_THEME.bgChart}; display: block; font-family: ${CHART_THEME.fontFamily};`);

    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const xMax = d3.max(chartData, (d) => d.game_number) ?? 82;
    const xScale = d3
      .scaleLinear()
      .domain([1, Math.max(82, xMax)])
      .range([0, innerWidth]);

    if (pointsWithFatigue.length === 0) {
      const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
      g.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#666")
        .text("No fatigue index data for this team");
      const emptyXScale = d3.scaleLinear().domain([1, 82]).range([0, innerWidth]);
      const emptyYScale = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);
      g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(emptyXScale).ticks(10).tickFormat((d) => String(d)));
      g.append("g").call(d3.axisLeft(emptyYScale).ticks(8));
      return;
    }

    const fatigueExtent = d3.extent(pointsWithFatigue, (d) => d.fatigue_index!) as [number, number];
    const yPadding = (fatigueExtent[1] - fatigueExtent[0]) * 0.05 || 1;
    const yScale = d3
      .scaleLinear()
      .domain([fatigueExtent[0] - yPadding, fatigueExtent[1] + yPadding])
      .range([innerHeight, 0]);

    const line = d3
      .line<GameRow>()
      .x((d) => xScale(d.game_number))
      .y((d) => yScale(d.fatigue_index!))
      .defined((d) => d.fatigue_index != null && Number.isFinite(d.fatigue_index));

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const maxPlayersOut = d3.max(chartData, (d) => d.players_out) ?? 1;
    const leagueAvg = leagueAvgPlayersOutPerGame;
    const scaleMax = Math.max(leagueAvg * 2, maxPlayersOut, 1);
    const colorScale = d3
      .scaleLinear<string>()
      .domain([0, leagueAvg, scaleMax])
      .range(["#15803d", "#eab308", "#dc2626"])
      .clamp(true);

    const xMaxScale = Math.max(82, xMax);
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "fatigue-injury-gradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", MARGIN.left)
      .attr("x2", MARGIN.left + innerWidth)
      .attr("y1", 0)
      .attr("y2", 0);
    chartData.forEach((d) => {
      const offset = Math.max(0, Math.min(1, (d.game_number - 1) / (xMaxScale - 1)));
      gradient.append("stop").attr("offset", offset).attr("stop-color", colorScale(d.players_out));
    });

    const area = d3
      .area<GameRow>()
      .x((d) => xScale(d.game_number))
      .y0((d) => yScale(d.fatigue_index!))
      .y1(innerHeight)
      .defined((d) => d.fatigue_index != null && Number.isFinite(d.fatigue_index));

    g.append("path")
      .datum(pointsWithFatigue)
      .attr("fill", "url(#fatigue-injury-gradient)")
      .attr("d", area);

    if (worst5GameStretch) {
      const x1 = xScale(worst5GameStretch.startGameNumber);
      const x2 = xScale(worst5GameStretch.endGameNumber);
      g.append("rect")
        .attr("x", x1)
        .attr("y", 0)
        .attr("width", Math.max(2, x2 - x1))
        .attr("height", innerHeight)
        .attr("fill", "rgba(239, 68, 68, 0.18)")
        .attr("stroke", CHART_THEME.lineHigh)
        .attr("stroke-width", 1);
      g.append("text")
        .attr("x", (x1 + x2) / 2)
        .attr("y", -6)
        .attr("text-anchor", "middle")
        .attr("fill", CHART_THEME.textMuted)
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("font-family", CHART_THEME.fontFamily)
        .text(`Worst 5-game stretch (avg ${worst5GameStretch.avgFatigue.toFixed(1)})`);
    }

    const teamColor = TEAM_COLORS[selectedTeam] ?? CHART_THEME.lineLow;
    g.append("path")
      .datum(pointsWithFatigue)
      .attr("fill", "none")
      .attr("stroke", teamColor)
      .attr("stroke-width", 2)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("d", line);

    const xAxis = d3.axisBottom(xScale).ticks(10).tickFormat((d) => String(d));
    const yAxis = d3.axisLeft(yScale).ticks(8);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr("class", "x-axis")
      .call((sel) => {
        sel.selectAll(".tick text").attr("fill", "#e2e8f0").attr("font-family", CHART_THEME.fontFamily);
        sel.selectAll(".domain, .tick line").attr("stroke", CHART_THEME.border);
      });

    g.append("g")
      .call(yAxis)
      .attr("class", "y-axis")
      .call((sel) => {
        sel.selectAll(".tick text").attr("fill", "#e2e8f0").attr("font-family", CHART_THEME.fontFamily);
        sel.selectAll(".domain, .tick line").attr("stroke", CHART_THEME.border);
      });
  }, [chartData, pointsWithFatigue, worst5GameStretch, selectedTeam, leagueAvgPlayersOutPerGame]);

  const handleTeamChange = (e: SelectChangeEvent<string>) => {
    setSelectedTeam(e.target.value);
  };

  if (loading) {
    return (
      <Box p={2} sx={{ color: CHART_THEME.textMuted, fontFamily: CHART_THEME.fontFamily }}>
        Loading team game data…
      </Box>
    );
  }

  const teamColor = TEAM_COLORS[selectedTeam] ?? CHART_THEME.lineLow;

  return (
    <Paper
      sx={{
        p: 2,
        fontFamily: CHART_THEME.fontFamily,
        background: CHART_THEME.bgPage,
        border: `1px solid ${CHART_THEME.border}`,
        borderRadius: 2,
        color: CHART_THEME.textMuted,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
        Fatigue index — By game number (season)
      </h2>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", mb: 2, mt: 1.5 }}>
      <FormControl
        size="small"
        sx={{
          minWidth: 160,
          "& .MuiOutlinedInput-root": {
            background: CHART_THEME.border,
            border: `1px solid ${CHART_THEME.borderLight}`,
            color: CHART_THEME.textMuted,
            "& fieldset": { border: "none" },
            "&:hover fieldset": { borderColor: CHART_THEME.borderLight },
          },
          "& .MuiInputLabel-root": { color: CHART_THEME.textDim },
          "& .MuiInputLabel-root.Mui-focused": { color: CHART_THEME.textMuted },
          "& .MuiSvgIcon-root": { color: CHART_THEME.textMuted },
          "& .MuiSelect-select": { fontFamily: "inherit" },
        }}
      >
        <InputLabel id="season-select-label">Season</InputLabel>
        <Select
          labelId="season-select-label"
          value={selectedSeason}
          label="Season"
          onChange={(e) => setSelectedSeason(e.target.value)}
          MenuProps={{
            PaperProps: {
              sx: {
                fontFamily: CHART_THEME.fontFamily,
                background: CHART_THEME.bgPage,
                border: `1px solid ${CHART_THEME.border}`,
                "& .MuiMenuItem-root": { color: CHART_THEME.textMuted },
                "& .MuiMenuItem-root:hover": { background: CHART_THEME.border },
                "& .MuiMenuItem-root.Mui-selected": { background: CHART_THEME.border, color: CHART_THEME.lineLow },
              },
            },
          }}
        >
          {availableSeasons.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl
        size="small"
        sx={{
          minWidth: 160,
          mb: 2,
          "& .MuiOutlinedInput-root": {
            background: CHART_THEME.border,
            border: `1px solid ${CHART_THEME.borderLight}`,
            color: CHART_THEME.textMuted,
            "& fieldset": { border: "none" },
            "&:hover fieldset": { borderColor: CHART_THEME.borderLight },
          },
          "& .MuiInputLabel-root": { color: CHART_THEME.textDim },
          "& .MuiInputLabel-root.Mui-focused": { color: CHART_THEME.textMuted },
          "& .MuiSvgIcon-root": { color: CHART_THEME.textMuted },
          "& .MuiSelect-select": { fontFamily: "inherit" },
        }}
      >
        <InputLabel id="team-select-label">Team</InputLabel>
        <Select
          labelId="team-select-label"
          value={selectedTeam}
          label="Team"
          onChange={handleTeamChange}
            MenuProps={{
              PaperProps: {
                sx: {
                  fontFamily: CHART_THEME.fontFamily,
                  background: CHART_THEME.bgPage,
                  border: `1px solid ${CHART_THEME.border}`,
                  "& .MuiMenuItem-root": { color: CHART_THEME.textMuted },
                  "& .MuiMenuItem-root:hover": { background: CHART_THEME.border },
                  "& .MuiMenuItem-root.Mui-selected": { background: CHART_THEME.border, color: teamColor },
                },
              },
            }}
        >
          {teams.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      </Box>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Box sx={{ borderRadius: 1, overflow: "hidden", border: `1px solid ${CHART_THEME.border}` }}>
          <svg
            ref={svgRef}
            width={WIDTH}
            height={HEIGHT}
            style={{ display: "block" }}
          />
          <Typography
            variant="caption"
            display="block"
            sx={{ px: 1, py: 0.5, color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}
          >
            X: game number (1–82). Y: fatigue index. Team: {selectedTeam}.
          </Typography>
          <Typography
            variant="caption"
            display="block"
            sx={{ px: 1, pb: 1, color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}
          >
            Shaded area: players out (green = below league avg, yellow = league avg, red = above). Red band: worst 5-game stretch.
          </Typography>
        </Box>
        <TableContainer
          component={Paper}
          sx={{
            fontFamily: CHART_THEME.fontFamily,
            maxWidth: 280,
            maxHeight: 420,
            background: CHART_THEME.bgPage,
            border: `1px solid ${CHART_THEME.border}`,
            borderRadius: 2,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              px: 1.5,
              py: 1,
              color: CHART_THEME.textDim,
              fontSize: 10,
              letterSpacing: "0.1em",
            }}
          >
            AVG FATIGUE INDEX BY TEAM
          </Typography>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ "& th": { background: CHART_THEME.border, borderColor: CHART_THEME.border } }}>
                <TableCell align="right" sx={{ color: CHART_THEME.textDim, borderColor: CHART_THEME.border, fontSize: 11 }}>
                  #
                </TableCell>
                <TableCell sx={{ color: CHART_THEME.textDim, borderColor: CHART_THEME.border, fontSize: 11 }}>
                  Team
                </TableCell>
                <TableCell align="right" sx={{ color: CHART_THEME.textDim, borderColor: CHART_THEME.border, fontSize: 11 }}>
                  Avg
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allTeamsAvgFatigue.map((row, idx) => (
                <TableRow
                  key={row.teamSlug}
                  sx={{
                    backgroundColor: row.teamSlug === selectedTeam ? CHART_THEME.border : "transparent",
                    "& .MuiTableCell-root": {
                      color: row.teamSlug === selectedTeam ? teamColor : CHART_THEME.textMuted,
                      borderColor: CHART_THEME.border,
                      fontSize: 12,
                      fontWeight: row.teamSlug === selectedTeam ? 700 : 400,
                    },
                  }}
                >
                  <TableCell align="right">{idx + 1}</TableCell>
                  <TableCell>{row.teamSlug}</TableCell>
                  <TableCell align="right">{row.avgFatigue.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Paper>
  );
}
