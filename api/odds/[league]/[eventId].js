export default async function handler(req, res) {
  const { league, eventId } = req.query; // Changed from { slug, eventId }

  console.log("API called with:", { league, eventId });

  try {
    const url = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${league}/events/${eventId}/competitions/${eventId}/odds`;
    console.log("Fetching from:", url);

    const r = await fetch(url);

    console.log("Response status:", r.status);

    if (!r.ok) {
      console.error(`ESPN API error: ${r.status}`);
      return res.status(200).json(null);
    }

    const data = await r.json();
    console.log("Full API response:", JSON.stringify(data, null, 2));
    console.log("Items array length:", data?.items?.length);

    if (!data?.items?.length || data.items.length < 3) {
      console.log("Not enough items in array");
      return res.status(200).json(null);
    }

    const o = data.items.length >= 3 ? data.items[2] : data.items[1];
    console.log("Using item at index:", data.items.length >= 3 ? 2 : 0);
    console.log("Item data:", JSON.stringify(o, null, 2));

    const result = {
      home: o.homeTeamOdds?.current?.moneyLine?.american ?? null,
      away: o.awayTeamOdds?.current?.moneyLine?.american ?? null,
    };

    console.log("Returning:", result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching odds:", error);
    return res.status(200).json(null);
  }
}
