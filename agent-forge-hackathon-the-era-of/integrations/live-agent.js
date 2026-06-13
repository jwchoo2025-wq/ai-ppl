const { GEO_TASTE_DATA } = require("../src/data");
const fs = require("fs");
const path = require("path");

loadEnv();

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

async function runGeoTasteLive({
  brandKey = "snack",
  locationKey = "tampines",
  radiusKm = 1.5,
  brandProfile,
  locationProfile,
}) {
  const presetBrand = GEO_TASTE_DATA.brands[brandKey] || GEO_TASTE_DATA.brands.snack;
  const presetLocation = GEO_TASTE_DATA.locations[locationKey] || GEO_TASTE_DATA.locations.tampines;
  const brand = buildBrandProfile(presetBrand, brandProfile);
  const location = buildLocationProfile(presetLocation, locationProfile);
  const logs = [];

  const brightData = await collectWithBrightData({ brand, location, radiusKm }).catch((error) => ({
    ok: false,
    provider: "Bright Data",
    mode: "error",
    rawText: "",
    message: error.message,
  }));
  logs.push(toLog(brightData, "Bright Data scrape"));

  const liveCompetitors = brightData.competitors && brightData.competitors.length ? brightData.competitors : null;
  const analysisInput = liveCompetitors ? { ...location, competitors: liveCompetitors } : { ...location, competitors: [] };
  const liveAnalysis = analyzeHeuristically(analysisInput, brand);
  let payload = {
    sourceMode: liveCompetitors ? "bright-data-live-competitors" : "live-unavailable",
    brand,
    location: analysisInput,
    competitors: liveCompetitors || [],
    ...liveAnalysis,
    liveEvidence: buildLiveEvidence(brightData),
  };

  const llm = brightData.ok
    ? await analyzeWithSponsorModel({
        brand,
        location: analysisInput,
        radiusKm,
        brightData,
        fallback: payload,
      }).catch((error) => ({
        ok: false,
        provider: "Kimi/TokenRouter",
        mode: "error",
        message: error.message,
      }))
    : {
        ok: false,
        provider: "Kimi/TokenRouter",
        mode: "not-run",
        message: "Kimi was not called because Bright Data returned no live evidence.",
      };
  logs.push(toLog(llm, "Kimi / TokenRouter reasoning"));

  if (llm.ok && llm.analysis) {
    payload = mergeAnalysis(payload, llm.analysis, brand, analysisInput);
    payload.sourceMode = brightData.ok ? `${brightData.provider} + ${llm.provider}` : llm.provider;
  } else if (brightData.ok) {
    payload.sourceMode = liveCompetitors ? "Bright Data live competitors" : "Bright Data raw evidence";
  }

  logs.push({
    title: "Daytona sandbox path",
    detail: process.env.DAYTONA_API_KEY
      ? "DAYTONA_API_KEY is present. Run integrations/daytona-proof.js for a live sandbox proof if judges ask."
      : "Add DAYTONA_API_KEY to run the same agent job inside a Daytona sandbox.",
    status: process.env.DAYTONA_API_KEY ? "configured" : "missing-key",
  });
  logs.push({
    title: "SenseNova U1 report path",
    detail: process.env.SENSENOVA_API_KEY
      ? "SENSENOVA_API_KEY is present. The brief can be sent to SenseNova for PPT/Excel report generation."
      : "Add SENSENOVA_API_KEY to generate the final expansion memo as slides or spreadsheet.",
    status: process.env.SENSENOVA_API_KEY ? "configured" : "missing-key",
  });
  logs.push({
    title: "Terminal 3 identity path",
    detail: process.env.TERMINAL3_API_KEY
      ? "TERMINAL3_API_KEY is present. Use it before gated franchise data access or transactional workflows."
      : "Add TERMINAL3_API_KEY for verified franchise-agent identity.",
    status: process.env.TERMINAL3_API_KEY ? "configured" : "missing-key",
  });

  payload.logs = logs;
  payload.status = buildStatus();
  return payload;
}

async function collectWithBrightData({ brand, location, radiusKm }) {
  if (!process.env.BRIGHT_DATA_API_KEY || !process.env.BRIGHT_DATA_ZONE) {
    return {
      ok: false,
      provider: "Bright Data",
      mode: "missing-key",
      rawText: "",
      message: "Set BRIGHT_DATA_API_KEY and BRIGHT_DATA_ZONE for live scraping.",
    };
  }

  const categoryQuery = deriveCompetitorQuery(brand);
  const mapQuery = encodeURIComponent(`${categoryQuery} near ${location.name} Singapore`);
  const reviewQuery = encodeURIComponent(
    `${categoryQuery} near ${location.name} Singapore reviews queue expensive service taste takeaway`,
  );
  const mapsUrl = `https://www.google.com/maps/search/${mapQuery}?brd_json=1`;
  const searchUrl = `https://www.google.com/search?q=${reviewQuery}`;
  const started = Date.now();

  const maps = await requestBrightData(mapsUrl, { country: "sg" });
  if (!maps.ok) {
    return {
      ok: false,
      provider: "Bright Data",
      mode: "api-error",
      sourceUrl: mapsUrl,
      rawText: maps.text.slice(0, 1000),
      message: `Bright Data Maps request returned HTTP ${maps.status}.`,
    };
  }

  const search = await requestBrightData(searchUrl, { country: "sg", data_format: "markdown" }).catch((error) => ({
    ok: false,
    status: 0,
    text: error.message,
    rawText: "",
  }));

  const mapsJson = readBrightDataJson(maps.text);
  const searchRaw = search.ok ? readBrightDataBody(search.text) : "";
  let competitors = buildLiveCompetitors(mapsJson, searchRaw, location);
  competitors = await enrichCompetitorsWithReviewSnippets(competitors, location, categoryQuery);
  const rawText = [summarizeMapsJson(mapsJson), searchRaw, summarizeCompetitorReviews(competitors)].filter(Boolean).join("\n\n");

  return {
    ok: true,
    provider: "Bright Data",
    mode: "live",
    sourceUrl: mapsUrl,
    searchUrl,
    rawText,
    competitors,
    message: `Fetched ${competitors.length} real ${categoryQuery} competitors and ${rawText.length} evidence characters in ${Date.now() - started}ms.`,
  };
}

function deriveCompetitorQuery(brand) {
  const text = `${brand.name} ${brand.intent} ${(brand.menu || []).join(" ")}`.toLowerCase();
  const rules = [
    { terms: ["mochi", "dessert", "soft serve", "ice cream", "cake", "sweet", "daifuku"], query: "dessert shops cafes" },
    { terms: ["coffee", "kopi", "espresso", "latte", "pastry", "breakfast"], query: "cafes coffee shops" },
    { terms: ["noodle", "ramen", "laksa", "pho", "ban mian", "mee"], query: "noodle restaurants" },
    { terms: ["curry puff", "snack", "fried", "takeaway", "grab-and-go", "finger food"], query: "snack takeaway food" },
    { terms: ["healthy", "salad", "grain", "protein bowl"], query: "healthy food restaurants" },
    { terms: ["bubble tea", "boba", "tea"], query: "bubble tea shops" },
    { terms: ["burger", "chicken", "wings", "fast food"], query: "fast food restaurants" },
    { terms: ["korean", "bbq", "kimchi"], query: "korean restaurants" },
    { terms: ["japanese", "sushi", "donburi", "matcha"], query: "japanese restaurants cafes" },
  ];
  const match = rules.find((rule) => rule.terms.some((term) => text.includes(term)));
  return match ? match.query : "restaurants cafes";
}

async function requestBrightData(url, extra = {}) {
  const response = await fetchWithTimeout("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.BRIGHT_DATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      zone: process.env.BRIGHT_DATA_ZONE,
      url,
      format: "json",
      method: "GET",
      ...extra,
    }),
  }, 40000);
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

async function analyzeWithSponsorModel({ brand, location, radiusKm, brightData, fallback }) {
  const llm = chooseLlmProvider();
  if (!llm) {
    return {
      ok: false,
      provider: "Kimi/TokenRouter",
      mode: "missing-key",
      message: "Set KIMI_API_KEY or TOKENROUTER_API_KEY for live LLM analysis.",
    };
  }

  if (process.env.KIMI_FULL_ANALYSIS !== "1") {
    return runFastSponsorInsight({ llm, brand, location, radiusKm, brightData, fallback });
  }

  const reviews = location.competitors.flatMap((competitor) =>
    competitor.quotes.map((quote) => `${competitor.name}: ${quote}`),
  );
  const prompt = [
    "You are GeoTaste AI, a site-selection agent for Singapore F&B expansion teams.",
    "Return only valid JSON. No markdown.",
    "Use the schema: { competitors: [{name,cuisine,rating,reviews,distance,x,y,quotes}], clusters: [{id,title,matches:[{quote,competitor}],strength,opportunity}], confidence: number, recommendation: {concept,craving,positioning,evidence,menu,pricing,risk} }.",
    `Brand: ${brand.name}. Intent: ${brand.intent}. Target ticket: ${brand.targetTicket}.`,
    `Location: ${location.name}. Radius: ${radiusKm}km. Local context: ${location.summary}.`,
    `Cached review snippets for fallback: ${JSON.stringify(reviews)}`,
    brightData.ok
      ? `Live Bright Data capture from search results: ${brightData.rawText.slice(0, 2500)}`
      : `Bright Data was not live: ${brightData.message}. Use cached review snippets but mention that live scrape is not configured.`,
    `Existing fallback analysis: ${JSON.stringify(fallback.recommendation)}`,
  ].join("\n\n");

  const response = await fetchWithTimeout(`${llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${llm.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: llm.model,
      temperature: Number(process.env.LLM_TEMPERATURE || 1),
      messages: [
        {
          role: "system",
          content: "You convert noisy local food-market evidence into structured JSON for a dashboard.",
        },
        { role: "user", content: prompt },
      ],
    }),
  }, 45000);

  const body = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      provider: llm.provider,
      mode: "api-error",
      message: `${llm.provider} returned HTTP ${response.status}: ${body.slice(0, 300)}`,
    };
  }

  const parsed = JSON.parse(body);
  const content = parsed.choices?.[0]?.message?.content || "";
  return {
    ok: true,
    provider: llm.provider,
    mode: "live",
    message: `Generated ${content.length} characters with ${llm.model}.`,
    analysis: extractJson(content),
  };
}

async function runFastSponsorInsight({ llm, brand, location, radiusKm, brightData, fallback }) {
  const evidence = brightData.ok
    ? extractEvidenceSnippets(brightData.rawText).join("\n").slice(0, 900)
    : location.competitors
        .flatMap((competitor) => competitor.quotes.map((quote) => `${competitor.name}: ${quote}`))
        .join("\n");
  const prompt = `One short market insight for ${brand.name} near ${location.name}. Use these live scraped source snippets: ${evidence}`;

  const primary = await requestSponsorInsight({ llm, prompt }).catch((error) => ({
    ok: false,
    message: error.message,
  }));
  const result = primary.ok || !process.env.KIMI_API_KEY
    ? primary
    : await requestSponsorInsight({
        llm: { ...llm, model: process.env.KIMI_FAST_MODEL || "moonshot-v1-8k" },
        prompt,
      }).catch((error) => ({ ok: false, message: error.message }));

  if (!result.ok) {
    return {
      ok: false,
      provider: llm.provider,
      mode: "api-error",
      message: result.message,
    };
  }

  const existingEvidence = fallback.recommendation.evidence || [];

  return {
    ok: true,
    provider: llm.provider,
    mode: "live",
    message: `Generated live sponsor insight with ${result.model}: ${result.content.slice(0, 140)}`,
    analysis: {
      recommendation: {
        ...fallback.recommendation,
        evidence: [...existingEvidence.slice(0, 2), `${llm.provider} live insight: ${result.content}`],
      },
    },
  };
}

async function requestSponsorInsight({ llm, prompt }) {
  const response = await fetchWithTimeout(`${llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${llm.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: llm.model,
      temperature: Number(process.env.LLM_TEMPERATURE || 1),
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: "You produce concise market intelligence for Singapore F&B expansion teams. Keep the final answer under 25 words.",
        },
        { role: "user", content: prompt },
      ],
    }),
  }, 30000);

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${llm.provider} returned HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  const parsed = JSON.parse(body);
  const message = parsed.choices?.[0]?.message || {};
  const content = cleanModelInsight(
    message.content || "",
  );

  if (!content) {
    throw new Error(`${llm.model} returned no final content.`);
  }

  return { ok: true, model: llm.model, content };
}

function chooseLlmProvider() {
  if (process.env.TOKENROUTER_API_KEY) {
    return {
      provider: "TokenRouter",
      key: process.env.TOKENROUTER_API_KEY,
      baseUrl: process.env.TOKENROUTER_BASE_URL || "https://api.tokenrouter.ai/v1",
      model: process.env.TOKENROUTER_MODEL || process.env.KIMI_MODEL || "kimi-k2.6",
    };
  }

  if (process.env.KIMI_API_KEY) {
    return {
      provider: "Kimi AI",
      key: process.env.KIMI_API_KEY,
      baseUrl: "https://api.moonshot.ai/v1",
      model: process.env.KIMI_MODEL || "kimi-k2.6",
    };
  }

  return null;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function analyzeHeuristically(location, brand) {
  const allQuotes = location.competitors.flatMap((competitor) =>
    competitor.quotes.map((quote) => ({ quote, competitor: competitor.name })),
  );

  const clusters = complaintThemes
    .map((theme) => {
      const matches = allQuotes.filter(({ quote }) =>
        theme.keywords.some((keyword) => quote.toLowerCase().includes(keyword)),
      );
      return {
        ...theme,
        matches,
        strength: Math.min(98, Math.round((matches.length / Math.max(allQuotes.length, 1)) * 170 + 18)),
      };
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
    confidence,
    recommendation: buildRecommendation(location, brand, clusters[0], clusters[1]),
  };
}

function buildRecommendation(location, brand, primary, secondary) {
  const competitors = location.competitors || [];
  const topByReviews = [...competitors].sort((a, b) => Number(b.reviews || 0) - Number(a.reviews || 0))[0];
  const avgRating = competitors.length
    ? competitors.reduce((sum, competitor) => sum + Number(competitor.rating || 0), 0) / competitors.length
    : 0;
  const categoryMix = [...new Set(competitors.map((competitor) => competitor.cuisine).filter(Boolean))]
    .slice(0, 3)
    .join(", ");
  const concept = topByReviews
    ? `Position ${brand.name} as a sharper ${brand.intent} offer near ${location.name}, not a generic copy of ${topByReviews.name}.`
    : `Open a focused ${brand.name} outlet near ${location.name} after a live competitor scan succeeds.`;
  const craving = `Customers in this area already have ${categoryMix || "multiple F&B"} options; the wedge should be ${brand.intent}.`;
  const site = recommendSite(location, competitors);

  return {
    site,
    concept,
    craving,
    positioning: `For ${location.summary}, position the brand around ${brand.intent}.`,
    evidence: [
      topByReviews
        ? `${topByReviews.name} is the strongest demand proxy with ${Number(topByReviews.reviews || 0).toLocaleString()} reviews.`
        : "No live competitor demand proxy was available.",
      `${competitors.length} live competitors were found; average rating is ${avgRating.toFixed(1) || "n/a"}.`,
      secondary
        ? `${primary.title} and ${secondary.title} are the strongest extracted signal groups.`
        : `${primary.title} is the strongest extracted signal group.`,
    ],
    menu: brand.menu.slice(0, 4),
    pricing: brand.targetTicket,
    risk: topByReviews
      ? `High-rated incumbents mean the launch must be specific: clearer price point, faster format, or a menu gap they do not own.`
      : "Rerun with a more specific location or category before using this for a lease decision.",
  };
}

function recommendSite(location, competitors) {
  if (!competitors.length) {
    return {
      area: location.name,
      format: "Run a live scan first",
      reason: "No live competitor addresses are available yet.",
      caveat: "Do not make a lease decision from an empty scan.",
    };
  }

  const clusters = buildAddressClusters(competitors);
  const topCluster = clusters[0];
  const topCompetitors = competitors
    .filter((competitor) => normalizeClusterKey(inferClusterLabel(competitor.address || competitor.distance || "")) === topCluster.key)
    .slice(0, 3)
    .map((competitor) => competitor.name);
  const mrtOrMall = /mall|junction|jem|westgate|square|plaza|mrt/i.test(topCluster.label);
  const format = mrtOrMall
    ? `MRT-facing takeaway kiosk or B1/F&B corridor inside ${topCluster.label}`
    : `street-facing micro outlet around ${topCluster.label}`;

  return {
    area: topCluster.label,
    format,
    reason: `${topCluster.count} of the top live competitors cluster here, with ${topCluster.reviews.toLocaleString()} combined Google review signals. Nearby demand proxies include ${topCompetitors.join(", ")}.`,
    caveat: "Validate rent, exact unit availability, and footfall by daypart before signing.",
  };
}

function buildAddressClusters(competitors) {
  const clusterMap = new Map();
  for (const competitor of competitors) {
    const label = inferClusterLabel(competitor.address || competitor.distance || "");
    const key = normalizeClusterKey(label);
    const current = clusterMap.get(key) || { key, label, count: 0, reviews: 0 };
    current.count += 1;
    current.reviews += Number(competitor.reviews || 0);
    clusterMap.set(key, current);
  }

  return [...clusterMap.values()].sort((a, b) => b.count - a.count || b.reviews - a.reviews);
}

function inferClusterLabel(address) {
  const text = String(address);
  const known = [
    "Bugis Junction",
    "Bugis+",
    "Tampines Mall",
    "Tampines 1",
    "Century Square",
    "JEM",
    "Westgate",
    "JCube",
    "313@somerset",
    "ION Orchard",
    "Plaza Singapura",
  ];
  const found = known.find((place) => text.toLowerCase().includes(place.toLowerCase()));
  if (found) return found;

  const postalMatch = text.match(/(\d+\s+[A-Za-z][^,#]+)/);
  if (postalMatch) return postalMatch[1].trim();
  return text || "target area";
}

function normalizeClusterKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildBrandProfile(presetBrand, brandProfile = {}) {
  const menu = Array.isArray(brandProfile.menu)
    ? brandProfile.menu
    : String(brandProfile.menu || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return {
    name: String(brandProfile.name || presetBrand.name).trim(),
    intent: String(brandProfile.intent || presetBrand.intent).trim(),
    targetTicket: String(brandProfile.targetTicket || presetBrand.targetTicket).trim(),
    menu: (menu.length ? menu : presetBrand.menu).slice(0, 8),
  };
}

function buildLocationProfile(presetLocation, locationProfile = {}) {
  const name = String(locationProfile.name || presetLocation.name).trim();
  return {
    name,
    lat: Number(locationProfile.lat || presetLocation.lat),
    lng: Number(locationProfile.lng || presetLocation.lng),
    summary: String(locationProfile.summary || `live F&B demand signals around ${name}`).trim(),
    competitors: Array.isArray(locationProfile.competitors) && locationProfile.competitors.length
      ? locationProfile.competitors
      : presetLocation.competitors,
  };
}

function mergeAnalysis(fallback, analysis, brand, location) {
  const competitors = Array.isArray(analysis.competitors) && analysis.competitors.length
    ? analysis.competitors.slice(0, 8).map((competitor, index) => ({
        name: String(competitor.name || `Competitor ${index + 1}`),
        cuisine: String(competitor.cuisine || "food and beverage"),
        rating: Number(competitor.rating || 4),
        reviews: Number(competitor.reviews || 0),
        distance: String(competitor.distance || "nearby"),
        x: Number(competitor.x || 34 + index * 7),
        y: Number(competitor.y || 34 + index * 5),
        quotes: Array.isArray(competitor.quotes) && competitor.quotes.length
          ? competitor.quotes.slice(0, 3).map(String)
          : [`Live result matched ${brand.intent}.`],
      }))
    : fallback.competitors;

  return {
    ...fallback,
    brand,
    location: { ...location, competitors },
    competitors,
    clusters: Array.isArray(analysis.clusters) && analysis.clusters.length ? analysis.clusters : fallback.clusters,
    confidence: Number(analysis.confidence || fallback.confidence),
    recommendation: {
      ...fallback.recommendation,
      ...(analysis.recommendation || {}),
    },
  };
}

function buildLiveCompetitors(mapsJson, searchRaw, location) {
  const organic = Array.isArray(mapsJson?.organic) ? mapsJson.organic : [];
  const snippets = extractReviewSnippets(searchRaw);
  const usedNames = new Set();

  return organic
    .filter((place) => place && place.title && Number(place.rating || 0) > 0)
    .slice(0, 8)
    .map((place, index) => {
      const name = cleanPlaceName(place.title);
      usedNames.add(name.toLowerCase());
      const matchedSnippet = findSnippetForPlace(name, snippets);
      const category = Array.isArray(place.category)
        ? place.category.map((item) => item.title_short || item.title).filter(Boolean).join(", ")
        : place.category || "Restaurant";

      return {
        name,
        cuisine: normalizeCategory(category),
        rating: Number(place.rating || 0),
        reviews: Number(place.reviews_cnt || place.reviews || 0),
        distance: place.address ? shortAddress(place.address, location.name) : "nearby",
        lat: Number(place.latitude || 0),
        lng: Number(place.longitude || 0),
        x: Number.isFinite(place.longitude) ? 28 + (index % 4) * 13 : 34 + index * 6,
        y: Number.isFinite(place.latitude) ? 32 + Math.floor(index / 4) * 20 + (index % 2) * 7 : 34 + index * 5,
        quotes: [
          matchedSnippet ||
            `Google Maps signal: ${Number(place.rating || 0).toFixed(1)} rating from ${Number(place.reviews_cnt || place.reviews || 0).toLocaleString()} reviews.`,
          place.work_status ? `Opening signal: ${place.work_status}.` : "Opening hours available in live Maps result.",
          place.address ? `Located at ${place.address}.` : "Address available in live Maps result.",
        ],
        sourceUrl: place.map_link || place.link || "",
        address: place.address || "",
        rank: place.rank || index + 1,
      };
    })
    .filter((place) => place.name);
}

async function enrichCompetitorsWithReviewSnippets(competitors, location, categoryQuery) {
  const targets = competitors.slice(0, 5);
  const enriched = await Promise.all(
    targets.map(async (competitor) => {
      const query = encodeURIComponent(`"${competitor.name}" ${location.name} reviews food service queue expensive`);
      const url = `https://www.google.com/search?q=${query}`;
      try {
        const result = await requestBrightData(url, {
          country: "sg",
          data_format: "markdown",
        });
        if (!result.ok) return competitor;
        const raw = readBrightDataBody(result.text);
        const snippets = extractReviewSnippets(raw);
        const specific = findBestReviewSnippet(competitor.name, snippets);
        if (!specific) return competitor;
        return {
          ...competitor,
          quotes: [
            specific,
            ...competitor.quotes.filter((quote) => !quote.startsWith("Google Maps signal:")),
            competitor.quotes.find((quote) => quote.startsWith("Google Maps signal:")) || competitor.quotes[0],
          ].slice(0, 3),
          reviewSourceUrl: url,
        };
      } catch {
        return competitor;
      }
    }),
  );

  return competitors.map((competitor, index) => enriched[index] || competitor);
}

function findBestReviewSnippet(name, snippets) {
  const badGeneric = /the 10 best|best restaurants near|what is the most popular|google search|tripadvisor\s*$/i;
  const nameTokens = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !["tampines", "jurong", "mall", "junction", "singapore"].includes(token));

  const specific = snippets.find((snippet) => {
    const lower = snippet.toLowerCase();
    return !badGeneric.test(lower) && nameTokens.some((token) => lower.includes(token));
  });
  if (specific) return specific;

  return snippets.find((snippet) => !badGeneric.test(snippet));
}

function summarizeCompetitorReviews(competitors) {
  return competitors
    .map((competitor) => `${competitor.name}: ${competitor.quotes.join(" ")}`)
    .join("\n");
}

function extractReviewSnippets(rawText) {
  if (!rawText) return [];

  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 30 && line.length < 260)
    .filter((line) => !line.includes("Google Search"))
    .filter((line) => !/restaurants near .* reviews food service queue expensive takeaway/i.test(line))
    .filter((line) => !line.includes("Skip to main content"))
    .filter((line) => !line.startsWith("!["))
    .filter((line) => !line.includes("data:image"))
    .filter((line) => !line.includes("](https://"))
    .filter((line) => /food|service|staff|restaurant|tampines|jurong|review|rated|queue|expensive|takeaway|mall/i.test(line))
    .slice(0, 40);
}

function findSnippetForPlace(name, snippets) {
  const stopWords = new Set([
    "tampines",
    "jurong",
    "mall",
    "restaurant",
    "restaurants",
    "singapore",
    "central",
    "near",
  ]);
  const tokens = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !stopWords.has(token));
  return snippets.find((snippet) => tokens.some((token) => snippet.toLowerCase().includes(token))) || "";
}

function cleanPlaceName(name) {
  return String(name).replace(/\s+/g, " ").trim();
}

function normalizeCategory(category) {
  return String(category)
    .replace(/Chinoise/gi, "Chinese")
    .replace(/Chinesa/gi, "Chinese")
    .replace(/Restaurante/gi, "Restaurant")
    .replace(/Churrasco coreano/gi, "Korean BBQ")
    .replace(/Coreana/gi, "Korean")
    .replace(/Italiana/gi, "Italian")
    .replace(/Cantonesa/gi, "Cantonese")
    .replace(/Dim sum/gi, "Dim Sum")
    .replace(/Fast food no estilo de Hong Kong/gi, "Hong Kong-style fast food")
    .replace(/Barbecue coréen/gi, "Korean BBQ")
    .replace(/Món ăn Trung Quốc/gi, "Chinese")
    .replace(/Món thịt nướng Triều Tiên/gi, "Korean BBQ")
    .replace(/Nhà hàng/gi, "Restaurant")
    .replace(/Singapour/gi, "Singapore")
    .replace(/Singapura/gi, "Singapore")
    .replace(/\s+/g, " ")
    .trim();
}

function shortAddress(address, locationName) {
  const text = String(address).replace(/Singapour/g, "Singapore");
  if (text.includes("Tampines Mall")) return "Tampines Mall";
  if (text.includes("Tampines 1")) return "Tampines 1";
  if (text.includes("Century Square")) return "Century Square";
  if (text.includes("JEM")) return "JEM";
  if (text.includes("Westgate")) return "Westgate";
  return locationName.includes("/") ? locationName.split("/")[0].trim() : "nearby";
}

function summarizeMapsJson(mapsJson) {
  const organic = Array.isArray(mapsJson?.organic) ? mapsJson.organic : [];
  return organic
    .slice(0, 12)
    .map((place) => {
      const category = Array.isArray(place.category)
        ? place.category.map((item) => item.title_short || item.title).filter(Boolean).join(", ")
        : place.category || "Restaurant";
      return [
        place.title,
        place.rating ? `${place.rating} rating` : "",
        place.reviews_cnt ? `${place.reviews_cnt} reviews` : "",
        normalizeCategory(category),
        normalizeCategory(place.address || ""),
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n");
}

function readBrightDataBody(text) {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") return parsed;
    return (
      parsed.body ||
      parsed.content ||
      parsed.data ||
      parsed.result ||
      parsed.html ||
      JSON.stringify(parsed).slice(0, 12000)
    );
  } catch {
    return text;
  }
}

function readBrightDataJson(text) {
  const outer = JSON.parse(text);
  const body = typeof outer.body === "string" ? outer.body : JSON.stringify(outer.body || outer);
  return JSON.parse(body);
}

function buildLiveEvidence(brightData) {
  if (!brightData.ok) {
    return {
      status: brightData.mode || "not-live",
      sourceUrl: brightData.sourceUrl || "",
      summary: brightData.message || "Live scrape not available.",
      characters: 0,
      snippets: [],
    };
  }

  return {
    status: "live",
    sourceUrl: brightData.sourceUrl,
    searchUrl: brightData.searchUrl,
    summary: brightData.message,
    characters: brightData.rawText.length,
    snippets: extractEvidenceSnippets(brightData.rawText),
  };
}

function extractEvidenceSnippets(rawText) {
  const usefulTerms = [
    "restaurant",
    "food",
    "review",
    "tampines",
    "jurong",
    "mall",
    "queue",
    "cold",
    "expensive",
    "opening",
    "near",
  ];
  const seen = new Set();

  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 42 && line.length < 220)
    .filter((line) => !/^https?:\/\//i.test(line))
    .filter((line) => !line.includes("Google Search"))
    .filter((line) => !line.includes("restaurants reviews near"))
    .filter((line) => !line.includes("](https://"))
    .filter((line) => usefulTerms.some((term) => line.toLowerCase().includes(term)))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function cleanModelInsight(content) {
  const cleaned = String(content)
    .replace(/\s+/g, " ")
    .replace(/^["']|["']$/g, "")
    .trim();

  if (!cleaned) {
    return "";
  }

  return cleaned.slice(0, 220);
}

function extractJson(content) {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
  }
  throw new Error("Model response did not contain valid JSON.");
}

function toLog(result, title) {
  return {
    title,
    detail: result.message || "No detail returned.",
    status: result.ok ? "live" : result.mode || "not-live",
  };
}

function buildStatus() {
  return {
    brightData: Boolean(process.env.BRIGHT_DATA_API_KEY && process.env.BRIGHT_DATA_ZONE),
    kimi: Boolean(process.env.KIMI_API_KEY),
    tokenRouter: Boolean(process.env.TOKENROUTER_API_KEY),
    daytona: Boolean(process.env.DAYTONA_API_KEY),
    senseNova: Boolean(process.env.SENSENOVA_API_KEY),
    terminal3: Boolean(process.env.TERMINAL3_API_KEY),
  };
}

module.exports = { runGeoTasteLive, buildStatus };

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
