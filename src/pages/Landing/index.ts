// Landing page barrel.
// The scroll-driven landing is the default `Landing` export and is
// mounted at `/` (the public landing route).
export { default as Landing } from './LandingScrollVideo';
export { default } from './LandingScrollVideo';

// Backwards-compatible named export — code that still imports
// `LandingScrollVideo` keeps working.
export { default as LandingScrollVideo } from './LandingScrollVideo';
