export default async function handler(req, res) {
  const { slug, eventId } = req.query;

  try {
    const r = await fetch(
      `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/events/${eventId}/competitions/${eventId}/odds`
    );

    if (!r.ok) {
      console.error(`ESPN API error: ${r.status}`);
      return res.status(200).json(null);
    }

    const data = await r.json();

    if (!data?.items?.length || data.items.length < 3) {
      return res.status(200).json(null);
    }

    const o = data.items[2]; // Changed from 0 to 2

    return res.status(200).json({
      home: o.homeTeamOdds?.current?.moneyLine?.american ?? null,
      away: o.awayTeamOdds?.current?.moneyLine?.american ?? null,
    });
  } catch (error) {
    console.error("Error fetching odds:", error);
    return res.status(200).json(null);
  }
}
