const $ = (selector) => document.querySelector(selector);

const complaintThemes = [
  {
    id: "speed",
    title: "Queues and service bottlenecks",
    keywords: ["queue", "wait", "crowded", "service", "cashier", "seats"],
    opportunity: "Design for sub-90-second fulfillment and a separate pickup lane.",
  },
  {
    id: "temperature",
    title: "Food temperature and freshness",
    keywords: ["cold", "lukewarm", "hot", "soggy", "leaked", "wet"],
    opportunity: "Own the promise of hot, crisp, commuter-safe takeaway.",
  },
  {
    id: "value",
    title: "Value and portion anxiety",
    keywords: ["expensive", "price", "prices", "portion", "portions", "affordable"],
    opportunity: "Launch transparent snack bundles under SGD 6.",
  },
  {
    id: "availability",
    title: "Evening and stock-out gaps",
    keywords: ["sells out", "left", "early", "closes", "late", "dinner", "evening"],
    opportunity: "Keep a late-day hot-snack menu for commuters and shoppers.",
  },
  {
    id: "variety",
    title: "Limited savoury snack variety",
    keywords: ["limited", "repetitive", "variety", "choices", "snack-sized", "small bites"],
    opportunity: "Use rotating local flavours to avoid menu fatigue.",
  },
];

const brandSelect = $("#brandSelect");
const locationSelect = $("#locationSelect");
const radiusSelect = $("#radiusSelect");
const runAgent = $("#runAgent");
const copyBrief = $("#copyBrief");
const profileSummary = $("#profileSummary");
let geoMap;
let geoMarkerLayer;

function getSelection() {
  const brand = getSelectedBrand();
  const location = getSelectedLocation();
  return {
    brandKey: brandSelect.value,
    locationKey: locationSelect.value,
    radiusKm: Number.parseFloat(radiusSelect.value) || 1.5,
    brandProfile: brand,
    locationProfile: location,
  };
}

function makeEmptyPayload(extraLog) {
  const brand = getSelectedBrand();
  const location = {
    ...getSelectedLocation(),
    competitors: [],
  };

  return {
    sourceMode: "not-run",
    brand,
    location,
    competitors: [],
    clusters: [],
    confidence: 0,
    recommendation: {
      concept: "Run a live market analysis to generate a recommendation.",
      craving: brand.intent,
      positioning: `Target area: ${location.name}.`,
      evidence: [extraLog || "No live scrape has been run yet."],
      menu: brand.menu,
      pricing: brand.targetTicket,
      risk: "Live competitor data has not been fetched yet.",
    },
    logs: [
      {
        title: "Live analysis",
        detail: extraLog || "Click Analyze Market to fetch real competitor data through the backend.",
        status: "not-live",
      },
      {
        title: "Bright Data scrape",
        detail: "Waiting to fetch live Google Maps competitor data.",
        status: "not-live",
      },
    ],
    liveEvidence: {
      status: "not-live",
      sourceUrl: "",
      summary: extraLog || "Waiting for a live Bright Data scrape.",
      characters: 0,
      snippets: [
        "No source has been fetched yet.",
      ],
    },
  };
}

function getSelectedBrand() {
  return GEO_TASTE_DATA.brands[brandSelect.value] || Object.values(GEO_TASTE_DATA.brands)[0];
}

function getSelectedLocation() {
  return GEO_TASTE_DATA.locations[locationSelect.value] || Object.values(GEO_TASTE_DATA.locations)[0];
}

function populateSelects() {
  brandSelect.innerHTML = Object.entries(GEO_TASTE_DATA.brands)
    .map(([key, brand]) => `<option value="${escapeHtml(key)}">${escapeHtml(brand.name)}</option>`)
    .join("");
  locationSelect.innerHTML = Object.entries(GEO_TASTE_DATA.locations)
    .map(([key, location]) => `<option value="${escapeHtml(key)}">${escapeHtml(location.name)}</option>`)
    .join("");
}

function renderProfileSummary() {
  const brand = getSelectedBrand();
  const location = getSelectedLocation();
  profileSummary.innerHTML = `
    <div>
      <span>Brand angle</span>
      <p>${escapeHtml(brand.intent)}</p>
    </div>
    <div>
      <span>Menu signal</span>
      <p>${escapeHtml(brand.menu.slice(0, 5).join(", "))}</p>
    </div>
    <div>
      <span>Area context</span>
      <p>${escapeHtml(location.summary)}</p>
    </div>
  `;
}

function analyze(location, brand) {
  const allQuotes = location.competitors.flatMap((competitor) =>
    competitor.quotes.map((quote) => ({ quote, competitor: competitor.name })),
  );

  const clusters = complaintThemes
    .map((theme) => {
      const matches = allQuotes.filter(({ quote }) =>
        theme.keywords.some((keyword) => quote.toLowerCase().includes(keyword)),
      );
      const strength = Math.min(98, Math.round((matches.length / Math.max(allQuotes.length, 1)) * 170 + 18));
      return { ...theme, matches, strength };
    })
    .filter((theme) => theme.matches.length > 0)
    .sort((a, b) => b.strength - a.strength);
  if (!clusters.length) {
    clusters.push({
      id: "live-density",
      title: "High local F&B density",
      keywords: [],
      opportunity: "Differentiate with a sharper daypart, format, or price wedge.",
      matches: allQuotes.slice(0, 3),
      strength: 68,
    });
  }

  const totalReviews = location.competitors.reduce((sum, competitor) => sum + Number(competitor.reviews || 0), 0);
  const competitorCoverage = Math.min(35, location.competitors.length * 4.5);
  const reviewDepth = Math.min(30, Math.log10(totalReviews + 1) * 7);
  const signalDiversity = Math.min(20, clusters.length * 5);
  const sourceQuality = totalReviews > 0 ? 10 : 0;
  const confidence = Math.round(competitorCoverage + reviewDepth + signalDiversity + sourceQuality);

  return {
    clusters,
    confidence: Math.min(confidence, 96),
    recommendation: buildRecommendation(location, brand, clusters[0], clusters[1]),
  };
}

function buildRecommendation(location, brand, primary, secondary) {
  const competitors = location.competitors || [];
  const topByReviews = [...competitors].sort((a, b) => Number(b.reviews || 0) - Number(a.reviews || 0))[0];
  const avgRating = competitors.length
    ? competitors.reduce((sum, competitor) => sum + Number(competitor.rating || 0), 0) / competitors.length
    : 0;
  const concept = topByReviews
    ? `Position ${brand.name} as a sharper ${brand.intent} offer near ${location.name}, not a generic copy of ${topByReviews.name}.`
    : `Open a focused ${brand.name} outlet near ${location.name} after a live competitor scan succeeds.`;
  const craving = brand.intent;
  const site = {
    area: location.name,
    format: "Run a live scan to pick a micro-location",
    reason: "No live competitor addresses are available yet.",
    caveat: "Validate rent, unit availability, and daypart footfall before signing.",
  };

  return {
    site,
    concept,
    craving,
    positioning: `For ${location.summary}, position the brand around ${brand.intent}.`,
    evidence: [
      topByReviews
        ? `${topByReviews.name} is the strongest demand proxy with ${Number(topByReviews.reviews || 0).toLocaleString()} reviews.`
        : `${primary.title} appears in ${primary.matches.length} live signals.`,
      secondary
        ? `${secondary.title} is the second strongest unmet need.`
        : "Competitor complaints are concentrated enough for a clear wedge.",
      `${competitors.length} live competitors were found; average rating is ${avgRating.toFixed(1) || "n/a"}.`,
    ],
    menu: brand.menu.slice(0, 4),
    pricing: brand.targetTicket,
    risk: topByReviews
      ? "High-rated incumbents mean the launch must be specific: clearer price point, faster format, or a menu gap they do not own."
      : "Rerun with a more specific location or category before using this for a lease decision.",
  };
}

function renderPayload(payload) {
  const location = payload.location;
  const brand = payload.brand;
  location.competitors = payload.competitors || location.competitors;

  $("#confidenceScore").textContent = `${payload.confidence}`;
  $("#confidenceLabel").textContent = payload.sourceMode === "not-run" ? "Awaiting live scan" : "Live data coverage";
  $("#scanStatus").textContent =
    payload.sourceMode === "not-run" ? "No scan yet" : `${location.competitors.length} competitors - ${payload.sourceMode}`;

  renderMap(location);
  renderCompetitors(location);
  renderClusters(payload.clusters || []);
  renderLiveEvidence(payload.liveEvidence);
  renderBrief(payload.recommendation);
  renderLogs(payload.logs || [], location, brand);
}

function renderMap(location) {
  if (window.L) {
    renderLeafletMap(location);
    return;
  }

  renderFallbackMap(location);
}

function renderLeafletMap(location) {
  const mapElement = $("#map");
  const competitorsWithCoords = location.competitors.filter((competitor) => competitor.lat && competitor.lng);
  const center = competitorsWithCoords.length
    ? [competitorsWithCoords[0].lat, competitorsWithCoords[0].lng]
    : [location.lat || 1.2838, location.lng || 103.8515];

  if (!geoMap) {
    mapElement.innerHTML = "";
    geoMap = L.map("map", {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    }).setView(center, 16);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
    }).addTo(geoMap);
    L.control.zoom({ position: "bottomright" }).addTo(geoMap);
    geoMarkerLayer = L.layerGroup().addTo(geoMap);
  }

  geoMarkerLayer.clearLayers();

  if (!competitorsWithCoords.length) {
    geoMap.setView(center, 15);
    return;
  }

  const bounds = [];
  competitorsWithCoords.forEach((competitor, index) => {
    const marker = L.marker([competitor.lat, competitor.lng], {
      title: competitor.name,
    }).bindPopup(`
      <strong>${escapeHtml(competitor.name)}</strong><br />
      ${escapeHtml(competitor.cuisine || "F&B")}<br />
      ${Number(competitor.rating || 0).toFixed(1)} rating · ${Number(competitor.reviews || 0).toLocaleString()} reviews
    `);
    marker.addTo(geoMarkerLayer);
    bounds.push([competitor.lat, competitor.lng]);
  });

  if (bounds.length === 1) {
    geoMap.setView(bounds[0], 17);
  } else {
    geoMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
  }

  window.setTimeout(() => geoMap.invalidateSize(), 50);
}

function renderFallbackMap(location) {
  const map = $("#map");
  map.innerHTML = `<div class="map-fallback">Satellite map tiles are unavailable. Competitors are still listed below from live data.</div>`;
  location.competitors.forEach((competitor, index) => {
    const pin = document.createElement("div");
    pin.className = "pin";
    pin.style.left = `${competitor.x || 45 + index * 4}%`;
    pin.style.top = `${competitor.y || 38 + index * 5}%`;
    pin.textContent = `${index + 1}`;
    pin.title = competitor.name;
    map.appendChild(pin);
  });
}

function renderCompetitors(location) {
  if (!location.competitors.length) {
    $("#competitors").innerHTML = `<div class="empty-state">No live competitors loaded yet. Enter a brand and location, then click Analyze Market.</div>`;
    return;
  }

  $("#competitors").innerHTML = location.competitors
    .map((competitor, index) => {
      const rating = Number(competitor.rating || 0).toFixed(1);
      const quote = Array.isArray(competitor.quotes) && competitor.quotes.length ? competitor.quotes[0] : "Live signal found.";
      return `
        <div class="competitor">
          <strong>${index + 1}. ${escapeHtml(competitor.name)}</strong>
          <span class="rating">${rating}</span>
          <small class="competitor-meta">${escapeHtml(competitor.cuisine || "food")} · ${escapeHtml(competitor.distance || "nearby")} · ${Number(competitor.reviews || 0).toLocaleString()} reviews</small>
          <small>${escapeHtml(quote)}</small>
          ${competitor.sourceUrl ? `<a class="competitor-source" href="${escapeHtml(competitor.sourceUrl)}" target="_blank" rel="noreferrer">source</a>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderClusters(clusters) {
  if (!clusters.length) {
    $("#clusters").innerHTML = `<div class="empty-state">Demand clusters appear after live competitor data is fetched.</div>`;
    return;
  }

  $("#clusters").innerHTML = clusters
    .slice(0, 4)
    .map((cluster) => {
      const firstMatch = Array.isArray(cluster.matches) && cluster.matches.length ? cluster.matches[0] : null;
      const quote = firstMatch ? `"${firstMatch.quote}" - ${firstMatch.competitor}` : cluster.opportunity;
      return `
        <div class="cluster">
          <strong>${escapeHtml(cluster.title)}</strong>
          <small>${Array.isArray(cluster.matches) ? cluster.matches.length : 0} review signals - ${escapeHtml(cluster.opportunity || "")}</small>
          <div class="bar" style="color: ${cluster.id === "speed" ? "var(--coral)" : "var(--blue)"}">
            <span style="width: ${Number(cluster.strength || 70)}%"></span>
          </div>
          <small>${escapeHtml(quote)}</small>
        </div>
      `;
    })
    .join("");
}

function renderBrief(recommendation) {
  $("#brief").innerHTML = `
    <div class="brief-block site-pick">
      <h3>Recommended Store Location</h3>
      <p><strong>${escapeHtml(recommendation.site?.area || "Run analysis first")}</strong></p>
      <p>${escapeHtml(recommendation.site?.format || "")}</p>
      <p>${escapeHtml(recommendation.site?.reason || "")}</p>
    </div>
    <div class="brief-block">
      <h3>Recommendation</h3>
      <p>${escapeHtml(recommendation.concept)}</p>
    </div>
    <div class="brief-block">
      <h3>Underserved Craving</h3>
      <p>${escapeHtml(recommendation.craving)}</p>
    </div>
    <div class="brief-block">
      <h3>Why This Works</h3>
      <p>${escapeHtml(recommendation.positioning)}</p>
      <p>${escapeHtml((recommendation.evidence || []).join(" "))}</p>
    </div>
    <div class="brief-block">
      <h3>Launch Menu</h3>
      <div class="chips">${(recommendation.menu || []).map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}</div>
    </div>
    <div class="brief-block">
      <h3>Pricing Guardrail</h3>
      <p>${escapeHtml(recommendation.pricing)}. Keep one hero bundle visibly below nearby full-meal prices.</p>
    </div>
    <div class="brief-block">
      <h3>Risk</h3>
      <p>${escapeHtml(recommendation.risk)} ${escapeHtml(recommendation.site?.caveat || "")}</p>
    </div>
  `;
}

function renderLiveEvidence(liveEvidence = {}) {
  const isLive = liveEvidence.status === "live";
  $("#liveStatus").textContent = isLive ? "Live" : liveEvidence.status || "Fallback";
  $("#liveStatus").className = `pill ${isLive ? "ok" : "warn"}`;
  const source = liveEvidence.sourceUrl
    ? `<a href="${escapeHtml(liveEvidence.sourceUrl)}" target="_blank" rel="noreferrer">Google Maps source</a>`
    : "<span>No live source yet</span>";
  const searchSource = liveEvidence.searchUrl
    ? `<a href="${escapeHtml(liveEvidence.searchUrl)}" target="_blank" rel="noreferrer">review search source</a>`
    : "";
  const snippets = Array.isArray(liveEvidence.snippets) && liveEvidence.snippets.length
    ? liveEvidence.snippets
    : ["No extracted snippets available for this run."];

  $("#liveEvidence").innerHTML = `
    <div class="evidence-meta">
      <div><span>Mode</span><strong>${escapeHtml(liveEvidence.status || "not-live")}</strong></div>
      <div><span>Fetched</span><strong>${Number(liveEvidence.characters || 0).toLocaleString()} chars</strong></div>
    </div>
    <p>${escapeHtml(liveEvidence.summary || "Waiting for a live run.")}</p>
    <div class="source-line">${source}${searchSource ? ` · ${searchSource}` : ""}</div>
    <ul>
      ${snippets.map((snippet) => `<li>${escapeHtml(snippet)}</li>`).join("")}
    </ul>
  `;
}

function renderLogs(logs, location, brand) {
  const finalLogs = logs.length
    ? logs
    : [
        {
          title: "Bright Data scrape adapter",
          detail: `Collects Places, menus, opening hours, and reviews within 1.5 km of ${location.name}.`,
          status: "not-live",
        },
        {
          title: "Kimi AI via TokenRouter",
          detail: `Classifies ${location.competitors.flatMap((c) => c.quotes).length} review snippets for ${brand.name}.`,
          status: "not-live",
        },
      ];

  $("#logs").innerHTML = finalLogs
    .map(
      (log) => `
        <div class="log">
          <span class="dot ${escapeHtml(log.status || "not-live")}"></span>
          <div><strong>${escapeHtml(log.title)}</strong><br /><small>${escapeHtml(log.detail)}</small></div>
        </div>
      `,
    )
    .join("");
}

async function runLiveAgent() {
  runAgent.disabled = true;
  runAgent.textContent = "Analyzing...";
  $("#scanStatus").textContent = "Calling backend...";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getSelection()),
    });
    const body = await response.json();
    if (!response.ok || !body.ok) {
      throw new Error(body.error || `HTTP ${response.status}`);
    }
    renderPayload(body.result);
  } catch (error) {
    renderPayload(makeEmptyPayload(`Live backend unavailable: ${error.message}. Start with node server.js for live analysis.`));
  } finally {
    runAgent.disabled = false;
    runAgent.textContent = "Analyze Market";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

runAgent.addEventListener("click", runLiveAgent);

copyBrief.addEventListener("click", async () => {
  const text = $("#brief").innerText;
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
  copyBrief.textContent = "Copied";
  window.setTimeout(() => {
    copyBrief.textContent = "Copy";
  }, 900);
});

brandSelect.addEventListener("change", () => {
  renderProfileSummary();
  renderPayload(makeEmptyPayload());
});
locationSelect.addEventListener("change", () => {
  renderProfileSummary();
  renderPayload(makeEmptyPayload());
});
radiusSelect.addEventListener("change", () => renderPayload(makeEmptyPayload()));
populateSelects();
renderProfileSummary();
renderPayload(makeEmptyPayload());
