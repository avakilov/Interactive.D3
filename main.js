// main.js

let fullData = [];
let leaguesAll = [];
let colorScale;

// current filter state
let currentLeague = "All";
let currentTeam = "All";
let currentMetric = "runs"; // "runs", "batting", "pitching"

const tooltip = d3.select("#tooltip");

// ----------------------------------------------------
// Load data
// ----------------------------------------------------
d3.csv("Teams.csv", d3.autoType).then(data => {
  // modern era + valid stats
  fullData = data.filter(d => d.yearID >= 1960 && d.G && d.R && d.W);

  fullData.forEach(d => {
    d.runsPerGame = d.R / d.G;
    d.battingPerGame = d.H / d.G;      // hits per game as batting metric
    // RA is runs allowed; if not present, you can change this to ER or similar
    d.pitchingPerGame = d.RA ? d.RA / d.G : d.ER / d.G; 
  });

  // league list + color scale
  leaguesAll = Array.from(new Set(fullData.map(d => d.lgID))).sort();
  colorScale = d3.scaleOrdinal()
    .domain(leaguesAll)
    .range(d3.schemeTableau10);

  setupLeagueFilter();
  setupTeamFilter();
  setupLineSlider();
  setupMetricControls();

  updateLine();
});

// ----------------------------------------------------
// Helper: current filtered base (by league only)
// ----------------------------------------------------
function getLeagueFilteredData() {
  if (currentLeague === "All") return fullData;
  return fullData.filter(d => d.lgID === currentLeague);
}

// ----------------------------------------------------
// League & Team filters
// ----------------------------------------------------
function setupLeagueFilter() {
  const select = document.getElementById("leagueFilter");

  leaguesAll.forEach(lg => {
    const opt = document.createElement("option");
    opt.value = lg;
    opt.textContent = lg;
    select.appendChild(opt);
  });

  select.onchange = () => {
    currentLeague = select.value;
    setupTeamFilter(); // rebuild team list for this league
    updateLine();
  };
}

function setupTeamFilter() {
  const select = document.getElementById("teamFilter");
  const base = getLeagueFilteredData();

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

// ----------------------------------------------------
// Metric controls
// ----------------------------------------------------
function setupMetricControls() {
  const radios = document.querySelectorAll('input[name="metric"]');
  radios.forEach(r => {
    r.onchange = () => {
      if (r.checked) {
        currentMetric = r.value;
        updateLine();
      }
    };
  });
}

// ----------------------------------------------------
// Slider
// ----------------------------------------------------
function setupLineSlider() {
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

  minInput.oninput = updateLine;
  maxInput.oninput = updateLine;
}

// ----------------------------------------------------
// Utility: get metric value + labels
// ----------------------------------------------------
function metricValue(d) {
  if (currentMetric === "batting") return d.battingPerGame;
  if (currentMetric === "pitching") return d.pitchingPerGame;
  return d.runsPerGame; // default runs
}

function metricAxisLabel() {
  if (currentMetric === "batting") return "Avg Hits per Game";
  if (currentMetric === "pitching") return "Avg Runs Allowed per Game";
  return "Avg Runs per Game";
}

function metricChartTitle() {
  if (currentMetric === "batting") return "League-Average Hits per Game by Year";
  if (currentMetric === "pitching") return "League-Average Runs Allowed per Game by Year";
  return "League-Average Runs per Game by Year";
}

function metricTooltipLabel() {
  if (currentMetric === "batting") return "Hits/game";
  if (currentMetric === "pitching") return "Runs allowed/game";
  return "Runs/game";
}

// ----------------------------------------------------
// Line chart
// ----------------------------------------------------
function updateLine() {
  const minY = +document.getElementById("lineYearMin").value;
  const maxY = +document.getElementById("lineYearMax").value;
  document.getElementById("lineYearLabel").textContent = `${minY} – ${maxY}`;

  document.getElementById("lineChartTitle").textContent = metricChartTitle();

  const base = getLeagueFilteredData();
  const subset = base.filter(d => d.yearID >= minY && d.yearID <= maxY);

  d3.select("#linechart").selectAll("*").remove();
  drawLine(subset);
}

function drawLine(data) {
  const svg = d3.select("#linechart");
  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;
  const margin = { top: 30, right: 140, bottom: 50, left: 60 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
               .attr("transform", `translate(${margin.left},${margin.top})`);

  if (!data.length) return;

  // League-average per year (for current metric)
  const byYear = d3.rollup(
    data,
    v => d3.mean(v, d => metricValue(d)),
    d => d.yearID
  );

  const leagueSeries = Array.from(byYear, ([year, value]) => ({
    year: +year,
    value
  })).sort((a, b) => a.year - b.year);

  const allYears = leagueSeries.map(d => d.year);
  const allVals = leagueSeries.map(d => d.value);

  // Optional team series
  let teamSeries = [];
  if (currentTeam !== "All") {
    const teamData = data.filter(d => d.name === currentTeam);
    const teamByYear = d3.rollup(
      teamData,
      v => d3.mean(v, d => metricValue(d)),
      d => d.yearID
    );
    teamSeries = Array.from(teamByYear, ([year, value]) => ({
      year: +year,
      value
    })).sort((a, b) => a.year - b.year);

    teamSeries.forEach(d => {
      allYears.push(d.year);
      allVals.push(d.value);
    });
  }

  const x = d3.scaleLinear()
              .domain(d3.extent(allYears))
              .range([0, innerWidth]);

  const y = d3.scaleLinear()
              .domain(d3.extent(allVals)).nice()
              .range([innerHeight, 0]);

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
    .text(metricAxisLabel());

  const lineGen = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.value));

  // League line (blue)
  const leaguePath = g.append("path")
    .datum(leagueSeries)
    .attr("fill", "none")
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 2)
    .attr("d", lineGen);

  const totalLength = leaguePath.node().getTotalLength();
  leaguePath
    .attr("stroke-dasharray", totalLength + " " + totalLength)
    .attr("stroke-dashoffset", totalLength)
    .transition()
    .duration(800)
    .attr("stroke-dashoffset", 0);

  // League points
  g.selectAll("circle.league-point")
    .data(leagueSeries)
    .join("circle")
    .attr("class", "league-point")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.value))
    .attr("r", 3)
    .attr("fill", "#1f77b4")
    .on("mouseover", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Year: ${d.year}<br/>League avg ${metricTooltipLabel()}: ${d.value.toFixed(2)}`
        );
    })
    .on("mousemove", event => {
      tooltip
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  // Team line (red), if selected
  if (teamSeries.length) {
    const teamPath = g.append("path")
      .datum(teamSeries)
      .attr("fill", "none")
      .attr("stroke", "#e53935")
      .attr("stroke-width", 2)
      .attr("d", lineGen);

    const lenTeam = teamPath.node().getTotalLength();
    teamPath
      .attr("stroke-dasharray", lenTeam + " " + lenTeam)
      .attr("stroke-dashoffset", lenTeam)
      .transition()
      .duration(800)
      .attr("stroke-dashoffset", 0);

    g.selectAll("circle.team-point")
      .data(teamSeries)
      .join("circle")
      .attr("class", "team-point")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.value))
      .attr("r", 3.5)
      .attr("fill", "#e53935")
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${currentTeam}</strong><br/>
             Year: ${d.year}<br/>
             ${metricTooltipLabel()}: ${d.value.toFixed(2)}`
          );
      })
      .on("mousemove", event => {
        tooltip
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  }

  // Legend (League vs Team)
  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${innerWidth + 20}, 10)`);

  legend.append("text")
    .text("Lines")
    .attr("font-weight", "600")
    .attr("y", 0);

  const row1 = legend.append("g")
    .attr("transform", "translate(0, 15)");
  row1.append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", "#1f77b4");
  row1.append("text")
    .attr("x", 18)
    .attr("y", 10)
    .text("League average");

  const row2 = legend.append("g")
    .attr("transform", "translate(0, 33)");
  row2.append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", "#e53935");
  row2.append("text")
    .attr("x", 18)
    .attr("y", 10)
    .text(currentTeam === "All" ? "Selected team" : currentTeam);
}
