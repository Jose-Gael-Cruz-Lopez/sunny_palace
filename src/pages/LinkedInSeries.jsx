import { useState, useRef } from 'react'
import ArticleLayout from '../components/ArticleLayout'
import { useT } from '../hooks/useT'
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile'

// Published LinkedIn posts. Render above the episode grid so the live drops are the first content after the hero.
// Only the single most-recent drop headlines the "Latest from the series" section.
// All earlier published posts live in PUBLISHED_GROUPS below, sorted by topic.
const LIVE_POSTS = [
  {
    type: 'announcement',
    author: 'both',
    date: '2026-05-29',
    url: 'https://www.linkedin.com/feed/update/urn:li:activity:7466156416198680577',
  },
]

// Published posts grouped by topic category. Rendered between the live drop and the
// episode roadmap. Each card links straight to LinkedIn. Order: newest first within group.
// Content (kicker/title/preview/dateLabel) comes from t.publishedGroups[groupIdx].posts[postIdx].
const PUBLISHED_GROUPS = [
  {
    key: 'internships',
    posts: [
      { author: 'jocelyn', date: '2026-05-28', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7465883343570534401' },
      { author: 'jose', date: '2026-05-28', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7465867333836750848' },
      { author: 'both', date: '2026-05-20', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7462910032209207298' },
    ],
  },
  {
    key: 'rejection',
    posts: [
      { author: 'both', date: '2026-05-27', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7465446734387675136' },
      { author: 'both', date: '2026-05-18', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7462185243022901248' },
      { author: 'both', date: '2026-05-11', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7459648558691164160' },
    ],
  },
  {
    key: 'brand',
    posts: [
      { author: 'both', date: '2026-05-28', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7465809154117476352' },
      { author: 'both', date: '2026-05-21', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7463272426001498112' },
    ],
  },
  {
    key: 'behind-the-scenes',
    posts: [
      { author: 'both', date: '2026-05-15', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7461083153688842240' },
      { author: 'both', date: '2026-05-14', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7460720723968577536' },
      { author: 'both', date: '2026-05-05', url: 'https://www.linkedin.com/posts/from-campus-to-career_fromcampustocareer-firstgen-careerdevelopment-activity-7457496865899626496-3eB_' },
    ],
  },
]

// Total published posts on the page — drives the hero stat so it never desyncs from the data.
const PUBLISHED_COUNT = LIVE_POSTS.length + PUBLISHED_GROUPS.reduce((n, g) => n + g.posts.length, 0)

function authorClass(a) {
  return a === 'jose' ? 'ls-post__author--jose' : a === 'jocelyn' ? 'ls-post__author--jocelyn' : 'ls-post__author--both'
}

const PAGE_CSS = `
  html, body { background: var(--color-cream); }
  :root { --linkedin-brand-blue: #0a66c2; --ls-shadow-warm: 58, 38, 22; }
  .ls-linkedin { color: var(--linkedin-brand-blue); }
  .ls-hero { max-width:1240px;margin:0 auto;padding:96px clamp(20px,5vw,56px) 64px;position:relative;overflow:hidden; }
  .ls-hero::before { content:'';position:absolute;top:96px;left:clamp(20px,5vw,56px);width:56px;height:4px;background:var(--color-accent);border-radius:2px;z-index:1; }
  .ls-hero::after { content:'';position:absolute;top:-14%;right:-10%;width:520px;height:520px;background:radial-gradient(closest-side,rgba(179,69,57,.1),transparent 70%);pointer-events:none;z-index:0; }
  .ls-hero__primary { position:relative;z-index:1; }
  .ls-hero__aside { position:relative;z-index:1;margin-top:48px;padding-top:36px;border-top:1px solid rgba(26,25,22,.1); }
  .ls-hero__kicker { font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--color-accent);margin:28px 0 22px;display:inline-flex;align-items:center;gap:10px; }
  .ls-hero__kicker::after { content:'';width:24px;height:1px;background:var(--color-accent);opacity:.5; }
  .ls-hero__title { font-family:var(--font-display);font-size:clamp(44px,8.4vw,108px);font-weight:700;line-height:.96;letter-spacing:-0.03em;text-wrap:balance;color:var(--color-dark);margin-bottom:24px;max-width:18ch; }
  .ls-hero__title em { font-style:italic;font-family:var(--font-serif,var(--font-display));color:var(--color-gold-dark);font-weight:500;padding-right:.04em; }
  .ls-hero__sub { font-size:clamp(16px,1.8vw,20px);color:var(--color-muted);line-height:1.65;text-wrap:pretty;max-width:62ch;margin-bottom:0; }
  .ls-hero__sub + .ls-hero__sub { margin-top:18px; }
  .ls-hero__sub strong { color:var(--color-dark);font-weight:600; }
  .ls-stats { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0; }
  .ls-stat { padding:0 32px;position:relative; }
  .ls-stat:first-child { padding-left:0; }
  .ls-stat:last-child { padding-right:0; }
  .ls-stat + .ls-stat::before { content:'';position:absolute;left:0;top:8px;bottom:8px;width:1px;background:rgba(26,25,22,.1); }
  .ls-stat--lead .ls-stat__num::before { content:'';display:inline-block;width:18px;height:2px;background:var(--color-accent);border-radius:2px;margin-right:10px;vertical-align:.32em; }
  .ls-stat__num { font-family:var(--font-display);font-size:clamp(28px,3.4vw,40px);font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-0.03em;color:var(--color-dark);line-height:1;margin-bottom:8px; }
  .ls-stat__label { font-size:12px;color:var(--color-muted);line-height:1.4;letter-spacing:.04em;text-transform:uppercase;font-weight:600; }
  @media (max-width: 640px) {
    .ls-stats { grid-template-columns: 1fr; gap: 18px 0; }
    .ls-stat { padding: 0; }
    .ls-stat + .ls-stat { padding-top: 18px; }
    .ls-stat + .ls-stat::before { left:0;right:0;top:0;bottom:auto;width:auto;height:1px; }
  }
  .ls-controls { max-width:1240px;margin:0 auto;padding:0 clamp(20px,5vw,56px) 40px; }
  .ls-filters { display:flex;flex-wrap:wrap;gap:8px; }
  .ls-filter { padding:9px 16px;border-radius:14px;font-family:var(--font-display);letter-spacing:-.005em;cursor:pointer;border:1.5px solid rgba(26,25,22,.1);background:rgba(255,255,255,.55);color:var(--color-muted);transition:background-color .2s ease,color .2s ease,border-color .2s ease,transform .15s ease,box-shadow .2s ease;display:inline-flex;flex-direction:column;align-items:flex-start;gap:1px;text-align:left;min-width:0; }
  .ls-filter:hover { color:var(--color-dark);border-color:rgba(26,25,22,.22);background:rgba(255,255,255,.85);transform:translateY(-1px);box-shadow:0 4px 12px -4px rgba(var(--ls-shadow-warm),.1); }
  .ls-filter:active { transform:translateY(0);box-shadow:0 1px 2px rgba(var(--ls-shadow-warm),.06); }
  .ls-filter--active { background:var(--color-dark);color:var(--color-cream);border-color:var(--color-dark);box-shadow:0 8px 18px -8px rgba(var(--ls-shadow-warm),.32),inset 0 1px 0 rgba(255,255,255,.08); }
  .ls-filter--active:hover { background:var(--color-dark);color:var(--color-cream); }
  .ls-filter:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; border-radius: 14px; }
  .ls-filter__label { font-size:12px;font-weight:700;letter-spacing:-.005em;line-height:1.2; }
  .ls-filter__desc { font-size:10.5px;font-weight:500;opacity:.72;line-height:1.2;letter-spacing:.005em; }
  .ls-filter--active .ls-filter__desc { opacity:.85; }
  .ls-filters__group { display:inline-flex;gap:8px;flex-wrap:wrap;align-items:center; }
  .ls-filters__label { font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--color-muted);margin-right:6px; }
  .ls-filters__rule { width:1px;align-self:stretch;background:rgba(26,25,22,.1);margin:6px 8px; }
  .ls-divider { max-width:1240px;margin:0 auto 48px;padding:0 clamp(20px,5vw,56px); }
  .ls-divider hr { border:none;border-top:1px solid rgba(26,25,22,.08); }
  .ls-results-count { max-width:1240px;margin:0 auto;padding:0 clamp(20px,5vw,56px) 16px;font-size:13px;color:var(--color-muted); }
  .ls-results-count strong { color:var(--color-dark);font-weight:700; }
  .ls-toc { max-width:1240px;margin:0 auto;padding:0 clamp(20px,5vw,56px) 32px; }
  .ls-toc__inner { display:flex;flex-wrap:wrap;gap:6px;align-items:center; }
  .ls-toc__label { font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--color-muted);margin-right:10px; }
  .ls-toc__chip { display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:rgba(255,250,242,.8);border:1px solid rgba(26,25,22,.13);color:var(--color-dark);font-family:var(--font-display);font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.005em;text-decoration:none;transition:background .2s,border-color .2s,transform .15s cubic-bezier(.16,1,.3,1),box-shadow .2s; }
  .ls-toc__chip:hover { background:var(--color-dark);color:var(--color-cream);border-color:var(--color-dark);transform:translateY(-1px);box-shadow:0 6px 12px -6px rgba(var(--ls-shadow-warm),.32); }
  .ls-toc__chip--filtered { opacity:.3;pointer-events:none; }
  .ls-toc__chip:focus-visible { outline:2px solid var(--color-accent);outline-offset:3px; }
  .ls-episodes { max-width:1240px;margin:0 auto;padding:0 clamp(20px,5vw,56px) 80px;display:flex;flex-direction:column;gap:64px; }
  .ls-ep { display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:clamp(24px,4vw,56px);align-items:start;scroll-margin-top:96px; }
  .ls-ep__head { display:flex;align-items:flex-start;gap:24px;margin-bottom:0;position:sticky;top:80px; }
  .ls-ep__num { font-family:var(--font-display);font-size:clamp(48px,5.4vw,76px);font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-0.05em;line-height:1;color:rgba(139,105,20,.7);flex-shrink:0;min-width:60px;font-feature-settings:"ss01" 1; }
  .ls-ep__info { flex:1;min-width:0; }
  @media (max-width: 960px) {
    .ls-ep { grid-template-columns: 1fr; gap: 24px; }
    .ls-ep__head { position: static; }
  }
  .ls-ep__badges { display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap; }
  .ls-ep__lens { font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:4px 11px;border-radius:999px;color:var(--color-white); }
  .ls-ep__lens--jose { background:var(--color-teal); }
  .ls-ep__lens--jocelyn { background:var(--color-accent); }
  .ls-ep__lens--both { background:var(--color-navy); }
  .ls-ep__tag { font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--color-muted);padding:4px 10px;border-radius:999px;background:rgba(26,25,22,.06); }
  .ls-ep__title { font-family:var(--font-display);font-size:clamp(22px,3vw,32px);font-weight:700;color:var(--color-dark);line-height:1.15;letter-spacing:-0.02em;text-wrap:balance;margin-bottom:10px; }
  .ls-ep__summary { font-size:15px;color:var(--color-muted);line-height:1.65;text-wrap:pretty;max-width:640px;margin-bottom:10px; }
  .ls-ep__why { font-size:13px;color:var(--color-teal);font-weight:500;font-style:italic;font-family:var(--font-serif,var(--font-body));line-height:1.55; }
  .ls-ep__why::before { content:'- ';color:rgba(58,125,107,.7);font-style:normal;font-weight:600;margin-right:2px; }
  .ls-ep__posts { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;min-width:0; }
  @media (max-width:960px) { .ls-ep__posts { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media (max-width:560px) { .ls-ep__posts { grid-template-columns:1fr; } }
  .ls-ep__posts > .ls-post { animation: ls-post-in .55s cubic-bezier(.16,1,.3,1) backwards; animation-delay: calc(var(--ls-i, 0) * 50ms); }
  @keyframes ls-post-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .ls-post { position:relative;background:linear-gradient(180deg,rgba(255,250,242,.85) 0%,rgba(255,250,242,.55) 100%);border:1px solid rgba(26,25,22,.13);border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 0 rgba(255,255,255,.5) inset, 0 4px 12px -6px rgba(var(--ls-shadow-warm),.12);transition:transform .28s cubic-bezier(.16,1,.3,1),box-shadow .28s cubic-bezier(.16,1,.3,1),border-color .28s; }
  .ls-post:hover { transform:translateY(-3px);border-color:rgba(26,25,22,.22);box-shadow:0 1px 0 rgba(255,255,255,.6) inset, 0 16px 36px -12px rgba(var(--ls-shadow-warm),.22); }
  .ls-post--featured { border-color:rgba(232,168,56,.4);border-width:1.5px;background:linear-gradient(180deg,rgba(232,168,56,.07) 0%,rgba(232,168,56,.02) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.4); }
  .ls-post--featured:hover { border-color:rgba(232,168,56,.55);box-shadow:0 16px 36px -12px rgba(232,168,56,.32),inset 0 1px 0 rgba(255,255,255,.45); }
  .ls-post__type { font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--color-muted); }
  .ls-post__title { font-family:var(--font-display);font-size:14px;font-weight:600;color:var(--color-dark);line-height:1.4;text-wrap:balance; }
  .ls-post__preview { font-size:13px;color:var(--color-muted);line-height:1.55;flex:1; }
  .ls-post__footer { display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto; }
  .ls-post__author { font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:3px;color:var(--color-white); }
  .ls-post__author--jose { background:var(--color-teal); }
  .ls-post__author--jocelyn { background:var(--color-accent); }
  .ls-post__author--both { background:var(--color-navy); }
  .ls-post__status { font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-muted);padding:3px 9px;border-radius:999px;background:rgba(26,25,22,.06); }
  .ls-how { position:relative;overflow:hidden;background:var(--color-navy);padding:clamp(64px,8vw,104px) clamp(20px,5vw,56px); }
  .ls-how::before { content:'';position:absolute;inset:0;background-image:radial-gradient(circle at 84% 76%,rgba(58,125,107,.08) 0%,transparent 50%);pointer-events:none; }
  .ls-how__inner { position:relative;max-width:1240px;margin:0 auto; }
  .ls-how__kicker { font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--color-gold);margin-bottom:16px;display:inline-flex;align-items:center;gap:10px; }
  .ls-how__kicker::after { content:'';width:24px;height:1px;background:var(--color-gold);opacity:.5; }
  .ls-how__title { font-family:var(--font-display);font-size:clamp(28px,4.4vw,46px);font-weight:700;letter-spacing:-0.025em;line-height:1.05;text-wrap:balance;color:var(--color-cream);margin-bottom:48px;max-width:18ch; }
  .ls-how__title em { font-style:italic;font-family:var(--font-serif,var(--font-display));color:var(--color-gold);font-weight:500;padding-right:.04em; }
  .ls-how__grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:32px; }
  .ls-how__item { position:relative;padding-top:14px;border-top:1px solid rgba(242,228,206,.18); }
  .ls-how__item-icon { font-family:var(--font-display);font-size:42px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-0.04em;color:var(--color-gold);margin-bottom:14px;line-height:1; }
  .ls-how__item-title { font-family:var(--font-display);font-size:17px;font-weight:700;color:var(--color-cream);margin-bottom:8px;letter-spacing:-.005em;line-height:1.3; }
  .ls-how__item-desc { font-size:14px;color:rgba(242,228,206,.7);line-height:1.6;text-wrap:pretty; }
  .ls-form-wrap { max-width:1240px;margin:0 auto;padding:clamp(56px,8vw,96px) clamp(20px,5vw,56px);scroll-margin-top:96px; }
  .ls-form-layout { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:clamp(40px,5vw,72px);align-items:start; }
  @media (max-width: 860px) { .ls-form-layout { grid-template-columns: 1fr; gap: 36px; } }
  .ls-form-intro { max-width: 460px; }
  .ls-form-box { background:rgba(255,250,242,.7);border-radius:18px;padding:clamp(28px,3.5vw,44px);border:1px solid rgba(26,25,22,.13);box-shadow:0 1px 0 rgba(255,255,255,.5) inset, 0 18px 40px -22px rgba(var(--ls-shadow-warm),.22); }
  .ls-form-box__kicker { font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--color-accent);margin-bottom:14px;display:inline-flex;align-items:center;gap:10px; }
  .ls-form-box__kicker::after { content:'';width:24px;height:1px;background:var(--color-accent);opacity:.5; }
  .ls-form-box__title { font-family:var(--font-display);font-size:clamp(28px,3.6vw,42px);font-weight:700;letter-spacing:-0.025em;text-wrap:balance;line-height:1.02;color:var(--color-dark);margin-bottom:14px; }
  .ls-form-box__title em { font-style:italic;font-family:var(--font-serif,var(--font-display));color:var(--color-gold-dark);font-weight:500;padding-right:.04em; }
  .ls-form-box__sub { font-size:15px;color:var(--color-muted);margin-bottom:0;line-height:1.65;text-wrap:pretty;max-width:48ch; }
  .ls-form-perks { margin-top:28px;padding-top:24px;border-top:1px solid rgba(26,25,22,.08);display:flex;flex-direction:column;gap:12px;list-style:none; }
  .ls-form-perk { display:flex;align-items:flex-start;gap:11px;font-size:14px;color:var(--color-muted);line-height:1.5; }
  .ls-form-perk__icon { width:22px;height:22px;border-radius:50%;background:rgba(58,125,107,.12);color:var(--color-teal);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;box-shadow:inset 0 0 0 1.5px rgba(58,125,107,.18); }
  .ls-form-perk strong { color:var(--color-dark);font-weight:700; }
  .ls-form-row { margin-bottom:16px; }
  .ls-form-label { display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--color-muted);margin-bottom:7px; }
  .ls-form-input,.ls-form-select,.ls-form-textarea { width:100%;font-family:var(--font-body);font-size:15px;padding:12px 14px;border:1.5px solid rgba(26,25,22,.12);border-radius:10px;background:rgba(255,255,255,.85);color:var(--color-dark);outline:none;transition:border-color .2s ease,background-color .2s ease,box-shadow .2s ease; }
  .ls-form-textarea { min-height:90px;resize:vertical;line-height:1.55; }
  .ls-form-input:focus,.ls-form-select:focus,.ls-form-textarea:focus { border-color:var(--color-gold);background:var(--color-white);box-shadow:0 0 0 4px rgba(232,168,56,.16); }
  .ls-form-btn { margin-top:6px;padding:14px 28px;background:var(--color-dark);color:var(--color-cream);border:none;border-radius:999px;font-family:var(--font-display);font-size:14px;font-weight:700;letter-spacing:-.005em;cursor:pointer;box-shadow:0 8px 20px -10px rgba(var(--ls-shadow-warm),.4),inset 0 1px 0 rgba(255,255,255,.08);transition:background-color .25s ease,transform .22s cubic-bezier(.16,1,.3,1),box-shadow .25s ease; }
  .ls-form-btn:hover { background:var(--color-accent);transform:translateY(-2px);box-shadow:0 14px 26px -12px rgba(179,69,57,.5),inset 0 1px 0 rgba(255,255,255,.12); }
  .ls-form-btn:active { transform:translateY(0);box-shadow:0 2px 4px -2px rgba(var(--ls-shadow-warm),.18); }
  .ls-form-btn:disabled { opacity:.55;cursor:not-allowed;transform:none;box-shadow:none; }
  .ls-form-error { color:var(--color-accent);font-size:13px;font-weight:600;margin-bottom:10px; }
  .ls-form-error-card { display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;padding:14px 16px;background:rgba(179,69,57,.06);border:1px solid rgba(179,69,57,.35);border-radius:10px; }
  .ls-form-error-card__msg { flex:1;font-size:13px;color:var(--color-dark);line-height:1.5;font-weight:500; }
  .ls-form-error-card__msg strong { color:var(--color-accent);font-weight:700; }
  .ls-form-error-card__retry { flex-shrink:0;padding:7px 14px;background:transparent;border:1.5px solid var(--color-accent);color:var(--color-accent);border-radius:999px;font-family:var(--font-display);font-size:12px;font-weight:700;letter-spacing:-.005em;cursor:pointer;transition:background .2s,color .2s; }
  .ls-form-error-card__retry:hover { background:var(--color-accent);color:var(--color-cream); }
  .ls-form-row__error { display:block;margin-top:6px;font-size:12px;font-weight:600;color:var(--color-accent);line-height:1.4; }
  .ls-form-row__error::before { content:'';display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--color-accent);margin-right:7px;vertical-align:.18em; }
  .ls-form-input.is-invalid, .ls-form-textarea.is-invalid, .ls-form-select.is-invalid { border-color:rgba(179,69,57,.45); }
  .ls-form-input.is-invalid:focus, .ls-form-textarea.is-invalid:focus, .ls-form-select.is-invalid:focus { border-color:var(--color-accent);box-shadow:0 0 0 4px rgba(179,69,57,.12); }
  .ls-form-row__counter { display:block;margin-top:6px;font-size:11px;color:var(--color-muted);text-align:right;font-variant-numeric:tabular-nums;letter-spacing:.02em; }
  .ls-form-row__counter--warn { color:var(--color-accent);font-weight:600; }
  .ls-form-success { padding:32px 0;text-align:center; }
  .ls-form-success__icon { width:52px;height:52px;border-radius:50%;background:rgba(58,125,107,.12);color:var(--color-teal);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:inset 0 0 0 1.5px rgba(58,125,107,.18); }
  .ls-form-success__title { font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--color-dark);margin-bottom:6px;letter-spacing:-.01em; }
  .ls-form-success__body { font-size:14px;color:var(--color-muted);line-height:1.6; }
  .ls-no-results { text-align:center;padding:60px 24px;color:var(--color-muted);background:rgba(232,168,56,.05);border:1px dashed rgba(232,168,56,.25);border-radius:16px;font-size:15px;line-height:1.6; }

  /* CTA bridge — sits between episodes list and the navy "how" band, surfaces the form before users commit to scrolling further */
  .ls-bridge { max-width:1240px;margin:0 auto;padding:0 clamp(20px,5vw,56px) 56px; }
  .ls-bridge__inner { display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;padding:24px 28px;background:rgba(232,168,56,.06);border:1px solid rgba(232,168,56,.22);border-radius:14px; }
  .ls-bridge__copy { font-family:var(--font-display);font-size:clamp(17px,2vw,21px);font-weight:600;color:var(--color-dark);line-height:1.3;letter-spacing:-.005em; }
  .ls-bridge__copy em { font-style:italic;font-family:var(--font-serif,var(--font-display));color:var(--color-gold-dark);font-weight:500; }
  .ls-bridge__cta { display:inline-flex;align-items:center;gap:8px;padding:11px 20px;background:var(--color-dark);color:var(--color-cream);border-radius:999px;font-family:var(--font-display);font-size:13px;font-weight:700;letter-spacing:-.005em;text-decoration:none;box-shadow:0 6px 14px -8px rgba(var(--ls-shadow-warm),.4),inset 0 1px 0 rgba(255,255,255,.08);transition:background .25s,transform .22s cubic-bezier(.16,1,.3,1),box-shadow .25s; }
  .ls-bridge__cta:hover { background:var(--color-accent);transform:translateY(-1px);box-shadow:0 12px 22px -10px rgba(179,69,57,.5); }
  .ls-bridge__cta:active { transform:translateY(0); }
  .ls-bridge__cta svg { transition:transform .22s cubic-bezier(.16,1,.3,1); }
  .ls-bridge__cta:hover svg { transform:translateY(2px); }
  /* Live posts — published LinkedIn drops, sit above the episode grid */
  .ls-live { max-width:1240px;margin:0 auto;padding:0 clamp(20px,5vw,56px) 48px;display:flex;flex-direction:column;gap:18px; }
  .ls-live__head { display:flex;align-items:baseline;gap:14px;flex-wrap:wrap; }
  .ls-live__heading { font-family:var(--font-display);font-size:clamp(22px,2.6vw,30px);font-weight:700;letter-spacing:-0.02em;color:var(--color-dark);margin:0;text-wrap:balance; }
  .ls-live__count { font-size:11px;color:var(--color-muted);font-variant-numeric:tabular-nums;letter-spacing:.08em;text-transform:uppercase;font-weight:700; }
  .ls-live__card { display:block;position:relative;overflow:hidden;padding:clamp(28px,3.6vw,44px);background:linear-gradient(180deg,rgba(232,168,56,.10) 0%,rgba(232,168,56,.04) 100%);border:1px solid rgba(232,168,56,.32);border-radius:18px;color:inherit;text-decoration:none;transition:border-color .3s var(--ease-out),transform .3s var(--ease-out),box-shadow .3s var(--ease-out); }
  .ls-live__card:hover { border-color:rgba(232,168,56,.55);transform:translateY(-2px);box-shadow:0 18px 40px -20px rgba(var(--ls-shadow-warm),.32); }
  .ls-live__card:active { transform:translateY(0); }
  .ls-live__card:focus-visible { outline:2px solid var(--color-gold);outline-offset:4px; }
  .ls-live__badges { display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap; }
  .ls-live__live-pill { display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--color-accent);padding:4px 10px;border-radius:999px;background:rgba(179,69,57,.10);border:1px solid rgba(179,69,57,.28); }
  .ls-live__live-pill::before { content:'';width:6px;height:6px;border-radius:50%;background:var(--color-accent);animation:ls-pulse 2s ease-in-out infinite; }
  @keyframes ls-pulse { 0%,100% { opacity:1; } 50% { opacity:.35; } }
  .ls-live__kicker { font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--color-muted); }
  .ls-live__date { font-size:11px;color:var(--color-muted);font-variant-numeric:tabular-nums;letter-spacing:.04em;margin-left:auto; }
  .ls-live__title { font-family:var(--font-display);font-size:clamp(22px,3.2vw,34px);font-weight:700;line-height:1.12;letter-spacing:-0.022em;color:var(--color-dark);margin:0 0 14px;max-width:30ch;text-wrap:balance; }
  .ls-live__preview { font-size:clamp(14px,1.3vw,16px);line-height:1.6;color:var(--color-muted);margin:0 0 24px;max-width:70ch;text-wrap:pretty; }
  .ls-live__footer { display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap; }
  .ls-live__cta { display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:var(--color-dark);color:var(--color-cream);border-radius:999px;font-family:var(--font-display);font-size:12px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;box-shadow:0 4px 10px -4px rgba(var(--ls-shadow-warm),.35),inset 0 1px 0 rgba(255,255,255,.08);transition:background .25s,box-shadow .25s; }
  .ls-live__card:hover .ls-live__cta { background:var(--color-accent);box-shadow:0 10px 22px -10px rgba(179,69,57,.5); }
  .ls-live__cta svg { transition:transform .22s cubic-bezier(.16,1,.3,1); }
  .ls-live__card:hover .ls-live__cta svg { transform:translate(2px,-2px); }
  @media (max-width:560px) {
    .ls-live__date { margin-left:0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ls-live__live-pill::before { animation:none; }
    .ls-live__card,.ls-live__cta,.ls-live__cta svg { transition:none !important; }
    .ls-live__card:hover { transform:none !important; }
    .ls-live__card:hover .ls-live__cta svg { transform:none !important; }
  }

  /* Published posts, grouped by topic — sits between the live drop and the episode roadmap */
  .ls-pub { max-width:1240px;margin:0 auto;padding:8px clamp(20px,5vw,56px) 56px;display:flex;flex-direction:column;gap:34px; }
  .ls-pub__head { display:flex;flex-direction:column;gap:8px; }
  .ls-pub__heading { font-family:var(--font-display);font-size:clamp(22px,2.6vw,30px);font-weight:700;letter-spacing:-0.02em;color:var(--color-dark);margin:0;text-wrap:balance; }
  .ls-pub__sub { font-size:clamp(14px,1.3vw,16px);line-height:1.6;color:var(--color-muted);margin:0;max-width:60ch; }
  .ls-pub__group { display:flex;flex-direction:column;gap:18px; }
  .ls-pub__group-head { display:flex;align-items:baseline;gap:12px;padding-bottom:10px;border-bottom:1px solid rgba(26,25,22,.1); }
  .ls-pub__group-title { font-family:var(--font-display);font-size:clamp(16px,1.9vw,21px);font-weight:700;letter-spacing:-0.01em;color:var(--color-dark);margin:0; }
  .ls-pub__group-count { font-size:11px;color:var(--color-muted);font-variant-numeric:tabular-nums;letter-spacing:.08em;text-transform:uppercase;font-weight:700; }
  .ls-pub__grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px;align-items:stretch; }
  .ls-pub__card { height:100%;display:flex;flex-direction:column;gap:10px;padding:22px;background:linear-gradient(180deg,rgba(255,250,242,.85) 0%,rgba(255,250,242,.5) 100%);border:1px solid rgba(26,25,22,.13);border-radius:14px;color:inherit;text-decoration:none;transition:border-color .28s var(--ease-out),transform .28s var(--ease-out),box-shadow .28s var(--ease-out); }
  .ls-pub__card:hover { border-color:rgba(26,25,22,.24);transform:translateY(-3px);box-shadow:0 16px 36px -16px rgba(var(--ls-shadow-warm),.22); }
  .ls-pub__card:active { transform:translateY(0); }
  .ls-pub__card:focus-visible { outline:2px solid var(--color-gold);outline-offset:3px; }
  .ls-pub__badges { display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
  .ls-pub__kicker { font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--color-muted); }
  .ls-pub__date { font-size:11px;color:var(--color-muted);font-variant-numeric:tabular-nums;margin-left:auto; }
  .ls-pub__title { font-family:var(--font-display);font-size:16px;font-weight:600;line-height:1.32;letter-spacing:-0.01em;color:var(--color-dark);margin:0;text-wrap:balance;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:calc(1.32em * 2); }
  .ls-pub__preview { font-size:13px;line-height:1.55;color:var(--color-muted);margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:calc(1.55em * 3); }
  .ls-pub__footer { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;padding-top:8px; }
  .ls-pub__cta { display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--color-accent); }
  .ls-pub__cta svg { transition:transform .22s cubic-bezier(.16,1,.3,1); }
  .ls-pub__card:hover .ls-pub__cta svg { transform:translate(2px,-2px); }
  @media (prefers-reduced-motion: reduce) {
    .ls-pub__card,.ls-pub__cta svg { transition:none !important; }
    .ls-pub__card:hover { transform:none !important; }
    .ls-pub__card:hover .ls-pub__cta svg { transform:none !important; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ls-post,.ls-filter,.ls-form-btn,.ls-form-input,.ls-form-select,.ls-form-textarea,
    .ls-form-error-card__retry,.ls-toc__chip,.ls-bridge__cta { transition:none !important; }
    .ls-post:hover,.ls-filter:hover,.ls-form-btn:hover,
    .ls-form-error-card__retry:hover,.ls-toc__chip:hover,.ls-bridge__cta:hover { transform:none !important; }
    .ls-ep__posts > .ls-post { animation:none !important; }
  }
  @media (max-width:768px) {
    .ls-hero { padding: 88px 20px 48px; }
    .ls-controls { padding-bottom: 28px; }
    .ls-form-wrap { padding-top: 48px; padding-bottom: 48px; }
  }
  @media (max-width:640px) {
    .ls-ep__head{flex-direction:column;gap:8px;}
    .ls-ep__num{font-size:36px;min-width:unset;}
    .ls-how__grid{grid-template-columns:1fr 1fr;}
    .ls-stats{flex-direction:column;}
    .ls-stat{border-right:none;border-bottom:1px solid rgba(26,25,22,.08);}
    .ls-stat:last-child{border-bottom:none;}
  }
  @media (max-width:480px) {
    .ls-hero { padding: 80px 16px 40px; }
    .ls-how__grid { grid-template-columns: 1fr; }
    .ls-filters { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; padding-bottom: 4px; }
    .ls-filter { flex-shrink: 0; }
    .ls-filters__rule { display:none; }
  }
`

export default function LinkedInSeries() {
  const t = useT('linkedInSeries')

  // "Suggest a topic" form state. Was previously lost from this component —
  // handleSubmit and the JSX below reference these, but nothing declared them,
  // so this whole section threw ReferenceErrors on render (issue #81 lint pass).
  const [topic, setTopic] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('')
  const [categoryOther, setCategoryOther] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ topic: '', email: '', category: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileReset = useRef(null)

  const handleSubmit = async e => {
    e.preventDefault()
    const errors = { topic: '', email: '', category: '' }
    if (!topic.trim()) errors.topic = t.formErrorTopic
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = t.formErrorEmail
    if (category === 'other' && !categoryOther.trim()) errors.category = t.formErrorCategoryOther
    if (errors.topic || errors.email || errors.category) {
      setFieldErrors(errors)
      setFormError('')
      return
    }
    if (TURNSTILE_ENABLED && !turnstileToken) return
    setFieldErrors({ topic: '', email: '', category: '' })
    setFormLoading(true)
    setFormError('')
    const categoryValue = category === 'other'
      ? `other: ${categoryOther.trim()}`
      : (category || null)
    // Request now flows through the Turnstile-gated submit-form edge function
    // (service role) — the direct anon INSERT on linkedin_episode_requests is
    // revoked (migration 019) so the open write-spam path is closed.
    let ok
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'linkedin_episode_request',
          turnstileToken,
          payload: {
            topic: topic.trim(),
            email: email.trim() || null,
            category: categoryValue,
          },
        }),
      })
      ok = res.ok
    } catch {
      ok = false
    }
    setFormLoading(false)
    if (ok) { setFormSubmitted(true) }
    else {
      setFormError(t.formErrorGeneric)
      setTurnstileToken('')
      turnstileReset.current?.()
    }
  }


  function getAuthorLabel(author) {
    if (author === 'jose') return t.authorJose
    if (author === 'jocelyn') return t.authorJocelyn
    return t.authorBoth
  }

  return (
    <ArticleLayout
      title="The LinkedIn Series"
      signoffLine={t.signoffLine}
      signoffSub={t.signoffSub}
      signoffCta={t.signoffCta}
    >
      <style>{PAGE_CSS}</style>

      <header className="ls-hero">
        <div className="ls-hero__primary">
          <p className="ls-hero__kicker">{t.heroKicker}</p>
          <h1 className="ls-hero__title">{t.heroTitlePrefix}<span className="ls-linkedin">{t.heroTitleLinkedIn}</span> <em>{t.heroTitleEm}</em></h1>
          <p className="ls-hero__sub">{t.heroSubLead}</p>
          <p className="ls-hero__sub">
            <strong>{t.heroSubJoseStrong}</strong>{t.heroSubJoseRest}
            <strong>{t.heroSubJocelynStrong}</strong>{t.heroSubJocelynRest}
          </p>
        </div>
        <div className="ls-hero__aside">
          <div className="ls-stats">
            <div className="ls-stat"><div className="ls-stat__num">{PUBLISHED_COUNT}</div><div className="ls-stat__label">{t.stat1Label}</div></div>
            <div className="ls-stat"><div className="ls-stat__num">{t.stat3Num}</div><div className="ls-stat__label">{t.stat3Label}</div></div>
            <div className="ls-stat ls-stat--lead"><div className="ls-stat__num">{PUBLISHED_GROUPS.length}</div><div className="ls-stat__label">{t.stat4Label}</div></div>
          </div>
        </div>
      </header>

      {LIVE_POSTS.length > 0 && (
        <section className="ls-live" aria-labelledby="ls-live-heading">
          <div className="ls-live__head">
            <h2 className="ls-live__heading" id="ls-live-heading">{t.livePostsHeading}</h2>
            <span className="ls-live__count">{LIVE_POSTS.length} {LIVE_POSTS.length === 1 ? t.livePostsCountSingular : t.livePostsCountPlural}</span>
          </div>
          {LIVE_POSTS.map((p, i) => {
            const data = t.livePosts?.[i] ?? {}
            return (
              <a
                key={i}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ls-live__card"
              >
                <div className="ls-live__badges">
                  <span className="ls-live__live-pill" aria-label={t.statusLive}>{t.statusLive}</span>
                  {data.kicker && <span className="ls-live__kicker">{data.kicker}</span>}
                  {data.dateLabel && <span className="ls-live__date">{data.dateLabel}</span>}
                </div>
                <h3 className="ls-live__title">{data.title}</h3>
                <p className="ls-live__preview">{data.preview}</p>
                <div className="ls-live__footer">
                  <span className={`ls-post__author ${authorClass(p.author)}`}>{getAuthorLabel(p.author)}</span>
                  <span className="ls-live__cta">
                    {t.liveReadOnLinkedIn}
                  </span>
                </div>
              </a>
            )
          })}
        </section>
      )}

      {PUBLISHED_GROUPS.length > 0 && (
        <section className="ls-pub" aria-labelledby="ls-pub-heading">
          <div className="ls-pub__head">
            <h2 className="ls-pub__heading" id="ls-pub-heading">{t.publishedHeading}</h2>
            <p className="ls-pub__sub">{t.publishedSub}</p>
          </div>
          {PUBLISHED_GROUPS.map((g, gi) => {
            const gData = t.publishedGroups?.[gi] ?? {}
            return (
              <div key={g.key} className="ls-pub__group">
                <div className="ls-pub__group-head">
                  <h3 className="ls-pub__group-title">{gData.label}</h3>
                  <span className="ls-pub__group-count">{g.posts.length}</span>
                </div>
                <div className="ls-pub__grid">
                  {g.posts.map((p, pi) => {
                    const d = gData.posts?.[pi] ?? {}
                    return (
                      <a
                        key={pi}
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ls-pub__card"
                      >
                        <div className="ls-pub__badges">
                          {d.kicker && <span className="ls-pub__kicker">{d.kicker}</span>}
                          {d.dateLabel && <span className="ls-pub__date">{d.dateLabel}</span>}
                        </div>
                        <h4 className="ls-pub__title">{d.title}</h4>
                        <p className="ls-pub__preview">{d.preview}</p>
                        <div className="ls-pub__footer">
                          <span className={`ls-post__author ${authorClass(p.author)}`}>{getAuthorLabel(p.author)}</span>
                          <span className="ls-pub__cta">
                            {t.liveReadOnLinkedIn}
                          </span>
                        </div>
                      </a>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>
      )}
      <div className="ls-bridge">
        <div className="ls-bridge__inner">
          <p className="ls-bridge__copy">{t.bridgeCopyPrefix} <em>{t.bridgeCopyEm}</em></p>
          <a href="#suggest" className="ls-bridge__cta">
            {t.bridgeCtaLabel}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="6 13 12 19 18 13" />
            </svg>
          </a>
        </div>
      </div>

      <section className="ls-how">
        <div className="ls-how__inner">
          <p className="ls-how__kicker">{t.howKicker}</p>
          <h2 className="ls-how__title">{t.howTitle}</h2>
          <div className="ls-how__grid">
            {t.howItems.map(item => (
              <div key={item.n} className="ls-how__item">
                <div className="ls-how__item-icon">{item.n}</div>
                <div className="ls-how__item-title">{item.n === '01' ? <><span className="ls-linkedin">{t.heroTitleLinkedIn}</span> {t.heroTitleEm}</> : item.title}</div>
                <div className="ls-how__item-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="ls-form-wrap" id="suggest">
        <div className="ls-form-layout">
          <div className="ls-form-intro">
            <h2 className="ls-form-box__title">{t.formTitle}</h2>
            <p className="ls-form-box__sub">{t.formSub}</p>
            <ul className="ls-form-perks">
              {(t.formPerks || []).map((perk, i) => (
                <li key={i} className="ls-form-perk">
                  <span className="ls-form-perk__icon" aria-hidden="true">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.8l2.4 2.4L9 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span><strong>{perk.strong}</strong>{perk.rest}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="ls-form-box">
            {formSubmitted ? (
              <div className="ls-form-success">
                <div className="ls-form-success__icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 11.5l4 4L17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <p className="ls-form-success__title">{t.formSuccessTitle}</p>
                <p className="ls-form-success__body">{t.formSuccessBody}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="ls-form-row">
                  <label className="ls-form-label" htmlFor="topicField">{t.formLabelTopic}</label>
                  <textarea
                    className={`ls-form-textarea${fieldErrors.topic ? ' is-invalid' : ''}`}
                    id="topicField"
                    placeholder={t.formPlaceholderTopic}
                    value={topic}
                    maxLength={10000}
                    onChange={e => { setTopic(e.target.value); if (fieldErrors.topic) setFieldErrors(s => ({ ...s, topic: '' })) }}
                    aria-invalid={!!fieldErrors.topic}
                    aria-describedby={fieldErrors.topic ? 'topicField-error' : (topic.length >= 500 ? 'topicField-counter' : undefined)}
                  />
                  {fieldErrors.topic && <span id="topicField-error" className="ls-form-row__error" role="alert">{fieldErrors.topic}</span>}
                  {topic.length >= 500 && (
                    <span id="topicField-counter" className={`ls-form-row__counter${topic.length >= 9000 ? ' ls-form-row__counter--warn' : ''}`} aria-live="polite">
                      {topic.length >= 9000 ? `${topic.length} / 10000` : `${topic.length} chars`}
                    </span>
                  )}
                </div>
                <div className="ls-form-row">
                  <label className="ls-form-label" htmlFor="emailField">{t.formLabelEmail}</label>
                  <input
                    className={`ls-form-input${fieldErrors.email ? ' is-invalid' : ''}`}
                    type="email"
                    id="emailField"
                    placeholder={t.formPlaceholderEmail}
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(s => ({ ...s, email: '' })) }}
                    onBlur={e => {
                      const v = e.target.value.trim()
                      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
                        setFieldErrors(s => ({ ...s, email: t.formErrorEmail }))
                      }
                    }}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'emailField-error' : undefined}
                  />
                  {fieldErrors.email && <span id="emailField-error" className="ls-form-row__error" role="alert">{fieldErrors.email}</span>}
                </div>
                <div className="ls-form-row">
                  <label className="ls-form-label" htmlFor="topicCat">{t.formLabelCategory}</label>
                  <select className="ls-form-select" id="topicCat" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="">{t.formCategoryPlaceholder}</option>
                    <option value="internship-search">{t.catInternshipSearch}</option>
                    <option value="full-time-search">{t.catFullTimeSearch}</option>
                    <option value="resume-cover-letter">{t.catResumeCoverLetter}</option>
                    <option value="interviews">{t.catInterviews}</option>
                    <option value="offers-negotiation">{t.catOffersNegotiation}</option>
                    <option value="recruiting-outreach">{t.catRecruitingOutreach}</option>
                    <option value="networking-mentorship">{t.catNetworkingMentorship}</option>
                    <option value="linkedin-brand">{t.catLinkedInBrand}</option>
                    <option value="workplace-onboarding">{t.catWorkplaceOnboarding}</option>
                    <option value="career-pivots">{t.catCareerPivots}</option>
                    <option value="grad-school-gap">{t.catGradSchoolGap}</option>
                    <option value="mindset-rejection">{t.catMindsetRejection}</option>
                    <option value="other">{t.catOther}</option>
                  </select>
                </div>
                {category === 'other' && (
                  <div className="ls-form-row">
                    <label className="ls-form-label" htmlFor="topicCatOther">{t.formLabelCategoryOther}</label>
                    <input
                      className={`ls-form-input${fieldErrors.category ? ' is-invalid' : ''}`}
                      type="text"
                      id="topicCatOther"
                      placeholder={t.formPlaceholderCategoryOther}
                      value={categoryOther}
                      onChange={e => { setCategoryOther(e.target.value); if (fieldErrors.category) setFieldErrors(s => ({ ...s, category: '' })) }}
                      maxLength={120}
                      aria-invalid={!!fieldErrors.category}
                      aria-describedby={fieldErrors.category ? 'topicCatOther-error' : undefined}
                    />
                    {fieldErrors.category && <span id="topicCatOther-error" className="ls-form-row__error" role="alert">{fieldErrors.category}</span>}
                  </div>
                )}
                {formError && (
                  <div role="alert" className="ls-form-error-card">
                    <span className="ls-form-error-card__msg"><strong>{t.formErrorLabel}</strong> {formError}</span>
                    <button type="submit" className="ls-form-error-card__retry" disabled={formLoading}>{formLoading ? t.formBtnSubmitting : t.formRetryLabel}</button>
                  </div>
                )}
                <Turnstile onToken={setTurnstileToken} resetRef={turnstileReset} />
                <button className="ls-form-btn" type="submit" disabled={formLoading || !topic.trim() || (TURNSTILE_ENABLED && !turnstileToken)}>{formLoading ? t.formBtnSubmitting : t.formBtnSubmit}</button>
              </form>
            )}
          </div>
        </div>
      </div>

    </ArticleLayout>
  )
}
