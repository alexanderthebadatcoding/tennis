import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/soccer";

app.get("/api/leagues", async (_req, res) => {
  try {
    const r = await fetch(`${ESPN_CORE}/leagues?lang=en&region=us`);
    const data = await r.json();
    res.json(data.items?.slice(0, 26) ?? []);
  } catch {
    res.status(500).json([]);
  }
});

app.get("/api/scoreboard/:slug", async (req, res) => {
  try {
    const r = await fetch(`${ESPN_SITE}/${req.params.slug}/scoreboard`);
    const data = await r.json();
    res.json(data.events ?? []);
  } catch {
    res.json([]);
  }
});

app.get("/api/odds/:league/:eventId", async (req, res) => {
  const { league, eventId } = req.params;

  try {
    const r = await fetch(
      `${ESPN_CORE}/leagues/${league}/events/${eventId}/competitions/${eventId}/odds`
    );
    const data = await r.json();

    const item = data.items?.[0];
    if (!item) return res.json(null);

    res.json({
      home: item.homeTeamOdds?.current?.moneyLine?.american,
      away: item.awayTeamOdds?.current?.moneyLine?.american,
    });
  } catch {
    res.json(null);
  }
});

app.listen(3001, () => console.log("API running on http://localhost:3001"));
