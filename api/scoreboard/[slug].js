export default async function handler(req, res) {
  const { slug } = req.query;

  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/tennis/${slug}/scoreboard`
    );
    const data = await r.json();

    // Return an object with `events` so the frontend `data?.events` works
    res.status(200).json({ events: data.events || [] });
  } catch {
    res.status(200).json({ events: [] });
  }
}
