# GeoTaste AI

GeoTaste AI is a hyper-local F&B expansion intelligence demo for the Agent Forge Hackathon.

The product answers one question for franchise and cloud-kitchen operators:

> If we open near this mall or MRT station, what food craving is underserved, and what are competitors failing to deliver?

## Demo Flow

1. Pick a brand profile.
2. Pick a target location.
3. Run the agent.
4. Show the competitor scan, complaint clusters, and expansion brief.
5. Point to the sponsor integration log as the production path.

## Sponsor Integration Plan

- Bright Data: competitor listings, menus, opening hours, and review scraping.
- Daytona: isolated sandbox for scraper and analysis jobs.
- Kimi AI: long-context review classification and strategy generation.
- TokenRouter: model routing and caching for repeated neighborhood scans.
- SenseNova U1: PowerPoint or Excel market report generation.
- Terminal 3: verified franchise-agent identity for gated workflows.

## Credit Links

- Bright Data: http://get.brightdata.com/aibuilders10
- Daytona: https://www.theaibuilders.dev/daytonacredits
- Kimi AI: https://www.theaibuilders.dev/kimicredits
- TokenRouter: https://tinyurl.com/tokenroutercredits
- SenseNova U1: https://www.theaibuilders.dev/sensenovacredits
- Terminal 3: https://www.terminal3.io/products/agent-developer-kit

## Two-Minute Pitch

Most F&B expansion decisions still rely on intuition, generic footfall data, or expensive consultants. GeoTaste AI turns messy local review data into expansion strategy.

For a target location like Tampines Mall, the agent scans nearby competitors, extracts review complaints, clusters unmet needs, and produces a recommendation: what concept to open, what menu to launch, what price point to defend, and what execution risks to avoid.

This is not a chatbot. It is a market intelligence agent for F&B operators deciding where to open and what to sell.

## Run

For the safe cached demo, open `index.html` in a browser.

For live sponsor mode, create `.env` from `.env.example`, add keys, then start the local server:

```bash
node server.js
```

Open `http://localhost:4173` and click `Live Sponsor Run`.

## Live Integration Details

The app now has a real backend route:

```text
POST /api/analyze
```

That route attempts this pipeline:

1. Bright Data live scrape through `https://api.brightdata.com/request`.
2. Kimi or TokenRouter OpenAI-compatible analysis of the scraped evidence.
3. Daytona/SenseNova/Terminal 3 status checks from environment keys.
4. Cached fallback if any sponsor key is missing or an API call fails.

For judges, open the integration code:

- `integrations/live-agent.js`
- `integrations/daytona-proof.js`
