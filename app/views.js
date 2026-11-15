// Board and bounty renderers: API data → escaped HTML strings. No fetching here.

import { dateShort, dateTime, esc, isOpen, money, plural, statusBadge, timeLeft, whole } from './format.js';

export const PER_PAGE = 20;

/** The reward as it stands now: the prize plus the entry fees paid into it. */
export const pot = (b) => money(b.potUsd ?? b.rewardAmount);
const fee = (b) => (b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free');
const soon = (b) => {
  const ms = new Date(b.deadline || 0).getTime() - Date.now();
  return ms > 0 && ms < 86400000;
};

/** Sort: open bounties first, then by the chosen key. */
export function sortBoard(items, sort) {
  const key = (b) => (sort === 'pot' ? -Number(b.potUsd ?? b.rewardAmount ?? 0)
    : sort === 'entries' ? -(b.submissionCount ?? 0)
    : new Date(b.deadline || 0).getTime());
  return [...items].sort((a, b) => {
    if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
    return key(a) - key(b);
  });
}

export function filterBoard(items, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((b) => `${b.title} ${b.slug} ${b.category || ''} ${b.sponsor?.name || ''}`
    .toLowerCase().includes(needle));
}

function boardCard(b) {
  const open = isOpen(b);
  const summary = (b.summary || '').length > 220 ? `${b.summary.slice(0, 220)}…` : (b.summary || '');
  return `<li class="card">
    <h2><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h2>
    <p class="meta">${esc(b.category || '')}${b.sponsor?.name ? ` · by ${esc(b.sponsor.name)}` : ''}</p>
    <p class="summary">${esc(summary)}</p>
    <dl class="facts">
      <div><dt>Live pot</dt><dd class="pot">${pot(b)}</dd></div>
      <div><dt>Entry fee</dt><dd>${fee(b)}</dd></div>
      <div><dt>Time left</dt><dd data-deadline="${esc(b.deadline || '')}">${timeLeft(b.deadline)}</dd></div>
      <div><dt>Entries</dt><dd>${plural(b.submissionCount ?? 0, 'entry')}</dd></div>
    </dl>
    <p class="card-foot"><span class="badge ${open ? 'open' : 'closed'}">${esc(statusBadge(b))}</span>
    ${soon(b) ? '<span class="tag soon">Closing soon</span>' : ''}
    <a class="lb-link" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a></p>
  </li>`;
}

export function boardList(items, page) {
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const current = Math.min(Math.max(1, page), pages);
  const slice = items.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  return {
    rows: slice.map(boardCard).join('') || '<li class="empty">No bounties match that filter.</li>',
    pager: pages > 1
      ? `<p class="pager"><button type="button" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>← Prev</button> <span>Page ${current} of ${pages} · ${items.length} bounties</span> <button type="button" data-page="${current + 1}" ${current === pages ? 'disabled' : ''}>Next →</button></p>`
      : `<p class="pager"><span>${items.length} bounties</span></p>`,
  };
}

/** Totals across the open board: how many bounties, how much money, how many entries. */
export function boardStats(items) {
  const open = items.filter(isOpen);
  const totalPot = open.reduce((sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const totalEntries = open.reduce((sum, b) => sum + Number(b.submissionCount ?? 0), 0);
  return `<dl class="stats">
    <div><dt>Open bounties</dt><dd>${whole(open.length)}</dd></div>
    <div><dt>Combined live pots</dt><dd class="pot">${money(totalPot)}</dd></div>
    <div><dt>Entries so far</dt><dd>${whole(totalEntries)}</dd></div>
  </dl>`;
}

export function board(data, ui) {
  const items = sortBoard(filterBoard(data.items || [], ui.q), ui.sort);
  const list = boardList(items, ui.page);
  return `<h1 tabindex="-1">Open bounties</h1>
  <p class="lede">Live pots, entry fees and time left — straight from the make.fun public API.</p>
  ${boardStats(data.items || [])}
  <form class="controls" id="board-controls" role="search" aria-label="Filter bounties">
    <label>Filter <input type="search" id="board-q" value="${esc(ui.q)}" placeholder="Search title, slug, category" autocomplete="off"></label>
    <label>Sort <select id="board-sort">
      <option value="deadline"${ui.sort === 'deadline' ? ' selected' : ''}>Soonest deadline</option>
      <option value="pot"${ui.sort === 'pot' ? ' selected' : ''}>Largest pot</option>
      <option value="entries"${ui.sort === 'entries' ? ' selected' : ''}>Most entries</option>
    </select></label>
  </form>
  <ul class="board" id="board-list">${list.rows}</ul>
  <div id="board-pager">${list.pager}</div>`;
}

/** Small safe markdown: escape first, then headings, bold, code, lists, make.fun links. */
export function md(text) {
  const lines = esc(text || '').split('\n');
  let out = '';
  let inList = false;
  const inline = (s) => s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https:\/\/make\.fun[^)\s]*)\)/g, '<a href="$2">$1</a>');
  const closeList = () => { if (inList) { out += '</ul>'; inList = false; } };
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('## ')) { closeList(); out += `<h3>${inline(t.slice(3))}</h3>`; }
    else if (t.startsWith('# ')) { closeList(); out += `<h3>${inline(t.slice(2))}</h3>`; }
    else if (/^[-*] /.test(t)) {
      if (!inList) { out += '<ul>'; inList = true; }
      out += `<li>${inline(t.slice(2))}</li>`;
    } else if (t === '') { closeList(); }
    else { closeList(); out += `<p>${inline(t)}</p>`; }
  }
  closeList();
  return out;
}

function rewardsTable(b) {
  const now = b.rewardsNow;
  if (Array.isArray(now) && now.length) {
    const rows = now.map((r) => `<tr><td>${esc(r.place)}</td><td>${money(r.baseUsd)}</td><td>${money(r.feeShareUsd)}</td><td class="pot">${money(r.amountUsd)}</td></tr>`).join('');
    return `<table class="rewards"><caption>Rewards with the live pot (${pot(b)}) — prize plus each place's share of the entry fees</caption><thead><tr><th scope="col">Place</th><th scope="col">Prize</th><th scope="col">Fee share</th><th scope="col">Total</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const map = b.rewards || {};
  const rows = Object.keys(map)
    .sort((a, c) => Number(a) - Number(c))
    .map((place) => `<tr><td>${esc(place)}</td><td colspan="2">${money(map[place])}</td><td class="pot">${money(map[place])}</td></tr>`).join('');
  return rows
    ? `<table class="rewards"><caption>Rewards (live pot ${pot(b)})</caption><thead><tr><th scope="col">Place</th><th scope="col" colspan="2">Prize</th><th scope="col">Total</th></tr></thead><tbody>${rows}</tbody></table>`
    : '';
}

export function bounty(b, partial) {
  const open = isOpen(b);
  const rules = b.rules || '';
  const ruleCount = rules ? rules.split('\n').length : 0;
  const feeNote = b.entryFeeUsd
    ? `Entering costs ${money(b.entryFeeUsd)} once per account, and every fee paid joins the pot.`
    : 'Entering this bounty is free.';
  return `<p class="crumb"><a href="#/">← All bounties</a></p>
  <h1 tabindex="-1">${esc(b.title)}</h1>
  <p><span class="badge ${open ? 'open' : 'closed'}">${esc(statusBadge(b))}</span>
  ${b.category ? `<span class="tag">${esc(b.category)}</span>` : ''}
  ${b.sponsor?.name ? `<span class="tag">by ${esc(b.sponsor.name)}</span>` : ''}</p>
  <p class="lede">${esc(b.summary || '')}</p>
  <dl class="facts bounty-facts">
    <div><dt>Live pot</dt><dd class="pot">${pot(b)}</dd></div>
    <div><dt>Entry fee</dt><dd>${fee(b)}</dd></div>
    <div><dt>Deadline</dt><dd><span data-deadline="${esc(b.deadline || '')}">${timeLeft(b.deadline)}</span> · ${dateTime(b.deadline)}</dd></div>
    <div><dt>Entries</dt><dd>${plural(b.submissionCount ?? 0, 'entry')}</dd></div>
    ${b.opensAt ? `<div><dt>Opens</dt><dd>${dateTime(b.opensAt)}</dd></div>` : ''}
    ${b.publishedAt ? `<div><dt>Published</dt><dd>${dateShort(b.publishedAt)}</dd></div>` : ''}
    ${b.resolvedAt ? `<div><dt>Resolved</dt><dd>${dateTime(b.resolvedAt)}</dd></div>` : ''}
    ${b.placementsHeld ? '<div><dt>Placements</dt><dd>Held until results are published</dd></div>' : ''}
  </dl>
  <p><a class="button" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard</a>
  <a class="button ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">Open on make.fun</a></p>
  <p class="fine">${feeNote}</p>
  ${rewardsTable(b)}
  <h2>Description</h2>
  <div class="description">${b.description ? md(b.description) : '<p>No description yet.</p>'}</div>
  ${b.skills?.length ? `<h2>Skills</h2><p>${b.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join(' ')}</p>` : ''}
  ${partial ? '<p class="status" role="status">Loading the full details…</p>' : ''}
  ${rules ? `<details><summary>Rules (${ruleCount} lines — the full competition rules)</summary><div class="rules">${md(rules)}</div></details>` : ''}
  <p class="fine">Whether it still takes entries is judged by the deadline, not the status alone. ${b.acceptingSubmissions === false && open ? 'Note: the API reports acceptingSubmissions false, but the deadline has not passed, so entries are still open.' : ''}</p>`;
}

export function errorView(message) {
  return `<h1 tabindex="-1">Couldn’t load this page</h1>
  <p role="alert">${esc(message || 'The make.fun API did not answer.')}</p>
  <p><button type="button" data-retry>Retry</button> <a href="#/">Back to the board</a></p>`;
}

export function notFound(kind, name) {
  return `<h1 tabindex="-1">Not found</h1>
  <p>No ${esc(kind)} matches “${esc(name)}” on make.fun.</p>
  <p><a href="#/">Back to the board</a></p>`;
}

export function loadingView(what) {
  return `<p class="status" role="status" aria-live="polite">Loading ${esc(what)}…</p>`;
}
