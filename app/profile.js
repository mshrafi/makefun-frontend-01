// Public profile view — loaded later by import(). Avatar, record, and the
// account's public solutions with placements and prizes.

import { getProfile } from './api.js';
import { cellValue, dateShort, esc, money, plural, whole } from './format.js';
import { errorView, loadingView, notFound } from './views.js';

function avatarUrl(p) {
  const u = p.avatar?.url || p.image;
  if (!u) return '';
  return u.startsWith('http') ? u : `https://make.fun${u}`;
}

function solutionCard(s) {
  const c = s.competition || {};
  const score = s.score?.column
    ? `${esc(s.score.column.title || 'Score')}: ${esc(cellValue(s.score.column, { display: { [s.score.column.key]: s.score.display ?? s.score.value } }))}`
    : '';
  return `<li class="card">
    <h2><a href="https://make.fun/s/${esc(s.submission_id)}">${esc(s.title || 'Untitled entry')}</a></h2>
    <p class="meta">in <a href="#/bounty/${encodeURIComponent(c.slug || '')}">${esc(c.title || c.slug || '')}</a> · entered ${dateShort(s.entered_at)}</p>
    <p>${s.placement ? `Placed #${esc(s.placement)} · ` : ''}${s.prize_usd ? `won ${money(s.prize_usd)} · ` : ''}${score}</p>
  </li>`;
}

export async function renderProfile(app, handle, my, token, setReady, setUpdated, focusHeading) {
  app.innerHTML = loadingView('profile');
  let p;
  try {
    const res = await getProfile(handle);
    if (my !== token) return;
    p = res.data;
    setUpdated(res.fetchedAt);
  } catch (err) {
    if (my !== token) return;
    app.innerHTML = err.status === 404 || err.status === 410 ? notFound('profile', handle) : errorView(err.message);
    focusHeading();
    setReady();
    return;
  }
  const record = p.record || {};
  const avatar = avatarUrl(p);
  const initials = (p.display_name || p.handle || '?').slice(0, 2).toUpperCase();
  const walletShort = p.wallet?.address ? `${p.wallet.address.slice(0, 6)}…${p.wallet.address.slice(-4)}` : '';
  const links = [
    p.github_login ? `<a href="https://github.com/${encodeURIComponent(p.github_login)}">GitHub: ${esc(p.github_login)}</a>` : '',
    p.discord?.url ? `<a href="${esc(p.discord.url)}">Discord: ${esc(p.discord.username || p.discord.global_name || '')}</a>` : '',
    p.wallet?.explorer_url ? `<a href="${esc(p.wallet.explorer_url)}">Wallet: ${esc(walletShort)}</a>` : '',
  ].filter(Boolean).join(' · ');
  const solutions = p.solutions || [];
  const best = record.best_placement ? `#${esc(record.best_placement)}` : '—';
  app.innerHTML = `<p class="crumb"><a href="#/">← All bounties</a></p>
  <article class="profile">
    <div class="avatar-wrap" aria-hidden="true"><span class="initials">${esc(initials)}</span>${avatar ? `<img class="avatar" crossorigin="anonymous" referrerpolicy="no-referrer" src="${esc(avatar)}" alt="">` : ''}</div>
    <h1 tabindex="-1">${esc(p.display_name || p.handle)}</h1>
    <p class="meta">@${esc(p.handle)} · joined ${dateShort(p.joined_at)}</p>
    ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
    ${links ? `<p class="links">${links}</p>` : ''}
    <dl class="facts profile-facts">
      <div><dt>Entered</dt><dd>${whole(record.competitions_entered ?? 0)}</dd></div>
      <div><dt>Won</dt><dd>${whole(record.competitions_won ?? 0)}</dd></div>
      <div><dt>Placed</dt><dd>${whole(record.competitions_placed ?? 0)}</dd></div>
      <div><dt>Best placement</dt><dd>${best}</dd></div>
      <div><dt>Prize money</dt><dd class="pot">${money(record.prize_usd ?? 0)}</dd></div>
    </dl>
  </article>
  <h2>Solutions (${solutions.length})</h2>
  ${solutions.length ? `<ul class="board">${solutions.map(solutionCard).join('')}</ul>` : '<p>No public solutions yet.</p>'}`;
  document.title = `@${p.handle} | make.fun bounties`;
  window.scrollTo(0, 0);
  const img = app.querySelector('img.avatar');
  if (img) img.addEventListener('error', () => { img.remove(); });
  focusHeading();
  setReady();
}
