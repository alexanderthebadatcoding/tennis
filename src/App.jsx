import React, { useState, useEffect } from "react";
import {
  Trophy,
  Calendar,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function App() {
  const [leagues, setLeagues] = useState([]);
  const [scores, setScores] = useState({});
  const [odds, setOdds] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsedLeagues, setCollapsedLeagues] = useState({});

  const fetchLeaguesAndScores = async () => {
    setLoading(true);
    setError(null);

    try {
      /* ---------- LEAGUES ---------- */
      const leaguesRes = await fetch("/api/leagues");
      if (!leaguesRes.ok) throw new Error("Failed to load leagues");

      const leagueItems = await leaguesRes.json();
      if (!Array.isArray(leagueItems)) throw new Error("Bad league data");

      const validLeagues = leagueItems.map((l) => ({
        id: l.id,
        name: l.name,
        abbreviation: l.abbreviation,
        slug: l.slug,
      }));

      setLeagues(validLeagues);

      /* ---------- SCOREBOARDS ---------- */
      const scoresPairs = await Promise.all(
        validLeagues.map(async (league) => {
          try {
            const res = await fetch(`/api/scoreboard/${league.slug}`);
            const data = await res.json();
            // Handle tennis API structure with events array
            const events = data?.events || [];
            return [league.id, Array.isArray(events) ? events : []];
          } catch {
            return [league.id, []];
          }
        })
      );

      const scoresData = Object.fromEntries(scoresPairs);
      setScores(scoresData);

      /* ---------- ODDS (ALL EVENTS) ---------- */
      const allEvents = [];
      for (const league of validLeagues) {
        for (const event of scoresData[league.id] || []) {
          allEvents.push({ league, event });
        }
      }

      const oddsPairs = await Promise.all(
        allEvents.map(async ({ league, event }) => {
          try {
            const res = await fetch(`/api/odds/${league.slug}/${event.id}`);
            const data = await res.json();

            if (data && (data.home !== null || data.away !== null)) {
              console.log(`Odds for event ${event.id}:`, data);
              return [event.id, data];
            }

            // Fallback: extract from tennis API structure
            console.log(`Using fallback odds for event ${event.id}`);
            const grouping = event?.groupings?.[0];
            const competition = grouping?.competitions?.[0];
            const moneyline = competition?.odds?.[0]?.moneyline;

            if (moneyline) {
              const fallbackOdds = {
                home: moneyline.home?.open?.odds ?? null,
                away: moneyline.away?.open?.odds ?? null,
              };
              console.log(`Fallback odds for event ${event.id}:`, fallbackOdds);
              return [event.id, fallbackOdds];
            }

            return null;
          } catch (error) {
            console.error(`Failed to fetch odds for event ${event.id}:`, error);

            // Fallback: extract from tennis API structure
            const grouping = event?.groupings?.[0];
            const competition = grouping?.competitions?.[0];
            const moneyline = competition?.odds?.[0]?.moneyline;

            if (moneyline) {
              const fallbackOdds = {
                home: moneyline.home?.open?.odds ?? null,
                away: moneyline.away?.open?.odds ?? null,
              };
              console.log(
                `Fallback odds for event ${event.id} (error):`,
                fallbackOdds
              );
              return [event.id, fallbackOdds];
            }

            return null;
          }
        })
      );

      setOdds(Object.fromEntries(oddsPairs.filter(Boolean)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaguesAndScores();
  }, []);

  /* ---------- HELPERS ---------- */

  const isGameInTimeWindow = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const start = new Date();
    start.setDate(start.getDate() - 4);
    const end = new Date();
    end.setDate(end.getDate() + 8);
    return d >= start && d <= end;
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

  const americanOddsToPercentage = (odds) => {
    if (!odds) return null;
    const n = Number(odds);
    if (Number.isNaN(n)) return null;

    const p = n > 0 ? 100 / (n + 100) : Math.abs(n) / (Math.abs(n) + 100);
    return `${(p * 100).toFixed(1)}%`;
  };

  const toggleLeague = (id) => {
    setCollapsedLeagues((p) => ({ ...p, [id]: !p[id] }));
  };

  /* ---------- STATES ---------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-10 h-10 animate-spin text-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        {error}
      </div>
    );
  }

  /* ---------- RENDER ---------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-10 h-10 text-green-600" />
            <h1 className="text-4xl font-bold text-gray-800">
              Tennis Scoreboard
            </h1>
          </div>
          <p className="text-gray-600">
            Live scores from leagues around the world
          </p>
          <button
            onClick={fetchLeaguesAndScores}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="space-y-8">
          {leagues
            .map((league) => {
              const leagueEvents = scores[league.id] || [];
              const filteredEvents = leagueEvents.filter((e) =>
                isGameInTimeWindow(e.date)
              );

              if (filteredEvents.length === 0) return null;

              const hasLiveGames = filteredEvents.some(
                (e) => e.status?.type?.state === "in"
              );

              return { league, filteredEvents, hasLiveGames };
            })
            .filter(Boolean)
            .sort((a, b) =>
              a.hasLiveGames && !b.hasLiveGames
                ? -1
                : !a.hasLiveGames && b.hasLiveGames
                ? 1
                : 0
            )
            .map(({ league, filteredEvents }) => (
              <div
                key={league.id}
                className="bg-white rounded-lg shadow-lg overflow-hidden"
              >
                <div
                  className="bg-green-600 text-white px-6 py-4 cursor-pointer hover:bg-green-700 transition-colors flex items-center justify-between"
                  onClick={() => toggleLeague(league.id)}
                >
                  <div className="flex items-center gap-3">
                    {league.logo && (
                      <img
                        src={league.logo}
                        alt={league.name}
                        className="w-10 h-10 object-contain rounded-full"
                        loading="lazy"
                      />
                    )}
                    <div>
                      <h2 className="text-2xl font-bold">{league.name}</h2>
                    </div>
                  </div>
                  {collapsedLeagues[league.id] ? (
                    <ChevronDown className="w-6 h-6" />
                  ) : (
                    <ChevronUp className="w-6 h-6" />
                  )}
                </div>

                {!collapsedLeagues[league.id] && (
                  <div className="p-6">
                    {filteredEvents.length > 0 ? (
                      <div className="space-y-4">
                        {filteredEvents.map((event) => (
                          <div
                            key={event.id}
                            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Calendar className="w-4 h-4" />
                                {formatDate(event.date)}
                                <Clock className="w-4 h-4 ml-2" />
                                {formatTime(event.date)}
                              </div>
                              <p className="text-sm font-medium text-gray-700">
                                {event.shortName || event.name}
                              </p>
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                  event.status?.type?.state === "post"
                                    ? "bg-gray-200 text-gray-700"
                                    : event.status?.type?.state === "in"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {event.status?.type?.shortDetail || "Scheduled"}
                              </span>
                            </div>

                            {/* Tennis matches - iterate through groupings */}
                            {event.groupings?.map((grouping, groupingIndex) => (
                              <div key={groupingIndex} className="mt-4">
                                {grouping.grouping?.displayName && (
                                  <p className="text-xs text-gray-500 mb-2">
                                    {grouping.grouping.displayName}
                                  </p>
                                )}

                                {/* Round info */}
                                {grouping.competitions?.[0]?.round
                                  ?.displayName && (
                                  <p className="text-xs text-gray-500 mb-2">
                                    {grouping.competitions[0].round.displayName}
                                  </p>
                                )}

                                {/* Players/Competitors */}
                                <div className="space-y-2">
                                  {grouping.competitions?.[0]?.competitors?.map(
                                    (competitor) => {
                                      const isHome =
                                        competitor.homeAway === "home";
                                      const teamOdds = odds[event.id];
                                      const oddsValue = teamOdds
                                        ? isHome
                                          ? teamOdds.home
                                          : teamOdds.away
                                        : null;
                                      const oddsPercentage =
                                        americanOddsToPercentage(oddsValue);

                                      return (
                                        <div
                                          key={competitor.id}
                                          className="flex items-center justify-between"
                                        >
                                          <div className="flex items-center gap-3">
                                            {competitor.athlete?.headshot && (
                                              <img
                                                src={
                                                  competitor.athlete.headshot
                                                }
                                                alt={
                                                  competitor.athlete
                                                    ?.displayName
                                                }
                                                className="w-8 h-8 object-contain rounded-full"
                                                loading="lazy"
                                              />
                                            )}
                                            <span
                                              className={`font-semibold ${
                                                competitor.winner
                                                  ? "text-green-700"
                                                  : "text-gray-700"
                                              }`}
                                            >
                                              {competitor.athlete
                                                ?.displayName || "Unknown"}
                                            </span>
                                            {oddsPercentage && (
                                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                {oddsPercentage}
                                              </span>
                                            )}
                                          </div>
                                          <span
                                            className={`text-2xl font-bold ${
                                              competitor.winner
                                                ? "text-green-700"
                                                : "text-gray-700"
                                            }`}
                                          >
                                            {competitor.score || "-"}
                                          </span>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        No recent matches available
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default App;
