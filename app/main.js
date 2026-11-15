// Router + shell: hash routes, a persistent header and footer, one countdown
// ticker, cache-first paints, and the __shotReady contract for screenshots.
// Routes: #/ board · #/bounty/<slug> · #/bounty/<slug>/leaderboard · #/u/<handle>
// The leaderboard and profile modules load later, by literal import() only.

import { API, cachedBody, getBounties, getBounty, seedFor } from './api.js';
import { ago, timeLeft } from './format.js';
import { board, boardList, bounty, errorView, filterBoard, loadingView, notFound, sortBoard } from './views.js';

const app = document.getElementById('app');
const updatedEl = document.getElementById('updated');
let token = 0; // stale-route guard: only the newest route may paint
let lastFetchedAt = 0;
let boardUi = { q: '', sort: 'deadline', page: 1 };
let boardData = null;

function setReady() { window.__shotReady = true; }

function setUpdated(ts) {
  if (ts) lastFetchedAt = ts;
  if (updatedEl) updatedEl.textContent = lastFetchedAt ? `Updated ${ago(lastFetchedAt)}` : '';
}

function focusHeading() {
  const heading = app.querySelector('h1');
  if (heading) heading.focus();
}

/** One 30 s ticker refreshes only the [data-deadline] text nodes — no re-render. */
setInterval(() => {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    const deadline = el.getAttribute('data-deadline');
    if (deadline) el.textContent = timeLeft(deadline);
  }
  setUpdated(0);
}, 30000);

function paint(html, title) {
  app.innerHTML = html;
  document.title = title;
  window.scrollTo(0, 0);
}

function paintBoard() {
  paint(board(boardData, boardUi), 'make.fun bounties');
  wireBoard();
  focusHeading();
  setReady();
}

function wireBoard() {
  const q = document.getElementById('board-q');
  const sort = document.getElementById('board-sort');
  if (q) {
    q.addEventListener('input', () => {
      boardUi.q = q.value;
      boardUi.page = 1;
      refreshBoardList();
    });
  }
  if (sort) {
    sort.addEventListener('change', () => {
      boardUi.sort = sort.value;
      boardUi.page = 1;
      refreshBoardList();
    });
  }
  const pager = document.getElementById('board-pager');
  if (pager) {
    pager.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      boardUi.page = Number(btn.getAttribute('data-page'));
      refreshBoardList();
    });
  }
}

/** Re-render only the list and the pager — never the shell or the filter box. */
function refreshBoardList() {
  const items = sortBoard(filterBoard(boardData.items || [], boardUi.q), boardUi.sort);
  const list = boardList(items, boardUi.page);
  const ul = document.getElementById('board-list');
  const pg = document.getElementById('board-pager');
  if (ul) ul.innerHTML = list.rows;
  if (pg) pg.innerHTML = list.pager;
}

async function routeBoard(my) {
  const cached = cachedBody(`${API}/competitions?status=open&activity=times&limit=100`);
  if (cached) {
    boardData = cached.body;
    paintBoard();
  } else {
    paint(loadingView('bounties'), 'make.fun bounties');
  }
  try {
    const { data, fetchedAt } = await getBounties();
    if (my !== token) return;
    boardData = data;
    setUpdated(fetchedAt);
    paintBoard();
  } catch (err) {
    if (my !== token) return;
    if (!boardData) {
      paint(errorView(err.message), 'make.fun bounties');
      setReady();
    }
  }
}

async function routeBounty(slug, my) {
  const seed = seedFor(slug);
  if (seed) paint(bounty(seed, true), `${seed.title} | make.fun bounties`);
  else paint(loadingView('bounty'), 'make.fun bounties');
  try {
    const { data, fetchedAt } = await getBounty(slug);
    if (my !== token) return;
    setUpdated(fetchedAt);
    paint(bounty(data, false), `${data.title} | make.fun bounties`);
    focusHeading();
    setReady();
  } catch (err) {
    if (my !== token) return;
    if (err.status === 404 || !seed) paint(notFound('bounty', slug), 'Not found | make.fun bounties');
    else paint(bounty(seed, false), `${seed.title} | make.fun bounties`);
    focusHeading();
    setReady();
  }
}

async function routeLeaderboard(slug, my) {
  paint(loadingView('leaderboard'), 'Leaderboard | make.fun bounties');
  try {
    const mod = await import('./leaderboard.js');
    if (my !== token) return;
    await mod.renderLeaderboard(app, slug, my, token, setReady, setUpdated, focusHeading);
  } catch (err) {
    if (my !== token) return;
    paint(errorView(err.message), 'make.fun bounties');
    setReady();
  }
}

async function routeProfile(handle, my) {
  paint(loadingView('profile'), 'Profile | make.fun bounties');
  try {
    const mod = await import('./profile.js');
    if (my !== token) return;
    await mod.renderProfile(app, handle, my, token, setReady, setUpdated, focusHeading);
  } catch (err) {
    if (my !== token) return;
    paint(errorView(err.message), 'make.fun bounties');
    setReady();
  }
}

async function render() {
  window.__shotReady = false;
  const my = ++token;
  const hash = location.hash || '#/';
  const lb = hash.match(/^#\/bounty\/([^/]+)\/leaderboard$/);
  const bp = hash.match(/^#\/bounty\/([^/]+)$/);
  const pf = hash.match(/^#\/u\/([^/]+)$/);
  document.querySelectorAll('[data-nav]').forEach((a) => a.removeAttribute('aria-current'));
  if (lb) await routeLeaderboard(decodeURIComponent(lb[1]), my);
  else if (bp) await routeBounty(decodeURIComponent(bp[1]), my);
  else if (pf) await routeProfile(decodeURIComponent(pf[1]), my);
  else {
    const boardLink = document.querySelector('[data-nav="board"]');
    if (boardLink) boardLink.setAttribute('aria-current', 'page');
    await routeBoard(my);
  }
}

/** Retry buttons in error views re-run the current route. */
app.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) render();
});

/** Header search: a slug on the board jumps to its bounty, anything else to a profile. */
document.getElementById('jump').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('jump-q');
  const value = input.value.trim().replace(/^@/, '');
  if (!value) return;
  const slug = value.toLowerCase();
  const known = (boardData?.items || []).some((b) => b.slug === slug);
  location.hash = known ? `#/bounty/${encodeURIComponent(slug)}` : `#/u/${encodeURIComponent(value)}`;
  input.value = '';
});

window.addEventListener('hashchange', render);
render();
