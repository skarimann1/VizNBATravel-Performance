import NBATravelMap_v3 from "./components/NbaTravelMap_v3";
import FatigueIndexInjuryChart from "./components/FatigueIndexInjuryChart";
import FatigueScatterPlot from "./components/FatigueScatterPlot";
import StarPlayerInjuryTable from "./components/StarPlayerInjuryTable";

const PAGE_THEME = {
  fontFamily: "'IBM Plex Mono','Courier New',monospace",
  bgPage: "#1c2331",
  border: "#1e293b",
  text: "#e2e8f0",
  textMuted: "#f1f1f1",
  textDim: "#e4e4e4",
  accent: "#3b82f6",
  accentDim: "#1e3a5f",
};

function FatigueIndexExplainer() {
  const boxStyle: React.CSSProperties = {
    background: "#111827",
    border: `1px solid #2d3748`,
    borderRadius: 8,
    padding: "20px 24px",
    marginBottom: 12,
  };

  const labelStyle: React.CSSProperties = {
    display: "inline-block",
    background: PAGE_THEME.accentDim,
    color: PAGE_THEME.accent,
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.05em",
    marginBottom: 6,
  };

  const equationStyle: React.CSSProperties = {
    display: "block",
    margin: "16px 0",
    padding: "12px 16px",
    background: "#0f172a",
    borderLeft: `3px solid ${PAGE_THEME.accent}`,
    borderRadius: "0 4px 4px 0",
    fontSize: 14,
    color: PAGE_THEME.text,
    letterSpacing: "0.03em",
    fontFamily: "'IBM Plex Mono','Courier New',monospace",
  };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto 40px" }}>
      <h2
        style={{
          margin: "0 0 6px 0",
          fontSize: 20,
          fontWeight: 700,
          color: PAGE_THEME.text,
          letterSpacing: "-0.01em",
        }}
      >
        How the Fatigue Index Works
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: PAGE_THEME.textDim, lineHeight: 1.6 }}>
        Every game in the dataset is assigned a composite <strong style={{ color: PAGE_THEME.text }}>Fatigue Index (FI)</strong> — a single score from 0 (fully rested, no travel) to 100 (maximum observed fatigue). It combines three physiological stress factors, each normalized to [0, 1] before being weighted and summed.
      </p>

      {/* Equation */}
      <code style={equationStyle}>
        FI = 100 × ( w₁·f(Rest) + w₂·f(Miles) + w₃·f(TZ) )
      </code>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: PAGE_THEME.textDim, lineHeight: 1.5 }}>
        where <strong style={{ color: PAGE_THEME.text }}>w₁ + w₂ + w₃ = 1</strong> (default: equal thirds, i.e. ⅓ each). Weights are user-adjustable in the scatter plot below.
      </p>

      {/* Three components */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={boxStyle}>
          <span style={labelStyle}>f(Rest) — Rest Fatigue</span>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: PAGE_THEME.textMuted }}>
            An <strong style={{ color: PAGE_THEME.text }}>inverse function of hours since the last game</strong>. Games played with fewer than 24 hours of rest receive maximum rest fatigue (f = 1); fatigue decays toward zero once a team has had roughly 72 hours off. This mirrors the physiological recovery window needed for muscle repair and sleep debt repayment.
          </p>
        </div>

        <div style={boxStyle}>
          <span style={labelStyle}>f(Miles) — Travel Distance</span>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: PAGE_THEME.textMuted }}>
            A <strong style={{ color: PAGE_THEME.text }}>log-scaled measure of cumulative miles traveled over the past 7 days</strong> (calculated via geodesic distance between arena coordinates). The logarithmic scale prevents a single very long flight from trivially dominating the index while still capturing the extra strain of multi-leg cross-country road trips.
          </p>
        </div>

        <div style={boxStyle}>
          <span style={labelStyle}>f(TZ) — Time-Zone Disruption</span>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: PAGE_THEME.textMuted }}>
            A penalty based on the <strong style={{ color: PAGE_THEME.text }}>number of time zones crossed per trip leg</strong>, with an additional directional penalty applied to <strong style={{ color: PAGE_THEME.text }}>west-to-east travel</strong>. Research in chronobiology shows that eastward travel phase-advances the internal clock, which is harder for the body to accommodate than the phase delay caused by traveling west — so a flight from LA to Miami carries a higher TZ cost than the reverse.
          </p>
        </div>
      </div>

      <p style={{ margin: "16px 0 0", fontSize: 13, color: PAGE_THEME.textDim, lineHeight: 1.6 }}>
        Two control variables — <strong style={{ color: PAGE_THEME.text }}>rolling opponent Net Rating</strong> (strength of schedule) and <strong style={{ color: PAGE_THEME.text }}>home/away status</strong> — are included in the regression models to ensure that observed fatigue effects are not simply reflecting opponent quality or home-court advantage.
      </p>
    </div>
  );
}

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
          A lot of superstars players were injured for a significant amount of time in the 2023-24 season with a majority of them having season ending injuries. These were signs that the NBA schedule is taking a toll on the players and affecting the quality of the product.
        </p>
      </div>

      {/* Fatigue Index Explainer */}
      <FatigueIndexExplainer />

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
            Fatigue vs. performance scatter plot — description
          </h3>
          <p style={{ margin: 0 }}>
            Each point in this chart represents a single team-game observation. The horizontal axis shows the composite Fatigue Index for that game; the vertical axis shows team performance (Net Rating, Offensive Rating, or Defensive Rating). A LOESS regression curve shows the overall trend across all games, making it easy to see whether higher fatigue consistently predicts worse performance. Use the team and season filters to focus on a specific context, or view the full league to see the aggregate relationship.
          </p>
         
        </div>
      </div>
    </div>
  );
}

export default App;