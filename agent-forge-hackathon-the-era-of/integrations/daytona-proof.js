async function runDaytonaProof() {
  loadEnv();
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("Set DAYTONA_API_KEY before running the Daytona proof.");
  }

  const response = await fetch("https://app.daytona.io/api/sandbox", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Daytona returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  return JSON.parse(body);
}

if (require.main === module) {
  runDaytonaProof()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { runDaytonaProof };

function loadEnv() {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
