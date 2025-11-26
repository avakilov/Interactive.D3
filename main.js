let fullData = [];
let currentLeague = "All";
let currentTeam = "All";
let metricMode = "both";

const tooltip = d3.select("#tooltip");

// ----------------------------------------------------
d3.csv("Teams.csv", d3.autoType).then(data => {

  fullData = data.filter(d =>
    d.yearID >= 1960 &&
    d.yearID <= 2015 &&
    d.G && d.R && d.H &&
    (d.lgID === "AL" || d.lgID === "NL")
  );

  fullData.forEach(d => {
    d.rpg = d.R / d.G;
    d.hpg = d.H / d.G;
  });

  setupLeagueFilter();
  setupMetricControls();
  setupYearSliders();
  setupTeamFilter();

  updateLine();
});

// ----------------------------------------------------
function setupLeagueFilter() {
  document.getElementById("leagueFilter").onchange = e => {
    currentLeague = e.target.value;
    setupTeamFilter();
    updateLine();
  };
}

function setupTeamFilter() {
  const select = document.getElementById("teamFilter");

  let base = currentLeague === "All"
    ? fullData
    : fullData.filter(d => d.lgID === currentLeague);

  const teams = Array.from(new Set(base.map(d => d.name))).sort();

  select.innerHTML = "<option value='All'>All teams</option>";
  teams.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });

  select.onchange = () => {
    currentTeam = select.value;
    updateLine();
  };

  currentTeam = "All";
}

function setupMetricControls() {
  document.querySelectorAll('input[name="metric"]').forEach(el => {
    el.onchange = () => {
      metricMode = el.value;
      updateLine();
    };
  });
}

function setupYearSliders() {
  const minYear = d3.min(fullData, d => d.yearID);
  const maxYear = d3.max(fullData, d => d.yearID);

  const min = document.getElementById("lineYearMin");
  const max = document.getElementById("lineYearMax");

  min.min = minYear; max.min = minYear;
  min.max = maxYear; max.max = maxYear;
  min.value = minYear; max.value = maxYear;

  min.oninput = max.oninput = () => {
    let a = +min.value;
    let b = +max.value;
    if (a > b) [a, b] = [b, a];
    min.value = a; max.value = b;
    document.getElementById("lineYearLabel").textContent = `${a} – ${b}`;
    updateLine();
  };

  document.getElementById("lineYearLabel").textContent = `${minYear} – ${maxYear}`;
}

// ----------------------------------------------------
function updateLine() {

  const minYear = +lineYearMin.value;
  const maxYear = +lineYearMax.value;

  let base = currentLeague === "All"
    ? fullData
    : fullData.filter(d => d.lgID === currentLeague);

  base = base.filter(d => d.yearID >= minYear && d.yearID <= maxYear);

  drawLine(base, minYear, maxYear);
}

// ----------------------------------------------------
function drawLine(data, minYear, maxYear) {

  const svg = d3.select("#linechart");
  svg.selectAll("*").remove();

  const margin = { top: 25, right: 160, bottom: 50, left: 60 };
  const w = svg.node().clientWidth - margin.left - margin.right;
  const h = svg.node().clientHeight - margin.top - margin.bottom;

  const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  const leagueRuns = d3.rollups(data, v => d3.mean(v, d => d.rpg), d => d.yearID)
      .map(d => ({year: d[0], val: d[1]})).sort((a,b)=>a.year-b.year);

  const leagueHits = d3.rollups(data, v => d3.mean(v, d => d.hpg), d => d.yearID)
      .map(d => ({year: d[0], val: d[1]})).sort((a,b)=>a.year-b.year);

  let teamRuns=[], teamHits=[];
  if (currentTeam !== "All") {
    const t = data.filter(d => d.name === currentTeam);
    teamRuns = d3.rollups(t, v => d3.mean(v, d => d.rpg), d => d.yearID)
        .map(d => ({year: d[0], val: d[1]}));
    teamHits = d3.rollups(t, v => d3.mean(v, d => d.hpg), d => d.yearID)
        .map(d => ({year: d[0], val: d[1]}));
  }

  const x = d3.scaleLinear().domain([minYear, maxYear]).range([0, w]);
  const y = d3.scaleLinear()
    .domain(d3.extent([...leagueRuns, ...leagueHits, ...teamRuns, ...teamHits], d => d.val))
    .nice()
    .range([h, 0]);

  g.append("g").attr("transform",`translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").call(d3.axisLeft(y));

  const line = d3.line().x(d=>x(d.year)).y(d=>y(d.val));

  if (metricMode !== "hits")
    g.append("path").datum(leagueRuns).attr("stroke","#1f77b4").attr("fill","none").attr("stroke-width",2).attr("d",line);

  if (metricMode !== "runs")
    g.append("path").datum(leagueHits).attr("stroke","#d62728").attr("fill","none").attr("stroke-width",2).attr("d",line);

  if (currentTeam !== "All") {
    if (metricMode !== "hits")
      g.append("path").datum(teamRuns).attr("stroke","orange").attr("fill","none").attr("stroke-width",2).attr("d",line);
    if (metricMode !== "runs")
      g.append("path").datum(teamHits).attr("stroke","orange").attr("stroke-dasharray","4 2").attr("fill","none").attr("stroke-width",2).attr("d",line);
  }

  document.getElementById("lineChartTitle").textContent =
    currentLeague === "All" ? "League-Wide Performance Over Time" :
    `${currentLeague} League Performance Over Time`;

  // LEGEND
  const leg = g.append("g").attr("transform", `translate(${w+20},10)`);

  let yPos = 0;
  if (metricMode !== "hits") {
    leg.append("rect").attr("y",yPos).attr("width",12).attr("height",12).attr("fill","#1f77b4");
    leg.append("text").attr("x",18).attr("y",yPos+10).text("League Runs/Game");
    yPos+=18;
  }
  if (metricMode !== "runs") {
    leg.append("rect").attr("y",yPos).attr("width",12).attr("height",12).attr("fill","#d62728");
    leg.append("text").attr("x",18).attr("y",yPos+10).text("League Hits/Game");
    yPos+=18;
  }
  if (currentTeam !== "All") {
    leg.append("rect").attr("y",yPos).attr("width",12).attr("height",12).attr("fill","orange");
    leg.append("text").attr("x",18).attr("y",yPos+10).text(currentTeam);
  }
}
