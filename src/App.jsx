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
      // Fetch the list of leagues
      const leaguesResponse = await fetch(
        "https://sports.core.api.espn.com/v2/sports/soccer/leagues?lang=en&region=us"
      );
      const leaguesData = await leaguesResponse.json();

      if (!leaguesData.items || leaguesData.items.length === 0) {
        setError("No leagues found");
        setLoading(false);
        return;
      }

      // Get first 26 leagues (items 0-25)
      const leagueItems = leaguesData.items.slice(0, 26);

      // Fetch each league's details and events
      const leaguePromises = leagueItems.map(async (item) => {
        try {
          const leagueRes = await fetch(item.$ref);
          const leagueData = await leagueRes.json();

          // Try to fetch events for this league
          let events = [];
          if (leagueData.calendarEndpoint) {
            try {
              const eventsRes = await fetch(leagueData.calendarEndpoint);
              const eventsData = await eventsRes.json();
              events = eventsData;
            } catch (e) {
              console.log(`No events for ${leagueData.name}`);
            }
          }

          return {
            id: leagueData.id,
            name: leagueData.name,
            abbreviation: leagueData.abbreviation,
            slug: leagueData.slug,
            events: events,
          };
        } catch (e) {
          console.error("Error fetching league:", e);
          return null;
        }
      });

      const leaguesResults = await Promise.all(leaguePromises);
      const validLeagues = leaguesResults.filter((l) => l !== null);

      setLeagues(validLeagues);

      // Now fetch scores for each league
      const scoresData = {};
      for (const league of validLeagues) {
        try {
          const scoresRes = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.slug}/scoreboard`
          );
          const data = await scoresRes.json();
          scoresData[league.id] = data.events || [];
        } catch (e) {
          console.log(`No scoreboard for ${league.name}`);
          scoresData[league.id] = [];
        }
      }

      setScores(scoresData);

      // Fetch odds for live games
      const oddsData = {};
      for (const league of validLeagues) {
        const leagueEvents = scoresData[league.id] || [];
        for (const event of leagueEvents) {
          // Only fetch odds for live games
          if (event.status.type.state === "in") {
            try {
              const oddsUrl = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${league.slug}/events/${event.id}/competitions/${event.id}/odds`;
              const oddsRes = await fetch(oddsUrl);
              const oddsResult = await oddsRes.json();

              if (oddsResult.items && oddsResult.items.length > 0) {
                const oddsItem = oddsResult.items[0];
                oddsData[event.id] = {
                  home: oddsItem.homeTeamOdds?.current?.moneyLine?.american,
                  away: oddsItem.awayTeamOdds?.current?.moneyLine?.american,
                };
              }
            } catch (e) {
              console.log(`No odds for event ${event.id}`);
            }
          }
        }
      }

      setOdds(oddsData);
      setLoading(false);
    } catch (err) {
      setError("Failed to fetch data: " + err.message);
      setLoading(false);
    }
  };

  function hasRecentGames(leagueEvents) {
    if (!leagueEvents || leagueEvents.length === 0) return false;

    const now = new Date();
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
    const threeWeeksFromNow = new Date();
    threeWeeksFromNow.setDate(threeWeeksFromNow.getDate() + 21);

    return leagueEvents.some((event) => {
      const eventDate = new Date(event.date);
      // Show if game is within 3 weeks in the past or 3 weeks in the future
      return eventDate >= threeWeeksAgo && eventDate <= threeWeeksFromNow;
    });
  }

  function isGameInTimeWindow(eventDate) {
    const date = new Date(eventDate);
    const now = new Date();
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 4);
    const threeWeeksFromNow = new Date();
    threeWeeksFromNow.setDate(threeWeeksFromNow.getDate() + 8);

    return date >= threeWeeksAgo && date <= threeWeeksFromNow;
  }

  function toggleLeague(leagueId) {
    setCollapsedLeagues((prev) => ({
      ...prev,
      [leagueId]: !prev[leagueId],
    }));
  }

  useEffect(() => {
    fetchLeaguesAndScores();
  }, []);

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function americanOddsToPercentage(americanOdds) {
    if (!americanOdds) return null;

    const odds = parseFloat(americanOdds);
    let probability;

    if (odds > 0) {
      // Positive odds (underdog)
      probability = 100 / (odds + 100);
    } else {
      // Negative odds (favorite)
      probability = Math.abs(odds) / (Math.abs(odds) + 100);
    }

    return (probability * 100).toFixed(1) + "%";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-700">Loading soccer scores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-8 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchLeaguesAndScores}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
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
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="space-y-8">
          {leagues
            .map((league) => {
              const leagueEvents = scores[league.id] || [];
              const filteredEvents = leagueEvents.filter((event) =>
                isGameInTimeWindow(event.date)
              );

              // Hide league if no games are in the time window
              if (filteredEvents.length === 0) {
                return null;
              }

              // Check if league has any live games
              const hasLiveGames = filteredEvents.some(
                (event) => event.status.type.state === "in"
              );

              return {
                league,
                filteredEvents,
                hasLiveGames,
              };
            })
            .filter((item) => item !== null)
            .sort((a, b) => {
              // Prioritize leagues with live games
              if (a.hasLiveGames && !b.hasLiveGames) return -1;
              if (!a.hasLiveGames && b.hasLiveGames) return 1;
              return 0;
            })
            .map(({ league, filteredEvents, hasLiveGames }) => (
              <div
                key={league.id}
                className="bg-white rounded-lg shadow-lg overflow-hidden"
              >
                <div
                  className="bg-green-600 text-white px-6 py-4 cursor-pointer hover:bg-green-700 transition-colors flex items-center justify-between"
                  onClick={() => toggleLeague(league.id)}
                >
                  <div>
                    <h2 className="text-2xl font-bold">{league.name}</h2>
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
                              {event.competitions[0].competitors.map(
                                (team, idx) => {
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
                                          />
                                        )}
                                        <span
                                          className={`font-semibold ${
                                            team.winner
                                              ? "text-green-700"
                                              : "text-gray-700"
                                          }`}
                                        >
                                          {team.team.displayName}
                                        </span>
                                        {event.status.type.state === "in" &&
                                          oddsPercentage && (
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
                                }
                              )}
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
