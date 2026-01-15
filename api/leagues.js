export default async function handler(req, res) {
  try {
    const listRes = await fetch(
      "https://sports.core.api.espn.com/v2/sports/tennis/leagues?lang=en&region=us"
    );
    const listData = await listRes.json();

    const refs = listData.items?.slice(0, 25) || [];

    // Fetch all league refs in parallel
    const leagues = await Promise.all(
      refs.map(async (item) => {
        try {
          const r = await fetch(item.$ref);
          const l = await r.json();

          return {
            id: l.id,
            name: l.name,
            abbreviation: l.abbreviation,
            slug: l.slug,
          };
        } catch {
          return null;
        }
      })
    );

    res.status(200).json(leagues.filter(Boolean));
  } catch (err) {
    res.status(500).json([]);
  }
}
