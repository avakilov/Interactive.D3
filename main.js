let fullData = [];
let currentLeague = "All";
let currentTeam = "All";
let currentMetric = "runs";

const tooltip = d3.select("#tooltip");

// ------------------------------------
// Load Data
// ------------------------------------
d3.csv("Teams.csv", d3.autoType).then(data => {
  fullData = data.filter(d => d.yearID >= 1960 && d.G && d.R && d.H);

  fullData.forEach(d => {
    d.runsPerGame = d.R / d.G;
    d.battingPerGame = d.H / d.G;
    d.strikeoutsPerGame = d.SO ? d.SO / d.G : null;
  });

  setupTeamFilter();
  setupControls();
  updateLine();
});

// ------------------------------------
// Filters
// ------------------------------------
function getFilteredData() {
  let result = fullData;

  if (currentLeague !== "All") {
    result = result.filter(d => d.lgID === currentLeague);
  }

  return result;
}

function setupControls() {
  document.getElementById("leagueFilter").onchange = e => {
    currentLeague = e.target.value;
    setupTeamFilter();
    updateLine();
  };

  document.getElementById("teamFilter").onchange = e => {
    currentTeam = e.target.value;
    updateLine();
  };

  document.querySelectorAll('input[name="metric"]').forEach(radio => {
    radio.onchange = () => {
      if (radio.checked) {
        currentMetric = radio.value;
        updateLine();
      }
    };
  });
}

function setupTeamFilter() {
  const select = document.getElementById("teamFilter");
  const base = getFilteredData();

  const teams = Array.from(new Set(base.map(d => d.name))).sort();

  select.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "All";
  allOpt.textContent = "All teams";
  select.appendChild(allOpt);

  teams.forEach(team => {
    const opt = document.createElement("option");
    opt.value = team;
    opt.textContent = team;
    select.appendChild(opt);
  });

  currentTeam = "All";
}

// ------------------------------------
// Metric Helpers
// ------------------------------------
function metricValue(d) {
  if (currentMetric === "batting") return d.battingPerGame;
  if (currentMetric === "strikeouts") return d.strikeoutsPerGame;
  return d.runsPerGame;
}

function metricLabel() {
  if (currentMetric === "batting") return "Avg Hits per Game";
  if (currentMetric === "strikeouts") return "Avg Strikeouts per Game";
  return "Avg Runs per Game";
}

function titleLabel() {
  if (currentMetric === "batting") return "League-Average Hits per Game Over Time";
  if (currentMetric === "strikeouts") return "League-Average Strikeouts per Game Over Time";
  return "League-Average Runs per Game Over Time";
}

// ------------------------------------
// Draw Line Chart
// ------------------------------------
function updateLine() {
  document.getElementById("lineChartTitle").textContent = titleLabel();
  const data = getFilteredData();

  d3.select("#linechart").selectAll("*").remove();
  drawLine(data);
}

function drawLine(data) {
  const svg = d3.select("#linechart");
  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;
  const margin = { top: 30, right: 140, bottom: 50, left: 60 };

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const yearly = d3.rollup(
    data,
    v => d3.mean(v, d => metricValue(d)),
    d => d.yearID
  );

  const leagueSeries = Array.from(yearly, ([year, val]) => ({ year, val }))
    .filter(d => d.val !== null)
    .sort((a,b)=>a.year-b.year);

  let teamSeries = [];
  if (currentTeam !== "All") {
    const teamData = data.filter(d => d.name === currentTeam);
    const teamMap = d3.rollup(
      teamData,
      v => d3.mean(v, d => metricValue(d)),
      d => d.yearID
    );
    teamSeries = Array.from(teamMap, ([year, val]) => ({year,val}))
      .filter(d => d.val !== null)
      .sort((a,b)=>a.year-b.year);
  }

  const x = d3.scaleLinear()
    .domain(d3.extent(leagueSeries, d=>d.year))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain(d3.extent([...leagueSeries, ...teamSeries], d=>d.val)).nice()
    .range([innerHeight, 0]);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  g.append("g").call(d3.axisLeft(y));

  g.append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth/2)
    .attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight/2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text(metricLabel());

  const line = d3.line()
    .x(d=>x(d.year))
    .y(d=>y(d.val));

  // League line
  const leaguePath = g.append("path")
    .datum(leagueSeries)
    .attr("fill","none")
    .attr("stroke","#1f77b4")
    .attr("stroke-width",2)
    .attr("d",line);

  const len = leaguePath.node().getTotalLength();
  leaguePath
    .attr("stroke-dasharray", `${len} ${len}`)
    .attr("stroke-dashoffset", len)
    .transition()
    .duration(800)
    .attr("stroke-dashoffset", 0);

  // Team line
  if (teamSeries.length) {
    const teamPath = g.append("path")
      .datum(teamSeries)
      .attr("fill","none")
      .attr("stroke","#e53935")
      .attr("stroke-width",2)
      .attr("d",line);

    const len2 = teamPath.node().getTotalLength();
    teamPath
      .attr("stroke-dasharray", `${len2} ${len2}`)
      .attr("stroke-dashoffset", len2)
      .transition()
      .duration(800)
      .attr("stroke-dashoffset", 0);
  }

  // Tooltips
  g.selectAll(".league-point")
    .data(leagueSeries)
    .join("circle")
    .attr("class","league-point")
    .attr("r",3)
    .attr("cx",d=>x(d.year))
    .attr("cy",d=>y(d.val))
    .attr("fill","#1f77b4")
    .on("mouseover", (e,d)=> {
      tooltip.style("opacity",1)
        .html(`Year: ${d.year}<br/>${metricLabel()}: ${d.val.toFixed(2)}`);
    })
    .on("mousemove", e=>{
      tooltip.style("left",e.pageX+12+"px").style("top",e.pageY-28+"px");
    })
    .on("mouseout", ()=>tooltip.style("opacity",0));

  // Legend
  const legend = g.append("g")
    .attr("class","legend")
    .attr("transform", `translate(${innerWidth+20}, 10)`);

  legend.append("text").text("Legend").attr("font-weight","600");

  legend.append("rect").attr("y",10).attr("width",12).attr("height",12).attr("fill","#1f77b4");
  legend.append("text").attr("x",18).attr("y",20).text("League average");

  legend.append("rect").attr("y",30).attr("width",12).attr("height",12).attr("fill","#e53935");
  legend.append("text").attr("x",18).attr("y",40).text(currentTeam === "All" ? "Selected team" : currentTeam);
}
