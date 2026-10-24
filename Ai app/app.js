// DOM helpers
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
// Sample library used when exploring without a Steam profile
const demoGames = [
  { appid: 620, name: 'Portal 2', minutes: 0 },
  { appid: 413150, name: 'Stardew Valley', minutes: 430 },
  { appid: 400, name: 'Portal', minutes: 0 },
  { appid: 570, name: 'Dota 2', minutes: 1260 },
  { appid: 440, name: 'Team Fortress 2', minutes: 350 },
  { appid: 730, name: 'Counter-Strike 2', minutes: 920 },
  { appid: 550, name: 'Left 4 Dead 2', minutes: 0 },
  { appid: 70, name: 'Half-Life', minutes: 90 },
];
const demoDetails = {
  620: {
    description:
      'A puzzle adventure built around portals, experimentation and a very untrustworthy testing facility.',
    genres: ['Puzzle', 'Adventure'],
    developer: 'Valve',
    release: '2011',
    platforms: ['windows', 'mac', 'linux'],
  },
  413150: {
    description:
      'Build a new life in the countryside. Grow crops, make friends and explore at your own pace.',
    genres: ['Farming', 'RPG'],
    developer: 'ConcernedApe',
    release: '2016',
    platforms: ['windows', 'mac', 'linux'],
  },
  400: {
    description:
      'Solve a series of ingenious tests with a portal device. Think your way out of Aperture Science.',
    genres: ['Puzzle'],
    developer: 'Valve',
    release: '2007',
    platforms: ['windows', 'mac', 'linux'],
  },
};
let games = [],
  seen = new Set(),
  version = 0,
  visible = 12,
  loading = false,
  isDemo = false;
const image = (id) =>
  `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;
const hours = (m) =>
  m === 0
    ? 'Not played yet'
    : `${(m / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs played`;
// Library filtering and rendering
function pool() {
  return Picker.filterGames(
    games,
    $('#play-filter').value,
    $('#search').value,
    Number($('#max-hours').value),
  );
}
function render() {
  const list = pool();
  const eligible = list.filter((g) => !$('#avoid-repeat').checked || !seen.has(g.appid));
  $('#pool-count').textContent = eligible.length;
  $('#pick').disabled = loading || !eligible.length;
  $('#library-summary').textContent = `${list.length} matching / ${games.length} total`;
  $('#game-grid').innerHTML =
    list
      .slice(0, visible)
      .map(
        (g) =>
          `<button class="game-card" data-id="${g.appid}"><img src="${image(g.appid)}" alt="" loading="lazy"><div><strong>${esc(g.name)}</strong><span>${hours(g.minutes)}</span></div><span class="game-arrow">↗</span></button>`,
      )
      .join('') ||
    '<p class="small">' +
      (games.length
        ? 'No games match these filters. Try another search, play history or playtime limit.'
        : 'Load your Steam library or try the demo to get started.') +
      '</p>';
  $('#more').hidden = list.length <= visible;
  $('#pick-status').textContent = !list.length
    ? ''
    : !eligible.length
      ? 'You’ve tried every game in this pool! Reset history or allow repeats.'
      : `${seen.size} games picked this session.`;
  if ($('#reroll')) $('#reroll').disabled = $('#pick').disabled;
}
function loadLibrary(data, demo = false) {
  version++;
  games = data.games;
  isDemo = demo;
  seen.clear();
  visible = 12;
  $('#play-filter').value = 'all';
  $('#search').value = '';
  $('#source-label').textContent = demo ? 'DEMO LIBRARY · SAMPLE DATA' : data.source;
  $('#status').textContent =
    `${demo ? 'Demo library' : data.name} loaded — ${games.length} games. ${demo ? 'This is sample data, not your Steam account.' : ''}`;
  render();
  choose();
}
// Server requests and game selection
async function request(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error('Start the app with npm start and open http://localhost:3000.');
  }
  if (!response.ok) throw Error(data.error || 'Could not complete the request.');
  return data;
}
async function choose(id) {
  const g = id
    ? games.find((g) => g.appid === id)
    : Picker.pickGame(pool(), seen, $('#avoid-repeat').checked);
  if (!g) return;
  seen.add(g.appid);
  const token = ++version;
  render();
  $('#selection').innerHTML =
    `<div class="selected-banner"><img src="${image(g.appid)}" alt="${esc(g.name)} artwork"><span class="picked-label">✦ YOUR NEXT GAME</span></div><div class="selected-info"><div class="picked-top"><h2>${esc(g.name)}</h2><span class="playtime">◷ ${hours(g.minutes)}</span></div><div id="details" aria-live="polite"><p class="small">Loading game details…</p></div><div class="game-actions"><a id="launch-game" class="play" href="steam://run/${g.appid}">▶ &nbsp; Play in Steam</a><a class="secondary" href="https://store.steampowered.com/app/${g.appid}/" target="_blank" rel="noreferrer">View store page ↗</a><button class="text-button" id="reroll">Not the vibe? Pick again ⟳</button></div><p class="small launch-note">Launching requires the Steam desktop client and access to this game.</p><div id="launch-help" hidden class="launch-help" role="status"><strong>Steam not opening?</strong><p>This browser may block Steam links. Try the app in Chrome or Edge and allow the Open Steam prompt. On Windows, press <b>Win + R</b> and paste:</p><div class="launch-command"><input id="launch-command" aria-label="Steam launch command" readonly value="steam://run/${g.appid}"><button id="copy-launch" class="secondary">Copy link</button></div><p class="small">Press Enter to ask Windows to open Steam. If Windows cannot open the link, install or repair the Steam desktop client. The app cannot confirm whether a game launched.</p></div></div>`;
  $('#launch-game').onclick = () => {
    $('#launch-help').hidden = false;
  };
  $('#copy-launch').onclick = async () => {
    try {
      await navigator.clipboard.writeText('steam://run/' + g.appid);
      $('#copy-launch').textContent = 'Copied';
    } catch {
      $('#launch-command').focus();
      $('#launch-command').select();
      $('#copy-launch').textContent = 'Press Ctrl+C';
    }
  };
  $('#reroll').onclick = () => choose();
  $('#reroll').disabled = $('#pick').disabled;
  try {
    let d;
    if (isDemo && demoDetails[g.appid]) {
      d = { ...demoDetails[g.appid], sample: true };
    } else if (location.protocol === 'file:') {
      throw Error('Run npm start to load live store information.');
    } else d = await request('/api/game?id=' + g.appid);
    if (token !== version) return;
    const plain = new DOMParser().parseFromString(d.description, 'text/html').body
      .textContent;
    $('#details').innerHTML =
      `<p class="description">${esc(plain)}</p><div class="tags">${d.genres.map((t) => `<span>${esc(t)}</span>`).join('')}</div><dl><div><dt>DEVELOPER</dt><dd>${esc(d.developer || 'Not listed')}</dd></div><div><dt>RELEASED</dt><dd>${esc(d.release)}</dd></div><div><dt>PLATFORMS</dt><dd>${esc(d.platforms.join(' · ') || 'Not listed')}</dd></div>${d.score ? `<div><dt>METACRITIC</dt><dd>${d.score} / 100</dd></div>` : ''}</dl>${d.sample ? '<p class="small">Demo description and metadata. Check the store for current compatibility.</p>' : ''}`;
  } catch (e) {
    if (token === version) $('#details').textContent = e.message;
  }
}
// Profile connection and loading feedback
async function connect(e) {
  e.preventDefault();
  if (loading) return;
  try {
    Picker.parseProfile($('#profile').value);
  } catch (e) {
    $('#status').textContent = e.message;
    return;
  }
  loading = true;
  $('#connect-button').disabled = true;
  $('#demo').disabled = true;
  $('#empty-demo')?.setAttribute('disabled', '');
  $('#connect-button').textContent = 'Loading…';
  $('#status').textContent = 'Fetching your public Steam library…';
  render();
  try {
    if (location.protocol === 'file:')
      throw Error(
        'Live import needs the local server. Run npm start, then open http://localhost:3000.',
      );
    const data = await request(
      '/api/library?profile=' + encodeURIComponent($('#profile').value),
    );
    loadLibrary(data);
    try {
      localStorage.setItem('next-up-profile', $('#profile').value);
    } catch {}
  } catch (e) {
    $('#status').textContent =
      e.name === 'TimeoutError' ? 'Steam took too long. Try again.' : e.message;
  } finally {
    loading = false;
    $('#connect-button').disabled = false;
    $('#demo').disabled = false;
    $('#empty-demo')?.removeAttribute('disabled');
    $('#connect-button').textContent = 'Load my library →';
    render();
  }
}
// User interactions and initial state
$('#profile-form').onsubmit = connect;
function demo() {
  if (!loading) loadLibrary({ games: demoGames }, true);
}
$('#demo').onclick = demo;
$('#empty-demo').onclick = demo;
$('#pick').onclick = () => choose();
$('#reset').onclick = () => {
  seen.clear();
  render();
};
for (const id of ['#play-filter', '#max-hours', '#search', '#avoid-repeat'])
  $(id).addEventListener('input', () => {
    visible = 12;
    render();
  });
$('#more').onclick = () => {
  visible += 24;
  render();
};
$('#game-grid').onclick = (e) => {
  const card = e.target.closest('[data-id]');
  if (card) choose(Number(card.dataset.id));
};
try {
  $('#profile').value = localStorage.getItem('next-up-profile') || '';
} catch {}
render();
