const tls = require('node:tls');
// Include locally trusted certificates without disabling HTTPS verification.
if (
  typeof tls.setDefaultCACertificates === 'function' &&
  typeof tls.getCACertificates === 'function'
)
  tls.setDefaultCACertificates([
    ...tls.getCACertificates('default'),
    ...tls.getCACertificates('system'),
  ]);
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { parseProfile, parseLibrary } = require('./core');
const apiKey = process.env.STEAM_API_KEY;
const cache = new Map();
// Steam requests: validate destinations and handle redirects safely.
async function upstream(url, json = true) {
  const allowed = new Set([
    'steamcommunity.com',
    'api.steampowered.com',
    'store.steampowered.com',
  ]);
  const signal = AbortSignal.timeout(18000);
  for (let hop = 0; hop < 6; hop++) {
    const target = new URL(url);
    if (
      target.protocol !== 'https:' ||
      !allowed.has(target.hostname) ||
      target.port ||
      target.username ||
      target.password
    )
      throw Error('Steam redirected to an unsupported address.');
    let r;
    try {
      r = await fetch(target, { signal, redirect: 'manual' });
    } catch (e) {
      const code = e.cause?.code || e.name;
      throw Error(
        `Steam connection failed (${code}). ${code === 'ENOTFOUND' ? 'Windows could not resolve the Steam address.' : code.includes('CERT') || code.includes('SIGNATURE') ? 'Node could not verify the Steam certificate. Start with node --use-system-ca server.js.' : 'Check firewall, VPN or proxy settings for Node.js.'}`,
      );
    }
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const location = r.headers.get('location');
      await r.body?.cancel();
      if (!location) throw Error('Steam sent a redirect without a destination.');
      const next = new URL(location, target);
      if (next.hostname !== target.hostname)
        throw Error(
          'Steam redirected to another host. Try your numeric SteamID64 profile link.',
        );
      url = next.href;
      continue;
    }
    if (!r.ok)
      throw Error('Steam is unavailable or rate-limiting requests. Try again shortly.');
    return json ? r.json() : r.text();
  }
  throw Error('Steam sent too many redirects. Try your numeric SteamID64 profile link.');
}
// Import a library through the official API or the public legacy feed.
async function library(profile) {
  const p = parseProfile(profile);
  if (apiKey) {
    let id = p.id;
    if (p.type === 'id') {
      const d = await upstream(
        'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?' +
          new URLSearchParams({ key: apiKey, vanityurl: p.id }),
      );
      id = d.response?.steamid;
      if (!id) throw Error('Steam profile not found. Check your link.');
    }
    const d = await upstream(
      'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?' +
        new URLSearchParams({
          key: apiKey,
          steamid: id,
          include_appinfo: 'true',
          include_played_free_games: 'true',
        }),
    );
    if (!d.response?.games?.length)
      throw Error(
        'No games visible. Check that your profile and Game details are public and you own games.',
      );
    return {
      name: 'Steam library',
      source: 'Steam Web API',
      games: d.response.games.map((g) => ({
        appid: g.appid,
        name: g.name || `Game ${g.appid}`,
        minutes: g.playtime_forever || 0,
      })),
    };
  }
  const xml = await upstream(
    `https://steamcommunity.com/${p.type}/${encodeURIComponent(p.id)}/games/?tab=all&xml=1`,
    false,
  );
  const result = parseLibrary(xml);
  if (!result.games.length)
    throw Error(
      'Steam did not expose a public library. Check profile and Game details privacy settings. If public, configure STEAM_API_KEY on the server: the legacy key-free feed may be unavailable. Try the demo meanwhile.',
    );
  return { ...result, source: 'Steam public legacy feed' };
}
// Cache store metadata to avoid repeatedly fetching the same game.
async function details(id) {
  if (cache.has(id) && Date.now() - cache.get(id).at < 3600000) return cache.get(id).data;
  const p = await upstream(
    `https://store.steampowered.com/api/appdetails?appids=${id}&l=english`,
  );
  const d = p[id]?.data;
  if (!p[id]?.success || !d) throw Error('Unavailable');
  const data = {
    description: d.short_description || '',
    genres: (d.genres || []).map((x) => x.description),
    developer: (d.developers || []).join(', '),
    release: d.release_date?.date || 'Not listed',
    platforms: Object.keys(d.platforms || {}).filter((k) => d.platforms[k]),
    score: d.metacritic?.score ?? null,
  };
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(id, { at: Date.now(), data });
  return data;
}
// Only these public assets are served to the browser.
const files = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/style.css': 'style.css',
  '/app.js': 'app.js',
  '/core.js': 'core.js',
};
function createServer() {
  return http.createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(data));
    };
    try {
      const u = new URL(req.url, 'http://localhost');
      if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
      if (u.pathname === '/api/library') {
        try {
          return send(200, await library(u.searchParams.get('profile') || ''));
        } catch (e) {
          return send(400, {
            error:
              e.name === 'TimeoutError'
                ? 'Steam timed out. Try again.'
                : e.message === 'fetch failed'
                  ? 'Cannot reach Steam. Check the server internet connection.'
                  : e.message,
          });
        }
      }
      if (u.pathname === '/api/game') {
        const id = u.searchParams.get('id');
        if (!/^\d{1,10}$/.test(id || '') || Number(id) < 1)
          return send(400, { error: 'Invalid game ID' });
        try {
          return send(200, await details(id));
        } catch {
          return send(502, {
            error:
              'Store details unavailable right now. You can still open the Steam store page.',
          });
        }
      }
      const file = files[u.pathname];
      if (!file) return send(404, { error: 'Not found' });
      const contents = await fs.readFile(path.join(__dirname, file));
      res.writeHead(200, {
        'Content-Type':
          { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[
            path.extname(file)
          ] + '; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(contents);
    } catch {
      send(500, { error: 'Something went wrong. Please retry.' });
    }
  });
}
if (require.main === module)
  createServer().listen(Number(process.env.PORT) || 3000, '127.0.0.1', () =>
    console.log('Next Up: http://localhost:' + (process.env.PORT || 3000)),
  );
module.exports = { createServer };
