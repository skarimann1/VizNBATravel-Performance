import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

const CHART_THEME = {
  fontFamily: "'IBM Plex Mono','Courier New',monospace",
  bgPage: "#0f172a",
  border: "#1e293b",
  borderLight: "#334155",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  textDim: "#64748b",
} as const;

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

/** Date string YYYY-MM-DD -> NBA season label e.g. "2016-17" */
function dateToSeason(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 10) return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
  return `${year - 1}-${String(year % 100).padStart(2, "0")}`;
}

/** Normalize player name for matching: take primary name, strip parentheticals, trim */
function normalizePlayerName(raw: string): string {
  const s = String(raw ?? "").trim();
  const primary = s.split("/")[0].trim();
  return primary.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

/** Check if normalized injury name matches a stats name (flexible) */
function nameMatches(injuryName: string, statsName: string): boolean {
  const a = normalizePlayerName(injuryName).toLowerCase();
  const b = normalizePlayerName(statsName).toLowerCase();
  if (a === b) return true;
  const aParts = a.split(" ");
  const bParts = b.split(" ");
  const lastA = aParts[aParts.length - 1];
  const lastB = bParts[bParts.length - 1];
  const firstA = aParts[0];
  const firstB = bParts[0];
  return lastA === lastB && (firstA === firstB || firstA.startsWith(firstB) || firstB.startsWith(firstA));
}

interface InjurySpellRow {
  playerName: string;
  teamSlug: string;
  teamName: string;
  startDate: string;
  endDate: string | null;
  daysOut: number;
  ppg: number | null;
  notes: string;
  season: string;
}

const TARGET_INJURY_SEASON = "2023-24"; // injuries from this season
const STAR_SEASON_LABEL = "2024-25";   // star = 20+ ppg in this season (player_stats.csv)

export default function StarPlayerInjuryTable() {
  const [injuryRows, setInjuryRows] = useState<Record<string, unknown>[]>([]);
  const [playerStatsRows, setPlayerStatsRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      d3.csv("/data/injury_data.csv"),
      d3.csv("/data/player_stats.csv"),
    ])
      .then(([injury, stats]) => {
        setInjuryRows(injury);
        setPlayerStatsRows(stats);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load star injury data", err);
        setLoading(false);
      });
  }, []);

  /** Star players: 20+ PPG from player_stats (PTS is per-game in this CSV) */
  const starPlayerNames = useMemo(() => {
    const set = new Set<string>();
    const ppgByNormalName = new Map<string, number>();
    playerStatsRows.forEach((r) => {
      const name = String(r.PLAYER_NAME ?? "").trim();
      if (!name || name === "PLAYER_NAME") return;
      const pts = Number(r.PTS);
      const gp = Number(r.GP);
      const ppg = Number.isFinite(pts) && pts <= 50 ? pts : (Number.isFinite(gp) && gp > 0 ? pts / gp : NaN);
      if (!Number.isFinite(ppg) || ppg < 20) return;
      const norm = normalizePlayerName(name);
      set.add(norm);
      if (!ppgByNormalName.has(norm) || (ppgByNormalName.get(norm)! < ppg)) ppgByNormalName.set(norm, ppg);
    });
    return { set, ppgByNormalName };
  }, [playerStatsRows]);

  const spells = useMemo(() => {
    const byKey = new Map<string, { startDate: string; rowIndex: number }>();
    const result: { playerName: string; teamName: string; startDate: string; endDate: string | null; notes: string }[] = [];
    const rows = [...injuryRows].sort((a, b) => new Date(String(a.Date)).getTime() - new Date(String(b.Date)).getTime());
    rows.forEach((r) => {
      const teamName = String(r.Team ?? "").trim();
      const teamSlug = TEAM_NAME_TO_SLUG[teamName] ?? teamName;
      const rel = String(r.Relinquished ?? "").trim();
      const acq = String(r.Acquired ?? "").trim();
      const dateStr = String(r.Date ?? "").trim();
      if (!dateStr || dateStr === "Date") return;
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return;
      const dateNorm = dateObj.toISOString().slice(0, 10);
      const notes = String(r.Notes ?? "").trim();
      if (rel) {
        const primaryName = rel.split("/")[0].trim();
        const key = `${teamSlug}|${primaryName}`;
        result.push({ playerName: primaryName, teamName, startDate: dateNorm, endDate: null, notes });
        byKey.set(key, { startDate: dateNorm, rowIndex: result.length - 1 });
      }
      if (acq) {
        const primaryName = acq.split("/")[0].trim();
        const key = `${teamSlug}|${primaryName}`;
        const open = byKey.get(key);
        if (open != null) {
          result[open.rowIndex].endDate = dateNorm;
          byKey.delete(key);
        }
      }
    });
    return result;
  }, [injuryRows]);

  const tableRows = useMemo((): InjurySpellRow[] => {
    const out: InjurySpellRow[] = [];
    const ONE_MONTH_DAYS = 30;
    spells.forEach((s) => {
      const start = new Date(s.startDate).getTime();
      const end = s.endDate ? new Date(s.endDate).getTime() : Date.now();
      const daysOut = Math.round((end - start) / (24 * 60 * 60 * 1000));
      if (daysOut < ONE_MONTH_DAYS) return;
      const season = dateToSeason(s.startDate);
      if (season !== TARGET_INJURY_SEASON) return;
      const teamSlug = TEAM_NAME_TO_SLUG[s.teamName] ?? s.teamName;
      let isStar = false;
      let ppg: number | null = null;
      starPlayerNames.set.forEach((statsNorm) => {
        if (nameMatches(s.playerName, statsNorm)) {
          isStar = true;
          ppg = starPlayerNames.ppgByNormalName.get(statsNorm) ?? null;
        }
      });
      if (!isStar) return;
      out.push({
        playerName: s.playerName,
        teamSlug,
        teamName: s.teamName,
        startDate: s.startDate,
        endDate: s.endDate,
        daysOut,
        ppg,
        notes: s.notes,
        season,
      });
    });
    return out.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [spells, starPlayerNames]);

  if (loading) {
    return (
      <Box p={2} sx={{ color: CHART_THEME.textMuted, fontFamily: CHART_THEME.fontFamily }}>
        Loading injury and player data…
      </Box>
    );
  }

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
      <h2 style={{ margin: "0 0 16px 0", fontSize: 20, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
        Notable Stars Injured in 2023-24 (out more than a month)
      </h2>
      <TableContainer sx={{ maxHeight: 420, border: `1px solid ${CHART_THEME.border}`, borderRadius: 1 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ "& th": { background: CHART_THEME.border, borderColor: CHART_THEME.border } }}>
              <TableCell sx={{ color: CHART_THEME.textDim, borderColor: CHART_THEME.border, fontSize: 11 }}>Player</TableCell>
              <TableCell sx={{ color: CHART_THEME.textDim, borderColor: CHART_THEME.border, fontSize: 11 }}>Team</TableCell>
              <TableCell sx={{ color: CHART_THEME.textDim, borderColor: CHART_THEME.border, fontSize: 11 }}>Start</TableCell>
              <TableCell sx={{ color: CHART_THEME.textDim, borderColor: CHART_THEME.border, fontSize: 11 }}>End</TableCell>
              <TableCell align="right" sx={{ color: CHART_THEME.textDim, borderColor: CHART_THEME.border, fontSize: 11 }}>PPG</TableCell>
              <TableCell sx={{ color: CHART_THEME.textDim, borderColor: CHART_THEME.border, fontSize: 11 }}>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tableRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ color: CHART_THEME.textDim, borderColor: CHART_THEME.border, textAlign: "center", py: 3 }}>
                  No 2024-25 stars (20+ PPG) had an injury spell over 30 days in 2023-24.
                </TableCell>
              </TableRow>
            ) : (
              tableRows.map((row, idx) => (
                <TableRow
                  key={`${row.playerName}-${row.startDate}-${idx}`}
                  sx={{ "& .MuiTableCell-root": { borderColor: CHART_THEME.border, color: CHART_THEME.textMuted, fontSize: 12 } }}
                >
                  <TableCell>{row.playerName}</TableCell>
                  <TableCell>{row.teamSlug}</TableCell>
                  <TableCell>{row.startDate}</TableCell>
                  <TableCell>{row.endDate ?? "—"}</TableCell>
                  <TableCell align="right">{row.ppg != null ? row.ppg.toFixed(1) : "—"}</TableCell>
                  <TableCell sx={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.notes}>
                    {row.notes || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ mt: 1, fontSize: 11, color: CHART_THEME.textDim }}>
        Star = 20+ PPG in 2024-25. Injuries from 2023-24 season; only spells lasting more than 30 days.
      </Box>
    </Paper>
  );
}
