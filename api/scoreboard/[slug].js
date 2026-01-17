export default async function handler(req, res) {
  const { slug } = req.query;
  const tournament = (Array.isArray(slug) ? slug[0] : slug) || "atp";

  // Build querystring from other query params (e.g. dates=YYYYMMDD)
  const params = { ...req.query };
  delete params.slug;
  const qs = new URLSearchParams(params).toString();

  const upstream = `https://site.api.espn.com/apis/site/v2/sports/tennis/${encodeURIComponent(
    tournament,
  )}/scoreboard${qs ? `?${qs}` : ""}`;

  try {
    // server-side fetch avoids browser CORS issues
    const r = await fetch(upstream, {
      // optional: set a sensible timeout in production using AbortController
      headers: {
        "User-Agent": "scoreboard-proxy/1.0",
        Accept: "application/json",
      },
    });

    if (!r.ok) {
      console.error(`Upstream ESPN returned ${r.status} for ${upstream}`);
      // Return empty events to keep frontend behavior predictable
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
      return res.status(200).json({ events: [] });
    }

    const data = await r.json();

    // Ensure we return an object with events for the frontend
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res
      .status(200)
      .json({ events: Array.isArray(data.events) ? data.events : [] });
  } catch (err) {
    console.error("Failed to fetch ESPN scoreboard:", err);
    // Keep returning 200 with an empty events array so frontend fallback logic remains simple
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    return res.status(200).json({ events: [] });
  }
}
