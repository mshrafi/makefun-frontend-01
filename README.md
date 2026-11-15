# make.fun bounties — a fast frontend for make.fun

[![make.fun](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/mshrafi/makefun-frontend-01/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard)
[![reward](https://make.fun/badge/makefun-frontend-01/mshrafi/makefun-frontend-01/reward.svg)](https://make.fun/bounty/makefun-frontend-01)

A fast, read-only frontend for [make.fun](https://make.fun/bounty/makefun-frontend-01): the live bounty board, bounty pages, leaderboards and public profiles — static files, no build step, no framework, no sign-in.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080.

## What it does

- **Board (`#/`):** every live bounty with its live pot, entry fee (or "Free"), ticking time left and entry count, plus a totals strip (open bounties, combined pots, entries so far); filter, sort by deadline / pot / entries, 20 per page, "Closing soon" tags under 24h.
- **Bounty page (`#/bounty/<slug>`):** summary, description, rewards table with the live pot and each place's fee share, dates, rules in a collapsed section. "Still takes entries" is judged by the deadline, not the status.
- **Leaderboard (`#/bounty/<slug>/leaderboard`):** columns rendered from the API per harness, micro-unit values in their real units, held-placement state, 25 per page, phase and view switchers.
- **Profile (`#/u/<handle>`):** avatar, record (entered / won / placed / best placement / prize money), and solutions with placements and prizes.

## How it is fast

- First load is 6 small files (board + bounty code only); leaderboard and profile load later by `import()`.
- API answers are cached in memory + `localStorage` and revalidated with `ETag` / `If-None-Match` (304 reuses the cached body); in-flight requests are deduplicated; one request per view.
- Long lists are paginated client-side; the shell is never rebuilt per view and the countdown updates text nodes only.

Owner: mshrafi · Referral code: `7qb8d53t`

Entered on [make.fun](https://make.fun/?ref=7qb8d53t&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
