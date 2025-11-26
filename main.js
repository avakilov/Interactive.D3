let dataAll = [];
let currentLeague = "AL";
let currentTeam = "All";
let metricMode = "both";
let yearMax = 2015;

const tooltip = d3.select("#tooltip");

// -------------------------------------------------------
// Load Data
// -------------------------------------------------------
d3.csv("Teams.csv", d3.autoType).then(data => {
  dataAll = data.filter(d =>
    d.yearID >= 1960 &&
    d.yearID <= 2015 &&
    d.G && d.R && d.H
  );

  dataAll.forEach(d => {
    d.rpg = d.R / d.G;
    d.hpg = d.H / d.G;
  });

  setupControls();
  populateTeams();
  drawChart();
});

// -------------------------------------------------------
// Controls
// -------------------------------------------------------
function setupControls() {

  d3.select("#leagueFilter").on("change", function () {
    currentLeague = this.value;
    populateTeams();
    drawChart();
  });

  d3.select("#teamFilter").on("change", function () {
    currentTeam = this.value;
    drawChart();
  });

  d3.select("#metricSelector").on("change", function () {
    metricMode = this.value;
    drawChart();
  });

  d3.select("#yearSlider").on("input", function () {
    yearMax = +this.value;
    document.getElementById("yearLabel").textContent = `1960–${yearMax}`;
    drawChart();
  });
}

// -------------------------------------------------------
// Populate Team List
// -------------------------------------------------------
function populateTeams() {
  const teams = [...new Set(
    dataAll.filter(d => d.lgID === currentLeague).map(d => d.name)
  )].sort();

  const dropdown = d3.select("#teamFilter");
  dropdown.html("");

  dropdown.append("option").attr("value", "All").text("All Teams");
  teams.forEach(team => dropdown.append("option").attr("value", team).text(team));

  currentTeam = "All";
}

// -------------------------------------------------------
// Draw Line Chart
// -------------------------------------------------------
function drawChart() {
  const svg = d3.select("#linechart");
  svg.selectAll("*").remove();

  const margin = { top: 30, right: 130, bottom: 50, left: 60 };
  const width = svg.node().clientWidth - margin.left - margin.right;
  const height = svg.node().clientHeight - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const filtered = dataAll.filter(
    d => d.lgID === currentLeague && d.yearID <= yearMax
  );

  // Build league average series
  const leagueRuns = d3.rollups(
    filtered,
    v => d3.mean(v, d => d.rpg),
    d => d.yearID
  ).map(d => ({ year: d[0], value: d[1] }));

  const leagueHits = d3.rollups(
    filtered,
    v => d3.mean(v, d => d.hpg),
    d => d.yearID
  ).map(d => ({ year: d[0], value: d[1] }));

  leagueRuns.sort((a,b)=>a.year-b.year);
  leagueHits.sort((a,b)=>a.year-b.year);

  let teamRuns = [];
  let teamHits = [];

  if (currentTeam !== "All") {
    const teamData = filtered.filter(d => d.name === currentTeam);

    teamRuns = d3.rollups(
      teamData,
      v => d3.mean(v, d => d.rpg),
      d => d.yearID
    ).map(d => ({ year: d[0], value: d[1] }));

    teamHits = d3.rollups(
      teamData,
      v => d3.mean(v, d => d.hpg),
      d => d.yearID
    ).map(d => ({ year: d[0], value: d[1] }));

    teamRuns.sort((a,b)=>a.year-b.year);
    teamHits.sort((a,b)=>a.year-b.year);
  }

  // X and Y
  const x = d3.scaleLinear()
    .domain([1960, yearMax])
    .range([0, width]);

  const allValues = [
    ...leagueRuns.map(d=>d.value),
    ...leagueHits.map(d=>d.value),
    ...teamRuns.map(d=>d.value),
    ...teamHits.map(d=>d.value)
  ];

  const y = d3.scaleLinear()
    .domain(d3.extent(allValues)).nice()
    .range([height, 0]);

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  g.append("g").call(d3.axisLeft(y));

  // Labels
  g.append("text")
    .attr("x", width/2)
    .attr("y", height+40)
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height/2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text("Value per Game");

  const line = d3.line()
    .x(d=>x(d.year))
    .y(d=>y(d.value));

  // ----------------------------------------------------------
  // Draw League Lines
  // ----------------------------------------------------------

  if (metricMode !== "hits") {
    g.append("path")
      .datum(leagueRuns)
      .attr("fill","none")
      .attr("stroke","#1f77b4")
      .attr("stroke-width",2)
      .attr("d",line);
  }

  if (metricMode !== "runs") {
    g.append("path")
      .datum(leagueHits)
      .attr("fill","none")
      .attr("stroke","#d62728")
      .attr("stroke-width",2)
      .attr("d",line);
  }

  // ----------------------------------------------------------
  // Team Lines
  // ----------------------------------------------------------

  if (currentTeam !== "All") {
    if (metricMode !== "hits") {
      g.append("path")
        .datum(teamRuns)
        .attr("fill","none")
        .attr("stroke","orange")
        .attr("stroke-width",2)
        .attr("d",line);
    }

    if (metricMode !== "runs") {
      g.append("path")
        .datum(teamHits)
        .attr("fill","none")
        .attr("stroke","orange")
        .attr("stroke-width",2)
        .style("stroke-dasharray","4 2")
        .attr("d",line);
    }
  }

  // ----------------------------------------------------------
  // Legend
  // ----------------------------------------------------------
  const legend = g.append("g")
    .attr("transform", `translate(${width + 20}, 20)`);

  let yOffset = 0;

  if (metricMode !== "hits") {
    legend.append("rect").attr("width",12).attr("height",12).attr("fill","#1f77b4")
      .attr("y", yOffset);
    legend.append("text").attr("x",18).attr("y",yOffset+10)
      .text("League Runs/Game");
    yOffset += 18;
  }

  if (metricMode !== "runs") {
    legend.append("rect").attr("width",12).attr("height",12).attr("fill","#d62728")
      .attr("y", yOffset);
    legend.append("text").attr("x",18).attr("y",yOffset+10)
      .text("League Hits/Game");
    yOffset += 18;
  }

  if (currentTeam !== "All") {
    legend.append("rect").attr("width",12).attr("height",12).attr("fill","orange")
      .attr("y", yOffset);
    legend.append("text").attr("x",18).attr("y",yOffset+10)
      .text(`${currentTeam} (Team)`);
  }
}
