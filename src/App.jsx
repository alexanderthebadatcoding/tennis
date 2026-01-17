import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Trophy,
  Calendar,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard";

export default function App() {
  const [events, setEvents] = useState([]);
  const [odds, setOdds] = useState({});
  const [loading, setLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [collapsedTournaments, setCollapsedTournaments] = useState({});

  /* ---------------- FETCH + FALLBACK ---------------- */

  const extractOdds = useCallback((eventsList) => {
    const map = {};
    eventsList.forEach((event) => {
      // event-level competitions
      (event.competitions || []).forEach((c) => {
        const o = c.odds?.[0];
        if (!o) return;
        map[c.id] = {
          home: o.moneyline?.home?.open?.odds ?? o.homePrice ?? null,
          away: o.moneyline?.away?.open?.odds ?? o.awayPrice ?? null,
        };
      });

      // grouping-level competitions
      (Array.isArray(event.groupings)
        ? event.groupings
        : event.groupings
          ? [event.groupings]
          : []
      ).forEach((g) => {
        (g.competitions || []).forEach((c) => {
          const o = c.odds?.[0];
          if (!o) return;
          map[c.id] = {
            home: o.moneyline?.home?.open?.odds ?? o.homePrice ?? null,
            away: o.moneyline?.away?.open?.odds ?? o.awayPrice ?? null,
          };
        });
      });
    });
    setOdds(map);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

    // Try ESPN first. If it fails for any reason (network/CORS/non-ok/no events),
    // fall back to our server-side proxy at /api/scoreboard/atp
    let data = null;
    try {
      const res = await fetch(ESPN_SCOREBOARD);
      if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status}`);
      data = await res.json();

      // If the payload doesn't have events (or empty), treat as failure and try fallback.
      if (!data || !Array.isArray(data.events) || data.events.length === 0) {
        throw new Error("ESPN returned no events");
      }
    } catch (espnErr) {
      // Fallback: try local API route (server-side handler) to avoid CORS issues
      console.warn(
        "ESPN fetch failed, falling back to /api/scoreboard/atp",
        espnErr,
      );
      try {
        const res2 = await fetch("/api/scoreboard/atp");
        if (!res2.ok) throw new Error(`Local API fetch failed: ${res2.status}`);
        data = await res2.json();
        data = data || { events: [] };
      } catch (localErr) {
        console.error("Fallback fetch to /api/scoreboard/atp failed", localErr);
        data = { events: [] };
      }
    }

    try {
      const evts = Array.isArray(data.events) ? data.events : [];
      setEvents(evts);
      extractOdds(evts);
    } finally {
      setLoading(false);
    }
  }, [extractOdds]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------- HELPERS ---------------- */

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "";

  const formatTime = (d) =>
    d
      ? new Date(d).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

  const getBroadcastNames = (competition, event) => {
    const raw =
      competition?.broadcast ||
      competition?.broadcasts ||
      event?.broadcast ||
      event?.broadcasts;

    if (!raw) return [];

    if (Array.isArray(raw)) {
      return raw
        .map(
          (b) =>
            b?.name || b?.shortName || b?.network || b?.callLetters || null,
        )
        .filter(Boolean);
    }

    if (typeof raw === "object") {
      if (Array.isArray(raw.names)) return raw.names.filter(Boolean);
      return [
        raw.name || raw.shortName || raw.network || raw.callLetters,
      ].filter(Boolean);
    }

    if (typeof raw === "string") return [raw];

    return [];
  };

  // We keep collapsedGroups as a flat map keyed by `${tournamentName}||${groupName}`
  const toggleGroup = (uniqueKey) =>
    setCollapsedGroups((p) => ({ ...p, [uniqueKey]: !p[uniqueKey] }));

  const toggleTournament = (tournamentName) =>
    setCollapsedTournaments((p) => ({
      ...p,
      [tournamentName]: !p[tournamentName],
    }));

  /* ---------------- GROUPING: tournaments -> groupings -> items ---------------- */

  const tournaments = useMemo(() => {
    const map = new Map();

    for (const event of events) {
      const tournamentName =
        event?.tournament?.name ||
        event?.league?.name ||
        event.shortName ||
        event.name ||
        (event.date ? formatDate(event.date) : "Tournament");

      if (!map.has(tournamentName)) {
        map.set(tournamentName, new Map()); // inner map of groupingKey -> groupingEntry
      }
      const groupingsMap = map.get(tournamentName);

      const groupingsArray = Array.isArray(event.groupings)
        ? event.groupings
        : event.groupings
          ? [event.groupings]
          : [];

      if (groupingsArray.length > 0) {
        for (const g of groupingsArray) {
          const displayName =
            g.grouping?.displayName ||
            g.grouping?.shortName ||
            g.displayName ||
            g.shortName ||
            event.shortName ||
            event.name ||
            "Matches";

          const groupingKey = `${tournamentName}||${displayName}`;

          if (!groupingsMap.has(groupingKey)) {
            groupingsMap.set(groupingKey, {
              key: groupingKey,
              displayName,
              items: [],
            });
          }
          const groupingEntry = groupingsMap.get(groupingKey);

          const comps = Array.isArray(g.competitions)
            ? g.competitions
            : g.competitions
              ? [g.competitions]
              : [];

          if (comps.length > 0) {
            for (const comp of comps) {
              groupingEntry.items.push({ event, competition: comp });
            }
          } else {
            const eventComps = Array.isArray(event.competitions)
              ? event.competitions
              : [];
            if (eventComps.length > 0) {
              for (const comp of eventComps)
                groupingEntry.items.push({ event, competition: comp });
            } else {
              groupingEntry.items.push({
                event,
                competition: {
                  id: event.id,
                  competitors: event.competitors || [],
                  odds: g.odds || event.odds || [],
                  broadcast:
                    g.broadcast ||
                    g.broadcasts ||
                    event.broadcast ||
                    event.broadcasts,
                },
              });
            }
          }
        }
      } else {
        const displayName =
          event.shortName ||
          event.name ||
          (event.date ? formatDate(event.date) : "Matches");
        const groupingKey = `${tournamentName}||${displayName}`;

        if (!groupingsMap.has(groupingKey)) {
          groupingsMap.set(groupingKey, {
            key: groupingKey,
            displayName,
            items: [],
          });
        }
        const groupingEntry = groupingsMap.get(groupingKey);

        const eventComps = Array.isArray(event.competitions)
          ? event.competitions
          : [];
        if (eventComps.length > 0) {
          for (const comp of eventComps)
            groupingEntry.items.push({ event, competition: comp });
        } else {
          groupingEntry.items.push({
            event,
            competition: {
              id: event.id,
              competitors: event.competitors || [],
              odds: event.odds || [],
              broadcast: event.broadcast || event.broadcasts,
            },
          });
        }
      }
    }

    return Array.from(map.entries()).map(([tournamentName, groupMap]) => ({
      tournamentName,
      groupings: Array.from(groupMap.values()),
    }));
  }, [events]);

  /* ---------------- RENDER ---------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-10 h-10 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-10 h-10 text-green-600" />
            <h1 className="text-4xl font-bold">Tennis Scoreboard</h1>
          </div>
          <button
            onClick={load}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </header>

        {tournaments.map((tournament) => {
          const isTournamentCollapsed =
            !!collapsedTournaments[tournament.tournamentName];
          return (
            <div key={tournament.tournamentName} className="space-y-4">
              <div className="bg-white rounded shadow overflow-hidden">
                <div
                  className="px-6 py-4 bg-green-600 text-white flex items-center justify-between cursor-pointer"
                  onClick={() => toggleTournament(tournament.tournamentName)}
                >
                  <h2 className="text-2xl font-bold">
                    {tournament.tournamentName}
                  </h2>
                  <div>
                    {isTournamentCollapsed ? <ChevronDown /> : <ChevronUp />}
                  </div>
                </div>

                {!isTournamentCollapsed && (
                  <div className="p-6 space-y-6">
                    {tournament.groupings.map(
                      ({ key: groupingKey, displayName, items }) => {
                        const collapsed = !!collapsedGroups[groupingKey];

                        return (
                          <div
                            key={groupingKey}
                            className="border border-gray-100 rounded-md overflow-hidden"
                          >
                            <div
                              onClick={() => toggleGroup(groupingKey)}
                              className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer"
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
                                {collapsed ? <ChevronDown /> : <ChevronUp />}
                              </div>
                            </div>

                            {!collapsed && (
                              <div className="p-4 space-y-4">
                                {items.map(({ event, competition }) => {
                                  const compId = competition.id;
                                  const compDate =
                                    competition.startDate ||
                                    event.date ||
                                    competition.date;
                                  const state =
                                    competition.status?.type?.state ||
                                    event.status?.type?.state;
                                  const statusLabel =
                                    competition.status?.type?.shortDetail ||
                                    event.status?.type?.shortDetail ||
                                    (state === "in" ? "Live" : "Scheduled");
                                  const compOdds = odds[compId];
                                  const broadcasts = getBroadcastNames(
                                    competition,
                                    event,
                                  );

                                  return (
                                    <div
                                      key={compId}
                                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                    >
                                      <div className="flex justify-between mb-3">
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

                                        <span
                                          className={`px-3 py-1 rounded-full text-sm ${state === "in" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}
                                        >
                                          {statusLabel}
                                        </span>
                                      </div>

                                      {broadcasts.length > 0 && (
                                        <div className="flex gap-2 mb-2">
                                          {broadcasts.map((b, i) => (
                                            <span
                                              key={i}
                                              className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded"
                                            >
                                              {b}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      <div className="space-y-2">
                                        {(
                                          competition.competitors ||
                                          event.competitors ||
                                          []
                                        ).map((c) => {
                                          const o =
                                            c.homeAway === "home"
                                              ? compOdds?.home
                                              : compOdds?.away;
                                          const lines = Array.isArray(
                                            c.linescores,
                                          )
                                            ? c.linescores
                                            : Array.isArray(c.linescore)
                                              ? c.linescore
                                              : [];

                                          return (
                                            <div
                                              key={c.id}
                                              className="flex justify-between items-center"
                                            >
                                              <span
                                                className={`font-semibold ${c.winner ? "text-green-700" : ""}`}
                                              >
                                                {c.athlete?.displayName ||
                                                  c.roster?.shortDisplayName ||
                                                  c.name ||
                                                  "TBD"}
                                              </span>

                                              <div className="flex gap-2 items-center">
                                                {lines.map((ls, i) => (
                                                  <span
                                                    key={i}
                                                    className={`px-2 py-1 text-xs rounded ${ls.winner ? "bg-green-200" : "bg-gray-100"}`}
                                                  >
                                                    {ls.value ?? "-"}
                                                  </span>
                                                ))}
                                                {o != null && (
                                                  <span className="text-xs bg-blue-100 px-2 py-1 rounded">
                                                    {o}
                                                  </span>
                                                )}
                                                <span className="text-2xl font-bold">
                                                  {c.score ?? ""}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {(competition.round?.displayName ||
                                        competition.venue?.court) && (
                                        <div className="mt-3 text-xs text-gray-500">
                                          {competition.round?.displayName}
                                          {competition.round?.displayName &&
                                            competition.venue?.court &&
                                            " · "}
                                          {competition.venue?.court}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
