let dataAll = [];
let currentLeague = "AL";
let currentTeam = "All";
let metric = "runs";

const tooltip = d3.select("#tooltip");

// ----------------------------------
d3.csv("Teams.csv", d3.autoType).then(data => {

  dataAll = data.filter(d => d.yearID >= 1960 && d.G && d.R && d.H);

  dataAll.forEach(d => {
    d.rpg = d.R / d.G;
    d.hpg = d.H / d.G;
    d.sopg = d.SO ? d.SO / d.G : null;
  });

  setupControls();
  populateTeams();
  drawChart();
});

// ----------------------------------
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

  d3.selectAll("input[name='metric']").on("change", function () {
    metric = this.value;
    drawChart();
  });
}

// ----------------------------------
function populateTeams() {

  const filtered = dataAll.filter(d => d.lgID === currentLeague);
  const teams = [...new Set(filtered.map(d => d.name))].sort();

  const select = d3.select("#teamFilter");
  select.html("");

  select.append("option")
    .attr("value", "All")
    .text("All Teams");

  teams.forEach(t => {
    select.append("option").attr("value", t).text(t);
  });

  currentTeam = "All";
}

// ----------------------------------
function getMetricValue(d) {
  if (metric === "hits") return d.hpg;
  if (metric === "strikeouts") return d.sopg;
  return d.rpg;
}

// ----------------------------------
function getMetricLabel() {
  if (metric === "hits") return "Hits Per Game";
  if (metric === "strikeouts") return "Strikeouts Per Game";
  return "Runs Per Game";
}

// ----------------------------------
function drawChart() {

  const svg = d3.select("#linechart");
  svg.selectAll("*").remove();

  const margin = { top: 30, right: 150, bottom: 50, left: 60 };
  const width = svg.node().clientWidth - margin.left - margin.right;
  const height = svg.node().clientHeight - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  document.getElementById("chartTitle").textContent =
    `League-Average ${getMetricLabel()} (${currentLeague})`;

  const leagueData = dataAll.filter(d => d.lgID === currentLeague);

  const leagueAvg = d3.rollups(
    leagueData,
    v => d3.mean(v, d => getMetricValue(d)),
    d => d.yearID
  ).map(d => ({ year: d[0], value: d[1] }))
   .sort((a,b)=>a.year-b.year)
   .filter(d => d.value !== null);

  let teamSeries = [];
  if (currentTeam !== "All") {
    const teamData = leagueData.filter(d => d.name === currentTeam);
    teamSeries = d3.rollups(
      teamData,
      v => d3.mean(v, d => getMetricValue(d)),
      d => d.yearID
    ).map(d => ({ year: d[0], value: d[1] }))
     .filter(d => d.value !== null)
     .sort((a,b)=>a.year-b.year);
  }

  const x = d3.scaleLinear()
    .domain(d3.extent(leagueAvg, d => d.year))
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain(d3.extent([...leagueAvg, ...teamSeries], d => d.value))
    .nice()
    .range([height, 0]);

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  g.append("g").call(d3.axisLeft(y));

  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -45)
    .attr("x", -height / 2)
    .attr("text-anchor", "middle")
    .text(getMetricLabel());

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.value));

  const leaguePath = g.append("path")
    .datum(leagueAvg)
    .attr("fill", "none")
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 2)
    .attr("d", line);

  const len = leaguePath.node().getTotalLength();

  leaguePath
    .attr("stroke-dasharray", `${len} ${len}`)
    .attr("stroke-dashoffset", len)
    .transition()
    .duration(800)
    .attr("stroke-dashoffset", 0);

  if (teamSeries.length > 0) {
    const teamPath = g.append("path")
      .datum(teamSeries)
      .attr("fill", "none")
      .attr("stroke", "#e53935")
      .attr("stroke-width", 2)
      .attr("d", line);

    const len2 = teamPath.node().getTotalLength();

    teamPath
      .attr("stroke-dasharray", `${len2} ${len2}`)
      .attr("stroke-dashoffset", len2)
      .transition()
      .duration(800)
      .attr("stroke-dashoffset", 0);
  }

  // ----------------------------------
  // TOOLTIP dots (league)
  g.selectAll("circle.league-dot")
    .data(leagueAvg)
    .join("circle")
    .attr("class","league-dot")
    .attr("cx",d=>x(d.year))
    .attr("cy",d=>y(d.value))
    .attr("r",3)
    .attr("fill","#1f77b4")
    .on("mousemove", (e,d)=> {
      tooltip
        .style("opacity",1)
        .style("left", e.pageX+10+"px")
        .style("top", e.pageY-25+"px")
        .html(`Year: ${d.year}<br>${getMetricLabel()}: ${d.value.toFixed(2)}`);
    })
    .on("mouseout", ()=> tooltip.style("opacity",0));

  // ----------------------------------
  // Legend
  const legend = g.append("g")
    .attr("class","legend")
    .attr("transform", `translate(${width + 15}, 20)`);

  legend.append("rect").attr("width",12).attr("height",12).attr("fill","#1f77b4");
  legend.append("text").attr("x",18).attr("y",10).text("League average");

  legend.append("rect").attr("y",20).attr("width",12).attr("height",12).attr("fill","#e53935");
  legend.append("text").attr("x",18).
