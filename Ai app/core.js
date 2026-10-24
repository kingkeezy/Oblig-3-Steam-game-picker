(function (root) {
  function parseProfile(input) {
    const value = String(input).trim();
    if (/^\d{17}$/.test(value)) return { type: 'profiles', id: value };
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value);
    } catch {
      throw Error('Enter a Steam profile URL or a 17-digit SteamID64.');
    }
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'steamcommunity.com' ||
      url.port ||
      url.username ||
      url.password
    )
      throw Error(
        'Use a https://steamcommunity.com/id/name or /profiles/SteamID64 link.',
      );
    const m = url.pathname.match(/^\/(id|profiles)\/([a-zA-Z0-9_-]+)\/?$/);
    if (!m || (m[1] === 'profiles' && !/^\d{17}$/.test(m[2])))
      throw Error('That is not a valid Steam profile link.');
    return { type: m[1], id: m[2] };
  }
  function filterGames(games, mode, query, maxHours = Infinity) {
    return games.filter(
      (g) =>
        (mode === 'all' || (mode === 'unplayed' ? g.minutes === 0 : g.minutes > 0)) &&
        g.minutes < maxHours * 60 &&
        g.name.toLowerCase().includes(query.toLowerCase().trim()),
    );
  }
  function pickGame(games, seen, avoid = true, random = Math.random) {
    const pool = games.filter((g) => !avoid || !seen.has(g.appid));
    return pool.length ? pool[Math.floor(random() * pool.length)] : null;
  }
  function decode(s) {
    return String(s)
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }
  function parseLibrary(xml) {
    const tag = (s, t) =>
      decode(s.match(new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>', 'i'))?.[1] || '');
    const games = [...xml.matchAll(/<game>([\s\S]*?)<\/game>/g)]
      .map((m) => ({
        appid: Number(tag(m[1], 'appID')),
        name: tag(m[1], 'name'),
        minutes:
          Math.round(Number(tag(m[1], 'hoursOnRecord').replace(/,/g, '')) * 60) || 0,
      }))
      .filter((g) => Number.isSafeInteger(g.appid) && g.appid > 0 && g.name);
    return {
      name: tag(xml, 'steamID') || 'Steam player',
      games: [...new Map(games.map((g) => [g.appid, g])).values()],
    };
  }
  const api = { parseProfile, filterGames, pickGame, parseLibrary };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Picker = api;
})(globalThis);
