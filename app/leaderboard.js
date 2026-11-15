// Leaderboard view — loaded later by import(). Columns come from the API
// (they differ per harness); values are shown in their real units by cellValue().
// 25 rows a page, phase and view switchers re-fetch a single request each.

import { getLeaderboard } from './api.js';
import { cellValue, dateTime, esc, plural } from './format.js';
import { errorView, loadingView, notFound } from './views.js';

const PER_PAGE = 25;
let previousClick = null;

function entryImage(e) {
  // Entry images may be relative /api/... paths: they live on make.fun.
  if (!e.image) return '';
  return e.image.startsWith('http') ? e.image : `https://make.fun${e.image}`;
}

function entryCard(e, cols) {
  const img = entryImage(e)
    ? `<img class="thumb" crossorigin="anonymous" referrerpolicy="no-referrer" src="${esc(entryImage(e))}" alt="" loading="lazy">`
    : '';
  const cells = cols.map((c) => `<div><dt>${esc(c.title)}</dt><dd>${esc(cellValue(c, e))}</dd></div>`).join('');
  const interval = e.interval?.low && e.interval?.high
    ? `<p class="interval">90% interval ${esc(cellValue({ key: 'judge_low', title: 'Interval low', source: 'performance.judge.interval_low_micro' }, { display: { judge_low: e.interval.low } }))} – ${esc(cellValue({ key: 'judge_high', title: 'Interval high', source: 'performance.judge.interval_high_micro' }, { display: { judge_high: e.interval.high } }))}</p>`
    : '';
  const range = e.rank_range
    ? `<p class="fine">Rank range ${esc(e.rank_range.best)}–${esc(e.rank_range.worst)}${e.reproduced === false ? ' · not reproduced' : ''}</p>`
    : '';
  return `<li class="card lb-row">
    <p class="rank">#${esc(e.rank ?? e.prize_rank ?? '—')}${e.baseline ? ' · baseline' : ''}${e.house ? ' · house' : ''}</p>
    ${img}
    <h2><a href="https://make.fun/s/${esc(e.submission_id)}">${esc(e.title || 'Untitled entry')}</a></h2>
    <p class="meta">by <a href="#/u/${encodeURIComponent(e.handle)}">@${esc(e.handle)}</a> · ${dateTime(e.received_at)}</p>
    <dl class="facts">${cells}</dl>
    ${interval}${range}
  </li>`;
}

export async function renderLeaderboard(app, slug, my, token, setReady, setUpdated, focusHeading) {
  let phase = 'dev';
  let view = 'performance';
  let data = null;
  let page = 1;

  async function load() {
    app.innerHTML = loadingView('leaderboard');
    try {
      const res = await getLeaderboard(slug, phase, view);
      if (my !== token) return;
      data = res.data;
      setUpdated(res.fetchedAt);
      paint();
    } catch (err) {
      if (my !== token) return;
      app.innerHTML = err.status === 404 ? notFound('leaderboard', slug) : errorView(err.message);
      focusHeading();
      setReady();
    }
  }

  function paint() {
    const comp = data.competition || {};
    const ph = data.phase || {};
    const cols = (data.columns || []).filter((c) => !c.hidden);
    const entries = data.entries || [];
    const views = data.views || [];
    if (data.view) view = data.view;
    const pages = Math.max(1, Math.ceil(entries.length / PER_PAGE));
    page = Math.min(Math.max(1, page), pages);
    const slice = entries.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const held = entries.length === 0 && ph.placements_held;
    const empty = entries.length === 0 && !held;
    const viewBtns = views.map((v) => `<button type="button" data-view="${esc(v)}" ${v === view ? 'aria-pressed="true" disabled' : ''}>${esc(v)}</button>`).join(' ');
    const pager = pages > 1
      ? `<p class="pager"><button type="button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>← Prev</button> <span>Page ${page} of ${pages} · ${entries.length} entries</span> <button type="button" data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>Next →</button></p>`
      : `<p class="pager"><span>${entries.length} entries</span></p>`;
    app.innerHTML = `<p class="crumb"><a href="#/bounty/${encodeURIComponent(slug)}">← ${esc(comp.title || slug)}</a></p>
    <h1 tabindex="-1">Leaderboard: ${esc(comp.title || slug)}</h1>
    <p class="meta">${esc(ph.title || phase)} phase · ranked by ${esc(data.rank_key || 'score')} · tie-break ${esc(data.tie_break?.title || '—')}${data.metricsWithheld ? ' · build metrics withheld' : ''}</p>
    <p class="controls">
      <span role="group" aria-label="Phase"><button type="button" data-phase="dev" ${phase === 'dev' ? 'aria-pressed="true" disabled' : ''}>Development</button> <button type="button" data-phase="final" ${phase === 'final' ? 'aria-pressed="true" disabled' : ''}>Final</button></span>
      ${viewBtns ? `<span role="group" aria-label="View"> ${viewBtns}</span>` : ''}
    </p>
    ${held ? '<p class="notice" role="status">Placements are held until results are published — the leaderboard opens with the results.</p>' : ''}
    ${empty ? '<p class="notice" role="status">No entries yet for this bounty.</p>' : ''}
    <ol class="board lb" start="${(page - 1) * PER_PAGE + 1}">${slice.map((e) => entryCard(e, cols)).join('')}</ol>
    <div class="pager-wrap">${pager}</div>
    <p class="fine">${plural(entries.length, 'entry')} · ${esc(data.title || '')} · scores ${ph.scores_visible ? 'visible' : 'hidden'}</p>`;
    document.title = `Leaderboard: ${comp.title || slug} | make.fun bounties`;
    window.scrollTo(0, 0);
    focusHeading();
    setReady();
  }

  if (previousClick) app.removeEventListener('click', previousClick);
  previousClick = (e) => {
    const viewBtn = e.target.closest('[data-view]');
    const phaseBtn = e.target.closest('[data-phase]');
    const pageBtn = e.target.closest('[data-page]');
    if (viewBtn) { view = viewBtn.getAttribute('data-view'); page = 1; load(); return; }
    if (phaseBtn) { phase = phaseBtn.getAttribute('data-phase'); page = 1; load(); return; }
    if (pageBtn && !pageBtn.disabled) { page = Number(pageBtn.getAttribute('data-page')); paint(); }
  };
  app.addEventListener('click', previousClick);

  await load();
}
