# Hackathon Setup Checklist

## Claim First

1. Bright Data credits: http://get.brightdata.com/aibuilders10
2. Daytona credits: https://www.theaibuilders.dev/daytonacredits
3. Kimi AI credits: https://www.theaibuilders.dev/kimicredits
4. TokenRouter credits: https://tinyurl.com/tokenroutercredits

## Claim If Time Allows

5. SenseNova U1 credits: https://www.theaibuilders.dev/sensenovacredits
6. Terminal 3 Agent Dev Kit: https://www.terminal3.io/products/agent-developer-kit
7. VideoDB credits: http://console.videodb.io/auth?event=agentforgesg

## Environment Variables

Copy `.env.example` to `.env` if you connect live APIs.

```bash
BRIGHT_DATA_API_KEY=
BRIGHT_DATA_ZONE=
KIMI_API_KEY=
KIMI_MODEL=kimi-k2.6
TOKENROUTER_API_KEY=
TOKENROUTER_BASE_URL=https://api.tokenrouter.ai/v1
TOKENROUTER_MODEL=kimi-k2.6
DAYTONA_API_KEY=
SENSENOVA_API_KEY=
TERMINAL3_API_KEY=
```

## Live Demo Run

1. Put at least `BRIGHT_DATA_API_KEY`, `BRIGHT_DATA_ZONE`, and `KIMI_API_KEY` in `.env`.
2. Start the app:

```bash
node server.js
```

3. Open `http://localhost:4173`.
4. Click `Live Sponsor Run`.
5. In the integration log, point out which calls were `live` and which ones are still `missing-key`.

The best live proof is Bright Data plus Kimi. Daytona can be shown as a separate sandbox proof:

```bash
node integrations/daytona-proof.js
```

## Demo Fallback

The app already includes cached Tampines and Jurong datasets, so the demo works even if:

- Google blocks scraping.
- sponsor keys are not activated yet.
- venue Wi-Fi is unstable.
- OAuth/signup takes too long.
