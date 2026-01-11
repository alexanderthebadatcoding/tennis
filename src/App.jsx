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
            const events = await res.json();
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
      console.log(`Fetching odds for ${allEvents.length} events`);

      const oddsPairs = await Promise.all(
        allEvents.map(async ({ league, event }) => {
          try {
            const res = await fetch(`/api/odds/${league.slug}/${event.id}`);
            const data = await res.json();
            console.log(`Odds for event ${event.id}:`, data);
            return data ? [event.id, data] : null;
          } catch (error) {
            console.error(`Failed to fetch odds for event ${event.id}:`, error);
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
  console.log("Leagues:", leagues);
  /* ---------- RENDER ---------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-10 h-10 text-green-600" />
            <h1 className="text-4xl font-bold text-gray-800">
              Soccer Scoreboard
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
                (e) => e.status.type.state === "in"
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
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                  event.status.type.state === "post"
                                    ? "bg-gray-200 text-gray-700"
                                    : event.status.type.state === "in"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {event.status.type.shortDetail}
                              </span>
                            </div>

                            <div className="space-y-2">
                              {event.competitions[0].competitors.map((team) => {
                                const isHome = team.homeAway === "home";
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
                                    key={team.id}
                                    className="flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-3">
                                      {team.team.logo && (
                                        <img
                                          src={team.team.logo}
                                          alt={team.team.name}
                                          className="w-8 h-8 object-contain"
                                          loading="lazy"
                                        />
                                      )}
                                      <span
                                        className={`font-semibold ${
                                          team.winner
                                            ? "text-green-700"
                                            : "text-gray-700"
                                        }`}
                                      >
                                        {team.team.name}
                                      </span>
                                      {oddsPercentage && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                          {oddsPercentage}
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`text-2xl font-bold ${
                                        team.winner
                                          ? "text-green-700"
                                          : "text-gray-700"
                                      }`}
                                    >
                                      {team.score}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
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
