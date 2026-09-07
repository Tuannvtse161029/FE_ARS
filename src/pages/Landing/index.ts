// Landing page barrel.
// The redesigned scroll-driven landing is now the default `Landing`
// export and is mounted at `/` (the public landing route). The previous
// feature-flat Landing.tsx implementation is kept on disk as legacy but
// is no longer wired into the bundle.
export { default as Landing } from './LandingScrollVideo';
export { default } from './LandingScrollVideo';

// Backwards-compatible named export — code that still imports
// `LandingScrollVideo` keeps working.
export { default as LandingScrollVideo } from './LandingScrollVideo';
