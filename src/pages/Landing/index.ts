// Landing page barrel — re-exports the default export.
// Landing.tsx uses only a default export.
export { default as Landing } from './Landing';
export { default } from './Landing';

// New scroll-driven landing (video scrub + parallax + pan). Opt-in until
// the team signs off on it — the original `Landing` remains the default
// export so existing imports keep working.
export { default as LandingScrollVideo } from './LandingScrollVideo';
