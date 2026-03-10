import NBATravelMap from "./components/NbaTravelMap";
import NBATravelMap_v2 from "./components/NbaTravelMap_v2";
import NBATravelMap_v3 from "./components/NbaTravelMap_v3";
import FatigueIndexInjuryChart from "./components/FatigueIndexInjuryChart";
import FatigueScatterPlot from "./components/FatigueScatterPlot";
import StarPlayerInjuryTable from "./components/StarPlayerInjuryTable";

const PAGE_THEME = {
  fontFamily: "'IBM Plex Mono','Courier New',monospace",
  bgPage: "#0f172a",
  border: "#1e293b",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#64748b",
};

function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: PAGE_THEME.bgPage,
        fontFamily: PAGE_THEME.fontFamily,
        color: PAGE_THEME.textMuted,
        padding: "32px 24px 48px",
      }}
    >
      {/* Title */}
      <h1
        style={{
          margin: "0 0 24px 0",
          fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
          fontWeight: 700,
          color: PAGE_THEME.text,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          textAlign: "center",
        }}
      >
        Fatigue From the NBA Schedule Affecting Team Performance & Injuries
      </h1>

      {/* Hero image */}
      <img
        src="/images/StephCurryFatigueImage.png"
        alt="Stephen Curry showing fatigue on court"
        style={{
          display: "block",
          maxWidth: "100%",
          width: 720,
          height: "auto",
          borderRadius: 8,
          border: `1px solid ${PAGE_THEME.border}`,
          margin: "0 auto 24px",
        }}
      />

      {/* Intro */}
      <p
        style={{
          margin: "0 auto 40px",
          maxWidth: 820,
          fontSize: 15,
          lineHeight: 1.65,
          color: PAGE_THEME.textMuted,
          textAlign: "center",
        }}
      >
        The NBA regular season is among the most physically demanding schedules in professional sports. Teams play 82 games over roughly six months, frequently crossing multiple time zones, logging thousands of air miles, and returning to action with fewer than 24 hours of rest between games. Despite the common understanding of this &quot;grind,&quot; easy-to-understand data-driven analysis of how travel fatigue measurably impacts on-court performance remains sparse in public discourse. This project aims to fill that gap.
        <br />
        <br />
        The central story we want to tell is one of hidden competitive disadvantages. By combining team travel data with official performance metrics, we will visually show that the impact of fatigue caused by short rest windows, long travel distances, and disruptive time-zone crossings has a meaningful relationship with team efficiency. We will be measuring this through Net Rating (NetRtg), Offensive Rating (ORtg), and Defensive Rating (DRtg). These ratings are basically an advanced statistic measuring a team&apos;s efficiency by calculating the number of points scored (or allowed) per 100 possessions. We will additionally investigate whether elevated fatigue correlates with sudden drops in player availability, acting as a proxy for soft injury risk. 
      </p>
      {/* Star player injury table — 2024-25 */}
      <StarPlayerInjuryTable />
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto 40px",
          fontSize: 14,
          lineHeight: 1.6,
          color: PAGE_THEME.textMuted,
        }}
      >
        <p style={{ margin: 0 }}>
          A lot of superstars players were injured for a significant amount of time in the 2023-24 season with a majority of them having season ending injuries. These were signs that the NBA schedule is taking a toll on the players and affecting the quality of the product.ç
        </p>
      </div>
      {/* Visualizations */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <NBATravelMap_v3 />
        <div
          style={{
            maxWidth: 820,
            fontSize: 14,
            lineHeight: 1.6,
            color: PAGE_THEME.textMuted,
          }}
        >
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: 16,
              fontWeight: 700,
              color: PAGE_THEME.text,
              letterSpacing: "-0.01em",
            }}
          >
            Travel map — description
          </h3>
          <p style={{ margin: 0 }}>
            This map shows each team&apos;s road travel as arcs between game locations over a full season. Each arc is one leg of the schedule (from the previous game city to the next). Arc color indicates fatigue level (blue = low, yellow = moderate, red = high) and line thickness reflects travel distance in miles. You can see how back-to-backs, long flights, and time-zone jumps add up over the year.
          </p>
          <h3
            style={{
              margin: "16px 0 8px 0",
              fontSize: 16,
              fontWeight: 700,
              color: PAGE_THEME.text,
              letterSpacing: "-0.01em",
            }}
          >
            How to use
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><strong>Season</strong> — Choose which NBA season to view (e.g. 2023-24).</li>
            <li><strong>Team</strong> — Select a team to show only that team&apos;s travel arcs.</li>
            <li><strong>Game date slider</strong> — Move the slider or use <strong>▶ Play</strong> to reveal the schedule chronologically; <strong>↩ Reset</strong> returns to the start of the season.</li>
            <li><strong>Hover</strong> over an arc to see game details (opponent, rest, fatigue, net rating).</li>
            <li><strong>👥 Roster</strong> — Toggle to view top players for the selected team.</li>
          </ul>
        </div>
        <FatigueIndexInjuryChart />
        <div
          style={{
            maxWidth: 820,
            fontSize: 14,
            lineHeight: 1.6,
            color: PAGE_THEME.textMuted,
          }}
        >
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: 16,
              fontWeight: 700,
              color: PAGE_THEME.text,
              letterSpacing: "-0.01em",
            }}
          >
            Fatigue index by game — description
          </h3>
          <p style={{ margin: 0 }}>
            This chart shows how a team&apos;s fatigue index changes across the season (game 1 through 82). The line tracks the composite fatigue score for each game based on rest, travel distance, and time-zone strain. The shaded area under the line is colored by how many players were out (injured) for that game—green when below the league average for the season, yellow at the league average, and red when above. The red band highlights the worst 5-game stretch by average fatigue. Use the Season and Team dropdowns to compare different years and teams; the table lists average fatigue index for all teams in the selected season.
          </p>
        </div>
        <FatigueScatterPlot />
      </div>
    </div>
  );
}

export default App;