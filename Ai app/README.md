# Next Up — Steam game picker

A student prototype that solves choice overload: paste a public Steam profile, randomly select an owned game, and discover its playtime and store information. Steam-inspired navy, charcoal, cyan and green styling with original Next Up branding. Not affiliated with Valve.

## Run

Requires Node.js 20+. Run `npm start` and open http://localhost:3000. No dependencies to install. Live imports need internet access from the server. Opening index.html directly supports demo selection, but not live import. Remote game artwork requires internet.

## Three main features

1. Import games from a public Steam profile URL or SteamID64.
2. Random selection with played/unplayed filters, title search and repeat avoidance. Reset history when the pool is exhausted.
3. Show playtime, description, genres, developer, release date, platforms and Metacritic score when available. Open the store or launch with the Steam client.

Demo data is explicitly labelled and does not represent your account. Some demo descriptions and metadata are bundled; other details are fetched from Steam. Metadata failures do not block game selection or store links. Zero playtime may reflect hidden playtime, so it does not prove a game has never been played.

## Real Steam libraries

Your profile and Game details must be Public. Paste https://steamcommunity.com/id/YOURNAME or https://steamcommunity.com/profiles/YOUR_STEAMID64.

The default key-free import tries Steam's deprecated community XML feed. It may be unavailable even for public profiles. The supported official Web API requires your own Steam API key from https://steamcommunity.com/dev/apikey. Set it on the server only:

```powershell
$env:STEAM_API_KEY = 'YOUR_OWN_KEY'
npm start
```

The server reads environment variables, not .env files. Never commit a real key or enter a Steam password into this app. The API key stays on the server. Outbound requests are restricted to fixed Steam hosts; profile links are validated. The server binds to localhost. Before public deployment, configure host binding and rate limiting. Only the last profile field is saved in local browser storage; libraries and pick history are held in memory.

References: [GetOwnedGames](https://partner.steamgames.com/doc/webapi/IPlayerService), [ResolveVanityURL](https://partner.steamgames.com/doc/webapi/ISteamUser), [XML deprecation](https://partner.steamgames.com/documentation/community_data). Store metadata uses Steam's public appdetails endpoint, which is not a guaranteed supported Web API contract. Errors are shown when it is unavailable.

## Testing

Run `npm test`. Tests cover profile validation, XML parsing, filtering, random selection, repeat avoidance, empty pools and local HTTP routes.

Manual checks to perform:

- Try the demo; verify its sample label, eight games and selected-game details.
- Pick until the pool is exhausted. Reset history; verify picks are available again.
- Filter unplayed and search Portal; only matching zero-playtime titles remain.
- Load your public profile and compare titles and playtime with Steam.
- Try an invalid link and a private profile; verify helpful errors and preserved previous results.
- Select different games rapidly; older metadata responses must not overwrite the latest pick.
- Test phone layout, Tab navigation, store links and Steam launching.

Only claim manual checks you actually performed. Real imports and live metadata require network verification.

## Assignment submission

**Description:** 

Next Up helps Steam users decide what to play. It imports a public game library, offers random selection with played/unplayed filters, and provides game information and quick links to play. It is a fun way to pick your next game.

**AI use:** AI helped create the Steam inspired interface, implement Steam integration and random selection, and write tests. The idea is from me.

**3 min demo:** 
link: https://www.youtube.com/watch?v=k6ufvLHOQcA

