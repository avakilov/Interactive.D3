// main.js

let fullData = [];
let currentLeague = "AL";
let currentTeam = "All";
let metricMode = "both"; // "both", "runs", or "hits"

const tooltip = d3.select("#tooltip");

// ----------------------------------------------------
// Load data
// ----------------------------------------------------
d3.csv("Teams.csv", d3.autoType).then(data => {
  // Filter to modern era and valid stats
  fullData = data.filter(d =>
    d.yearID >= 1960 &&
    d.yearID <= 2015 &&
    d.G && d.R && d.H &&
    (d.lgID === "AL" || d.lgID === "NL")
  );

  // Precompute per-game metrics
  fullData.forEach(d => {
    d.rpg = d.R / d.G; // runs per game
    d.hpg = d.H / d.G; // hits per game
  });

  setupLeagueFilter();
  setupTeamFilter();
  setupMetricControls();
  setupYearSliders();

  updateLine();
});

// ----------------------------------------------------
// Filters and controls
// ----------------------------------------------------
function setupLeagueFilter() {
  const select = document.getElementById("leagueFilter");
  select.value = currentLeague;
  select.onchange = () => {
    currentLeague = select.value;
    setupTeamFilter();
    updateLine();
  };
}

function setupTeamFilter() {
  const select = document.getElementById("teamFilter");
  const base = fullData.filter(d => d.lgID === currentLeague);
  const teams = Array.from(new Set(base.map(d => d.name))).sort();

  select.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "All";
  optAll.textContent = "All teams";
  select.appendChild(optAll);

  teams.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });

  currentTeam = "All";
  select.onchange = () => {
    currentTeam = select.value;
    updateLine();
  };
}

function setupMetricControls() {
  document.querySelectorAll('input[name="metric"]').forEach(radio => {
    radio.onchange = () => {
      if (radio.checked) {
        metricMode = radio.value;
        updateLine();
      }
    };
  });
}

function setupYearSliders() {
  const minYear = d3.min(fullData, d => d.yearID);
  const maxYear = d3.max(fullData, d => d.yearID);

  const minInput = document.getElementById("lineYearMin");
  const maxInput = document.getElementById("lineYearMax");

  minInput.min = minYear;
  minInput.max = maxYear;
  maxInput.min = minYear;
  maxInput.max = maxYear;

  minInput.value = minYear;
  maxInput.value = maxYear;

  const onChange = () => {
    let lo = +minInput.value;
    let hi = +maxInput.value;
    if (lo > hi) {
      // keep them ordered
      [lo, hi] = [hi, lo];
      minInput.value = lo;
      maxInput.value = hi;
    }
    document.getElementById("lineYearLabel").textContent = `${lo} – ${hi}`;
    updateLine();
  };

  minInput.oninput = onChange;
  maxInput.oninput = onChange;

  // Initialize label
  document.getElementById("lineYearLabel").textContent = `${minYear} – ${maxYear}`;
}

// ----------------------------------------------------
// Line chart update
// ----------------------------------------------------
function updateLine() {
  const minY = +document.getElementById("lineYearMin").value;
  const maxY = +document.getElementById("lineYearMax").value;

  const base = fullData.filter(
    d => d.lgID === currentLeague && d.yearID >= minY && d.yearID <= maxY
  );

  d3.select("#linechart").selectAll("*").remove();
  drawLine(base, minY, maxY);
}

function drawLine(data, minYear, maxYear) {
  const svg = d3.select("#linechart");
  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;
  const margin = { top: 30, right: 150, bottom: 50, left: 60 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
               .attr("transform", `translate(${margin.left},${margin.top})`);

  if (!data.length) return;

  // League-average series
  const leagueRuns = d3.rollups(
    data,
    v => d3.mean(v, d => d.rpg),
    d => d.yearID
  ).map(([year, value]) => ({ year: +year, value }))
   .sort((a, b) => a.year - b.year);

  const leagueHits = d3.rollups(
    data,
    v => d3.mean(v, d => d.hpg),
    d => d.yearID
  ).map(([year, value]) => ({ year: +year, value }))
   .sort((a, b) => a.year - b.year);

  // Optional team series
  let teamRuns = [];
  let teamHits = [];
  if (currentTeam !== "All") {
    const teamData = data.filter(d => d.name === currentTeam);

    teamRuns = d3.rollups(
      teamData,
      v => d3.mean(v, d => d.rpg),
      d => d.yearID
    ).map(([year, value]) => ({ year: +year, value }))
     .sort((a, b) => a.year - b.year);

    teamHits = d3.rollups(
      teamData,
      v => d3.mean(v, d => d.hpg),
      d => d.yearID
    ).map(([year, value]) => ({ year: +year, value }))
     .sort((a, b) => a.year - b.year);
  }

  const x = d3.scaleLinear()
              .domain([minYear, maxYear])
              .range([0, innerWidth]);

  const yValues = [];
  if (metricMode !== "hits") {
    yValues.push(...leagueRuns.map(d => d.value), ...teamRuns.map(d => d.value));
  }
  if (metricMode !== "runs") {
    yValues.push(...leagueHits.map(d => d.value), ...teamHits.map(d => d.value));
  }

  const y = d3.scaleLinear()
              .domain(d3.extent(yValues)).nice()
              .range([innerHeight, 0]);

  // Axes
  g.append("g")
   .attr("transform", `translate(0,${innerHeight})`)
   .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  g.append("g").call(d3.axisLeft(y));

  g.append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text("Value per Game");

  // Chart title
  let title = "League-Average ";
  if (metricMode === "runs") title += "Runs per Game by Year";
  else if (metricMode === "hits") title += "Hits per Game by Year";
  else title += "Runs and Hits per Game by Year";
  document.getElementById("lineChartTitle").textContent = title;

  const lineGen = d3.line()
                    .x(d => x(d.year))
                    .y(d => y(d.value));

  // League lines
  if (metricMode !== "hits") {
    g.append("path")
      .datum(leagueRuns)
      .attr("fill", "none")
      .attr("stroke", "#1f77b4")
      .attr("stroke-width", 2)
      .attr("d", lineGen);

    // league runs dots
    g.selectAll(".league-runs-dot")
      .data(leagueRuns)
      .join("circle")
      .attr("class", "league-runs-dot")
      .attr("r", 3)
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.value))
      .attr("fill", "#1f77b4")
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `Year: ${d.year}<br/>League runs/game: ${d.value.toFixed(2)}<br/>League: ${currentLeague}`
          );
      })
      .on("mousemove", event => {
        tooltip
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  }

  if (metricMode !== "runs") {
    g.append("path")
      .datum(leagueHits)
      .attr("fill", "none")
      .attr("stroke", "#d62728")
      .attr("stroke-width", 2)
      .attr("d", lineGen);

    // league hits dots
    g.selectAll(".league-hits-dot")
      .data(leagueHits)
      .join("circle")
      .attr("class", "league-hits-dot")
      .attr("r", 3)
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.value))
      .attr("fill", "#d62728")
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `Year: ${d.year}<br/>League hits/game: ${d.value.toFixed(2)}<br/>League: ${currentLeague}`
          );
      })
      .on("mousemove", event => {
        tooltip
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  }

  // Team lines (orange) if a team is selected
  if (currentTeam !== "All") {
    if (metricMode !== "hits" && teamRuns.length) {
      g.append("path")
        .datum(teamRuns)
        .attr("fill", "none")
        .attr("stroke", "orange")
        .attr("stroke-width", 2)
        .attr("d", lineGen);

      g.selectAll(".team-runs-dot")
        .data(teamRuns)
        .join("circle")
        .attr("class", "team-runs-dot")
        .attr("r", 3.5)
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.value))
        .attr("fill", "orange")
        .on("mouseover", (event, d) => {
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>${currentTeam}</strong><br/>Year: ${d.year}<br/>Runs/game: ${d.value.toFixed(
                2
              )}`
            );
        })
        .on("mousemove", event => {
          tooltip
            .style("left", event.pageX + 12 + "px")
            .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));
    }

    if (metricMode !== "runs" && teamHits.length) {
      g.append("path")
        .datum(teamHits)
        .attr("fill", "none")
        .attr("stroke", "orange")
        .attr("stroke-dasharray", "4 3")
        .attr("stroke-width", 2)
        .attr("d", lineGen);

      g.selectAll(".team-hits-dot")
        .data(teamHits)
        .join("circle")
        .attr("class", "team-hits-dot")
        .attr("r", 3.5)
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.value))
        .attr("fill", "orange")
        .on("mouseover", (event, d) => {
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>${currentTeam}</strong><br/>Year: ${d.year}<br/>Hits/game: ${d.value.toFixed(
                2
              )}`
            );
        })
        .on("mousemove", event => {
          tooltip
            .style("left", event.pageX + 12 + "px")
            .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));
    }
  }

  // Legend
  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${innerWidth + 20}, 10)`);

  let yOff = 0;

  if (metricMode !== "hits") {
    legend.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", "#1f77b4")
      .attr("y", yOff);
    legend.append("text")
      .attr("x", 18)
      .attr("y", yOff + 10)
      .text("League Runs/Game");
    yOff += 18;
  }

  if (metricMode !== "runs") {
    legend.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", "#d62728")
      .attr("y", yOff);
    legend.append("text")
      .attr("x", 18)
      .attr("y", yOff + 10)
      .text("League Hits/Game");
    yOff += 18;
  }

  if (currentTeam !== "All") {
    legend.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", "orange")
      .attr("y", yOff);
    legend.append("text")
      .attr("x", 18)
      .attr("y", yOff + 10)
      .text(currentTeam);
  }
}
