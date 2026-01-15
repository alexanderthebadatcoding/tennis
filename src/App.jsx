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
  const [scores, setScores] = useState({}); // leagueId -> events[]
  const [odds, setOdds] = useState({}); // competitionId -> { home, away }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsedLeagues, setCollapsedLeagues] = useState({});
  const [collapsedGroupings, setCollapsedGroupings] = useState({}); // { [leagueId]: { [groupingKey]: bool } }

  const fetchLeaguesAndScores = async () => {
    setLoading(true);
    setError(null);

    try {
      // LEAGUES
      const leaguesRes = await fetch("/api/leagues");
      if (!leaguesRes.ok) throw new Error("Failed to load leagues");
      const leagueItems = await leaguesRes.json();
      if (!Array.isArray(leagueItems)) throw new Error("Bad league data");

      const validLeagues = leagueItems.map((l) => ({
        id: l.id,
        name: l.name,
        abbreviation: l.abbreviation,
        slug: l.slug,
        logo: l.logo, // optional
      }));
      setLeagues(validLeagues);

      // SCOREBOARDS (per league)
      const scoresPairs = await Promise.all(
        validLeagues.map(async (league) => {
          try {
            const res = await fetch(`/api/scoreboard/${league.slug}`);
            const data = await res.json();
            const events = data?.events || [];
            return [league.id, Array.isArray(events) ? events : []];
          } catch {
            return [league.id, []];
          }
        })
      );
      const scoresData = Object.fromEntries(scoresPairs);
      setScores(scoresData);

      // ODDS: fetch per competition (tennis competitions are inside event.groupings[*].competitions[*])
      const allCompetitions = [];
      for (const league of validLeagues) {
        const leagueEvents = scoresData[league.id] || [];
        for (const event of leagueEvents) {
          const groupings = event.groupings || [];
          for (const grouping of groupings) {
            const competitions = grouping.competitions || [];
            for (const competition of competitions) {
              // competitions have distinct ids we can use to fetch odds
              allCompetitions.push({ league, event, competition });
            }
          }
        }
      }

      const oddsPairs = await Promise.all(
        allCompetitions.map(async ({ league, competition }) => {
          try {
            const res = await fetch(
              `/api/odds/${league.slug}/${competition.id}`
            );
            const data = await res.json();

            // If the API returns sensible home/away fields use them
            if (data && (data.home !== null || data.away !== null)) {
              return [competition.id, data];
            }

            // Fallback: competition.odds -> moneyline structure
            const moneyline = competition?.odds?.[0]?.moneyline;
            if (moneyline) {
              const fallback = {
                home: moneyline.home?.open?.odds ?? null,
                away: moneyline.away?.open?.odds ?? null,
              };
              return [competition.id, fallback];
            }

            return null;
          } catch (err) {
            console.error(
              `Failed to fetch odds for competition ${competition.id}:`,
              err
            );

            const moneyline = competition?.odds?.[0]?.moneyline;
            if (moneyline) {
              const fallback = {
                home: moneyline.home?.open?.odds ?? null,
                away: moneyline.away?.open?.odds ?? null,
              };
              return [competition.id, fallback];
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

  const toggleGrouping = (leagueId, groupingKey) => {
    setCollapsedGroupings((prev) => {
      const leagueGroups = prev[leagueId] || {};
      return {
        ...prev,
        [leagueId]: {
          ...leagueGroups,
          [groupingKey]: !leagueGroups[groupingKey],
        },
      };
    });
  };

  // Build a mapping of groupingKey -> { displayName, competitions: [ { event, competition } ] }
  const buildGroupingsForLeague = (leagueEvents = []) => {
    const map = new Map();
    for (const event of leagueEvents) {
      // Skip out-of-window events
      if (!isGameInTimeWindow(event.date)) continue;

      const groupings = event.groupings || [];
      if (groupings.length === 0) {
        // Put event into an "Ungrouped" bucket
        const key = "Ungrouped";
        if (!map.has(key))
          map.set(key, { displayName: "Ungrouped", items: [] });
        // Some tennis providers put competitions under event directly; handle both
        const competitions = event.competitions || [];
        if (competitions.length > 0) {
          for (const comp of competitions) {
            map.get(key).items.push({ event, competition: comp });
          }
        } else {
          map.get(key).items.push({
            event,
            competition: {
              id: event.id,
              competitors: event.competitors || [],
              odds: event.odds || [],
            },
          });
        }
      } else {
        for (const grouping of groupings) {
          const displayName =
            grouping.grouping?.displayName ||
            grouping.displayName ||
            "Unknown grouping";
          const key = displayName;
          if (!map.has(key)) map.set(key, { displayName, items: [] });

          const competitions = grouping.competitions || [];
          if (competitions.length > 0) {
            for (const comp of competitions) {
              map.get(key).items.push({ event, competition: comp });
            }
          } else {
            // If no competitions array, fallback to event-level competitors
            map.get(key).items.push({
              event,
              competition: {
                id: event.id,
                competitors: event.competitors || [],
                odds: event.odds || [],
              },
            });
          }
        }
      }
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  };

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
            Live tennis matches — grouped by session / court / grouping
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
              const groupings = buildGroupingsForLeague(leagueEvents);
              if (groupings.length === 0) return null;
              const hasLiveGames = leagueEvents.some(
                (e) =>
                  (e.groupings || []).some((g) =>
                    (g.competitions || []).some(
                      (c) => c.status?.type?.state === "in"
                    )
                  ) || e.status?.type?.state === "in"
              );
              return { league, groupings, hasLiveGames };
            })
            .filter(Boolean)
            .sort((a, b) =>
              a.hasLiveGames && !b.hasLiveGames
                ? -1
                : !a.hasLiveGames && b.hasLiveGames
                ? 1
                : 0
            )
            .map(({ league, groupings }) => (
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
                  <div className="p-6 space-y-6">
                    {groupings.map(
                      ({ key: groupingKey, displayName, items }) => {
                        const grpCollapsed = (collapsedGroupings[league.id] ||
                          {})[groupingKey];
                        return (
                          <div
                            key={groupingKey}
                            className="border border-gray-100 rounded-md overflow-hidden"
                          >
                            <div
                              className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer"
                              onClick={() =>
                                toggleGrouping(league.id, groupingKey)
                              }
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-sm text-gray-600">
                                  {displayName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  ({items.length} match
                                  {items.length !== 1 ? "es" : ""})
                                </div>
                              </div>
                              <div>
                                {grpCollapsed ? (
                                  <ChevronDown className="w-5 h-5" />
                                ) : (
                                  <ChevronUp className="w-5 h-5" />
                                )}
                              </div>
                            </div>

                            {!grpCollapsed && (
                              <div className="p-4 space-y-4">
                                {items.map(({ event, competition }) => {
                                  const compId = competition.id;
                                  const compDate =
                                    competition.startTime ||
                                    event.date ||
                                    competition.date;
                                  const statusState =
                                    competition.status?.type?.state ||
                                    event.status?.type?.state;
                                  const statusLabel =
                                    competition.status?.type?.shortDetail ||
                                    event.status?.type?.shortDetail ||
                                    (statusState === "in"
                                      ? "Live"
                                      : "Scheduled");
                                  const compOdds = odds[compId];
                                  return (
                                    <div
                                      key={compId}
                                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                    >
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                          <Calendar className="w-4 h-4" />
                                          {compDate
                                            ? formatDate(compDate)
                                            : formatDate(event.date)}
                                          <Clock className="w-4 h-4 ml-2" />
                                          {compDate
                                            ? formatTime(compDate)
                                            : formatTime(event.date)}
                                        </div>
                                        <p className="text-sm font-medium text-gray-700">
                                          {competition.shortName ||
                                            competition.name ||
                                            event.shortName ||
                                            event.name}
                                        </p>
                                        <span
                                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                            statusState === "post"
                                              ? "bg-gray-200 text-gray-700"
                                              : statusState === "in"
                                              ? "bg-red-100 text-red-700"
                                              : "bg-blue-100 text-blue-700"
                                          }`}
                                        >
                                          {statusLabel}
                                        </span>
                                      </div>

                                      {/* Competitors for this competition */}
                                      <div className="space-y-2">
                                        {(
                                          competition.competitors ||
                                          event.competitors ||
                                          []
                                        ).map((competitor) => {
                                          const isHome =
                                            competitor.homeAway === "home";
                                          const oddsValue = compOdds
                                            ? isHome
                                              ? compOdds.home
                                              : compOdds.away
                                            : null;
                                          const oddsPercentage =
                                            americanOddsToPercentage(oddsValue);
                                          return (
                                            <div
                                              key={competitor.id}
                                              className="flex items-center justify-between"
                                            >
                                              <div className="flex items-center gap-3">
                                                {competitor.athlete
                                                  ?.headshot && (
                                                  <img
                                                    src={
                                                      competitor.athlete
                                                        .headshot
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
                                                    ?.displayName ||
                                                    competitor.name ||
                                                    "Unknown"}
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
                                                {competitor.score ?? "-"}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Optional round / court info */}
                                      {competition.round?.displayName && (
                                        <div className="mt-3 text-xs text-gray-500">
                                          Round: {competition.round.displayName}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }
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
