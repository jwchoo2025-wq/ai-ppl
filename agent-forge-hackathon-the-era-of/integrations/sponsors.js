const sponsorIntegrations = {
  brightData: {
    name: "Bright Data",
    status: "adapter-ready",
    purpose: "Collect competitor listings, menus, opening hours, and public review snippets by radius.",
    claimUrl: "http://get.brightdata.com/aibuilders10",
    async collectNeighborhoodSignals({ location, radiusKm }) {
      return {
        provider: "Bright Data",
        mode: process.env.BRIGHT_DATA_API_KEY ? "live" : "cached",
        location,
        radiusKm,
        note: "Wire this method to a Bright Data collector during live integration.",
      };
    },
  },
  daytona: {
    name: "Daytona",
    status: "runtime-planned",
    purpose: "Run scraping and analysis in isolated agent sandboxes.",
    claimUrl: "https://www.theaibuilders.dev/daytonacredits",
  },
  kimi: {
    name: "Kimi AI",
    status: "adapter-ready",
    purpose: "Classify review complaints and generate expansion recommendations.",
    claimUrl: "https://www.theaibuilders.dev/kimicredits",
    async classifyReviews({ reviews }) {
      return {
        provider: "Kimi AI",
        mode: process.env.KIMI_API_KEY ? "live" : "local-heuristic",
        reviewCount: reviews.length,
        note: "Use Kimi K2.6 for long-context clustering when key is available.",
      };
    },
  },
  tokenRouter: {
    name: "TokenRouter",
    status: "routing-planned",
    purpose: "Route repeated neighborhood scans through cached low-cost model calls.",
    claimUrl: "https://tinyurl.com/tokenroutercredits",
  },
  senseNova: {
    name: "SenseNova U1",
    status: "report-planned",
    purpose: "Generate Excel/PPT expansion reports from the agent brief.",
    claimUrl: "https://www.theaibuilders.dev/sensenovacredits",
  },
  terminal3: {
    name: "Terminal 3",
    status: "identity-planned",
    purpose: "Verify the franchise operator before gated data access or transactional workflows.",
    claimUrl: "https://www.terminal3.io/products/agent-developer-kit",
  },
};

module.exports = { sponsorIntegrations };
