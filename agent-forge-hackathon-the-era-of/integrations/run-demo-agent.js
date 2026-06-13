const { runGeoTasteLive } = require("./live-agent");

async function main() {
  const result = await runGeoTasteLive({
    brandKey: process.argv[2] || "snack",
    locationKey: process.argv[3] || "tampines",
    radiusKm: Number(process.argv[4] || 1.5),
  });

  console.log(
    JSON.stringify(
      {
        sourceMode: result.sourceMode,
        confidence: result.confidence,
        recommendation: result.recommendation.concept,
        integrations: result.logs.map((log) => ({
          title: log.title,
          status: log.status,
          detail: log.detail,
        })),
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
