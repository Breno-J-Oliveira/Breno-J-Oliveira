import { graphql } from "@octokit/graphql";
import { writeFileSync, mkdirSync, existsSync } from "fs";

const USERNAME = "Breno-J-Oliveira";

// Galaxy Dark Luxury Colors
const COLORS = {
  bg: "#0d0d0d",
  panelBg: "#050816",
  empty: "#161b22",
  levels: ["#0d0d0d", "#003d4d", "#007a8c", "#00b8cc", "#00f5ff"],
  snake: "#b44fff",
  snakeGlow: "#b44fff",
  jet: "#ffd700",
  jetTrail: "#00f5ff",
  text: "#a0a0b0",
  textMuted: "#505060",
  cyan: "#00f5ff",
  purple: "#b44fff",
  gold: "#ffd700",
  border: "#00f5ff",
};

const CELL = 12;
const GAP = 3;
const SIZE = CELL + GAP;
const WEEKS = 52;
const DAYS = 7;
const PADDING = 30;
const JET_AREA = 80;

const WIDTH = PADDING * 2 + WEEKS * SIZE;
const HEIGHT = PADDING * 2 + DAYS * SIZE + JET_AREA;

async function fetchContributions() {
  const query = `
    query ($username: String!) {
      user(login: $username) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
                date
                color
              }
            }
          }
        }
      }
    }
  `;

  const { user } = await graphql(query, {
    username: USERNAME,
    headers: { authorization: `token ${process.env.GITHUB_TOKEN}` },
  });

  return user.contributionsCollection.contributionCalendar.weeks;
}

function getLevel(count) {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

function generateSVG(weeks) {
  const cells = [];
  let totalContributions = 0;

  weeks.forEach((week, wi) => {
    week.contributionDays.forEach((day, di) => {
      const count = day.contributionCount;
      totalContributions += count;
      const level = getLevel(count);
      const x = PADDING + wi * SIZE;
      const y = PADDING + di * SIZE;
      cells.push({ x, y, level, count, date: day.date });
    });
  });

  // Jet path - follows the top of the contribution graph
  const jetPath = [];
  for (let wi = 0; wi < weeks.length; wi++) {
    const week = weeks[wi];
    let minDay = 6;
    week.contributionDays.forEach((day, di) => {
      if (day.contributionCount > 0 && di < minDay) minDay = di;
    });
    const x = PADDING + wi * SIZE + CELL / 2;
    const y = PADDING + minDay * SIZE - 15;
    jetPath.push({ x, y });
  }

  // Generate jet path as smooth curve
  let pathD = "";
  if (jetPath.length > 0) {
    pathD = `M ${jetPath[0].x} ${jetPath[0].y}`;
    for (let i = 1; i < jetPath.length; i++) {
      const prev = jetPath[i - 1];
      const curr = jetPath[i];
      const cpx = (prev.x + curr.x) / 2;
      pathD += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`;
    }
  }

  const cellRects = cells
    .map(
      (c) =>
        `<rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" rx="2" fill="${COLORS.levels[c.level]}" opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${0.5 + (c.x / WIDTH) * 2}s" fill="freeze"/>
        </rect>`
    )
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.bg}"/>
      <stop offset="100%" stop-color="${COLORS.panelBg}"/>
    </linearGradient>
    <linearGradient id="jetGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${COLORS.gold}"/>
      <stop offset="100%" stop-color="${COLORS.cyan}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="jetGlow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <linearGradient id="trailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${COLORS.jetTrail}" stop-opacity="0"/>
      <stop offset="80%" stop-color="${COLORS.jetTrail}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${COLORS.gold}" stop-opacity="1"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bgGrad)" rx="12"/>
  <rect x="1" y="1" width="${WIDTH - 2}" height="${HEIGHT - 2}" rx="12" fill="none" stroke="${COLORS.border}" stroke-width="1" opacity="0.15"/>

  <!-- Title -->
  <text x="${WIDTH / 2}" y="20" text-anchor="middle" font-family="JetBrains Mono, Courier New, monospace" font-size="11" fill="${COLORS.textMuted}">contributions · ${USERNAME} · ${new Date().getFullYear()}</text>

  <!-- Contribution cells -->
  <g>
    ${cellRects}
  </g>

  <!-- Jet trail -->
  <path d="${pathD}" fill="none" stroke="url(#trailGrad)" stroke-width="3" stroke-linecap="round" opacity="0.5" filter="url(#glow)">
    <animate attributeName="stroke-dashoffset" from="2000" to="0" dur="3s" begin="2s" fill="freeze"/>
    <animate attributeName="stroke-dasharray" from="0 2000" to="2000 0" dur="3s" begin="2s" fill="freeze"/>
  </path>

  <!-- Jet / Rocket -->
  ${
    jetPath.length > 0
      ? `<g filter="url(#jetGlow)">
    <polygon points="${jetPath[jetPath.length - 1].x},${jetPath[jetPath.length - 1].y - 8} ${jetPath[jetPath.length - 1].x + 14},${jetPath[jetPath.length - 1].y} ${jetPath[jetPath.length - 1].x},${jetPath[jetPath.length - 1].y + 8}" fill="${COLORS.gold}">
      <animateMotion path="${pathD}" dur="3s" begin="2s" fill="freeze" rotate="auto"/>
    </polygon>
  </g>`
      : ""
  }

  <!-- Stats -->
  <text x="${WIDTH / 2}" y="${HEIGHT - 10}" text-anchor="middle" font-family="JetBrains Mono, Courier New, monospace" font-size="10" fill="${COLORS.textMuted}">
    ${totalContributions} contributions this year
  </text>
</svg>`;
}

async function main() {
  console.log(`Fetching contributions for ${USERNAME}...`);
  const weeks = await fetchContributions();
  console.log(`Got ${weeks.length} weeks of data.`);

  const svg = generateSVG(weeks);

  if (!existsSync("dist")) {
    mkdirSync("dist", { recursive: true });
  }

  writeFileSync("dist/github-jet.svg", svg);
  console.log("Generated dist/github-jet.svg");
}

main().catch(console.error);