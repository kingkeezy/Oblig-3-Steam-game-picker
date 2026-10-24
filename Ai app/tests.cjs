const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseProfile, parseLibrary, filterGames, pickGame } = require('./core');
const { createServer } = require('./server');
test('accepts vanity URLs and SteamID64', () => {
  assert.deepEqual(parseProfile('https://steamcommunity.com/id/example/'), {
    type: 'id',
    id: 'example',
  });
  assert.equal(parseProfile('76561197960435530').type, 'profiles');
  assert.equal(
    parseProfile('steamcommunity.com/profiles/76561197960435530').id,
    '76561197960435530',
  );
});
test('rejects unsafe hosts and invalid profiles', () => {
  for (const s of [
    'https://evil.com/id/test',
    'https://steamcommunity.com.evil.com/id/test',
    'https://steamcommunity.com/profiles/no',
    'https://user@steamcommunity.com/id/a',
    'http://steamcommunity.com/id/a',
    'https://steamcommunity.com:9000/id/a',
    'https://steamcommunity.com/id/a/other',
  ])
    assert.throws(() => parseProfile(s));
});
test('parses library XML, escaped names, missing playtime and duplicates', () => {
  const x =
    '<steamID><![CDATA[A & B]]></steamID><game><appID>620</appID><name><![CDATA[Portal 2]]></name><hoursOnRecord>1,234.5</hoursOnRecord></game><game><appID>400</appID><name>A &amp; B</name></game><game><appID>400</appID><name>A &amp; B</name></game>';
  const r = parseLibrary(x);
  assert.equal(r.name, 'A & B');
  assert.equal(r.games.length, 2);
  assert.equal(r.games[0].minutes, 74070);
  assert.equal(r.games[1].minutes, 0);
  assert.equal(r.games[1].name, 'A & B');
  assert.equal(parseLibrary('<error>Private</error>').games.length, 0);
});
const games = [
  { appid: 1, name: 'Portal', minutes: 0 },
  { appid: 2, name: 'Stardew Valley', minutes: 60 },
  { appid: 3, name: 'Portal 2', minutes: 20 },
];
test('filters play history and case-insensitive search', () => {
  assert.equal(filterGames(games, 'unplayed', '').length, 1);
  assert.equal(filterGames(games, 'played', 'PORTAL')[0].appid, 3);
  assert.equal(filterGames(games, 'all', 'missing').length, 0);
});
test('playtime limit excludes exact boundary and combines with other filters', () => {
  const library = [
    { appid: 1, name: 'Portal', minutes: 0 },
    { appid: 2, name: 'Portal 2', minutes: 599 },
    { appid: 3, name: 'Other', minutes: 600 },
    { appid: 4, name: 'Other 2', minutes: 601 },
  ];
  assert.deepEqual(
    filterGames(library, 'all', '', 10).map((g) => g.appid),
    [1, 2],
  );
  assert.deepEqual(
    filterGames(library, 'played', 'portal', 10).map((g) => g.appid),
    [2],
  );
  assert.equal(filterGames(library, 'all', '', Infinity).length, 4);
  assert.equal(
    pickGame(filterGames(library, 'all', '', 10), new Set([1]), true, () => 0).appid,
    2,
  );
});
test('random picks honor repeats and exhausted pools', () => {
  assert.equal(pickGame(games, new Set([1, 2]), true, () => 0).appid, 3);
  assert.equal(pickGame(games, new Set([1, 2, 3]), true), null);
  assert.equal(pickGame(games, new Set([1, 2, 3]), false, () => 0).appid, 1);
  assert.equal(pickGame([], new Set()), null);
});
test('HTTP serves app, rejects invalid API input and hides server source', async () => {
  const s = createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  try {
    const base = `http://127.0.0.1:${s.address().port}`;
    const r = await fetch(base);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /NEXT UP/);
    assert.equal(
      (await fetch(base + '/api/library?profile=https://evil.com')).status,
      400,
    );
    assert.equal((await fetch(base + '/api/game?id=abc')).status, 400);
    assert.equal((await fetch(base + '/server.js')).status, 404);
    assert.equal((await fetch(base + '/.env')).status, 404);
  } finally {
    await new Promise((r) => s.close(r));
  }
});
