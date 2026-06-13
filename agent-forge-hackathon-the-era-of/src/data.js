const GEO_TASTE_DATA = {
  brands: {
    snack: {
      name: "Old Chang Kee-style snack chain",
      intent: "hot takeaway snacks for commuters, students, and office workers",
      targetTicket: "SGD 3.50-7.50",
      menu: ["curry puffs", "fried chicken bites", "fish balls", "tea-time bundles", "late-night hot snacks"],
    },
    dessert: {
      name: "Japanese dessert kiosk",
      intent: "mochi, matcha soft serve, and takeaway desserts for students, tourists, and mall shoppers",
      targetTicket: "SGD 4.50-9.00",
      menu: ["mochi donuts", "matcha soft serve", "fruit daifuku", "dessert boxes", "seasonal parfaits"],
    },
    noodle: {
      name: "Fast casual noodle bar",
      intent: "quick hot noodles for office lunch, dinner crowds, and takeaway meals",
      targetTicket: "SGD 8.00-13.00",
      menu: ["dry noodles", "soup noodles", "ramen bowls", "protein add-ons", "takeaway bowls"],
    },
    coffee: {
      name: "Premium kopi and pastry kiosk",
      intent: "fast breakfast, kopi breaks, and affordable pastries for office workers",
      targetTicket: "SGD 4.00-9.50",
      menu: ["kopi", "teh", "egg tarts", "sandwiches", "office breakfast sets"],
    },
    salad: {
      name: "Healthy lunch bowl brand",
      intent: "salads, grain bowls, and protein meals for CBD lunch and gym-adjacent demand",
      targetTicket: "SGD 9.50-16.00",
      menu: ["grain bowls", "protein salads", "cold-pressed drinks", "low-carb sets", "office meal plans"],
    },
    bubbletea: {
      name: "Bubble tea and fruit tea kiosk",
      intent: "customisable drinks and fruit teas for students, shoppers, and post-lunch office crowds",
      targetTicket: "SGD 3.80-7.50",
      menu: ["milk tea", "fruit tea", "brown sugar drinks", "cheese foam", "low-sugar options"],
    },
    burger: {
      name: "Gourmet burger counter",
      intent: "premium burgers, chicken sandwiches, and quick casual dinners for office and mall crowds",
      targetTicket: "SGD 10.00-18.00",
      menu: ["beef burgers", "chicken sandwiches", "loaded fries", "lunch combos", "late dinner sets"],
    },
    bakery: {
      name: "Artisanal bakery cafe",
      intent: "fresh bakes, coffee, and light meals for morning office traffic and afternoon breaks",
      targetTicket: "SGD 5.00-14.00",
      menu: ["croissants", "sourdough sandwiches", "coffee", "pastries", "takeaway breakfast boxes"],
    },
  },
  locations: {
    raffles: {
      name: "Raffles Place / CBD",
      lat: 1.2838,
      lng: 103.8515,
      summary: "dense office lunch, coffee, and after-work demand around Raffles Place MRT",
      competitors: [],
    },
    tanjong: {
      name: "Tanjong Pagar / Guoco Tower",
      lat: 1.2764,
      lng: 103.8459,
      summary: "CBD office workers, Korean/Japanese dining, gyms, and after-work dinner traffic",
      competitors: [],
    },
    telok: {
      name: "Telok Ayer / Amoy Street",
      lat: 1.2819,
      lng: 103.8489,
      summary: "office lunch, cafe, bar, and dinner traffic across Amoy, Telok Ayer, and Far East Square",
      competitors: [],
    },
    marina: {
      name: "Marina Bay / MBFC",
      lat: 1.2794,
      lng: 103.8547,
      summary: "premium CBD office, tourist, and mall traffic around MBFC, Marina Bay Link Mall, and Downtown MRT",
      competitors: [],
    },
    cityhall: {
      name: "City Hall / Raffles City",
      lat: 1.2932,
      lng: 103.852,
      summary: "office, tourist, convention, and mall traffic around City Hall MRT and Raffles City",
      competitors: [],
    },
    bugis: {
      name: "Bugis Junction Singapore",
      lat: 1.2995,
      lng: 103.8558,
      summary: "student, tourist, office lunch, dessert, and mall traffic around Bugis Junction",
      competitors: [],
    },
    orchard: {
      name: "Orchard / Somerset",
      lat: 1.301,
      lng: 103.8385,
      summary: "high-volume shopping, tourist, cafe, dessert, and premium casual dining demand",
      competitors: [],
    },
    novena: {
      name: "Novena / Velocity",
      lat: 1.3206,
      lng: 103.8439,
      summary: "medical-office workers, gym traffic, families, and weekday lunch demand around Novena MRT",
      competitors: [],
    },
    tampines: {
      name: "Tampines Mall / MRT",
      lat: 1.3526,
      lng: 103.9452,
      summary: "dense commuter flow, students, heartland families, mall-heavy lunch and dinner traffic",
      competitors: [],
    },
    jurong: {
      name: "Jurong East / JEM",
      lat: 1.3331,
      lng: 103.7436,
      summary: "regional mall cluster, office workers, families, science park commuters, and weekend destination traffic",
      competitors: [],
    },
  },
  sponsorLinks: [
    {
      name: "Bright Data",
      use: "Production competitor and review scraping",
      url: "http://get.brightdata.com/aibuilders10",
    },
    {
      name: "Daytona",
      use: "Sandboxed agent runtime",
      url: "https://www.theaibuilders.dev/daytonacredits",
    },
    {
      name: "Kimi AI",
      use: "Long-context review classification and recommendation reasoning",
      url: "https://www.theaibuilders.dev/kimicredits",
    },
    {
      name: "TokenRouter",
      use: "Model routing and cache for cheaper repeated analyses",
      url: "https://tinyurl.com/tokenroutercredits",
    },
    {
      name: "SenseNova U1",
      use: "Automated market report and slide generation",
      url: "https://www.theaibuilders.dev/sensenovacredits",
    },
    {
      name: "Terminal 3",
      use: "Verified franchise agent identity for gated actions",
      url: "https://www.terminal3.io/products/agent-developer-kit",
    },
  ],
};

if (typeof module !== "undefined") {
  module.exports = { GEO_TASTE_DATA };
}
