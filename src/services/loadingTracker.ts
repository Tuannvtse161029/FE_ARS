type Listener = () => void;

export interface TaskOrigin {
  path: string;
  modalKey?: string;
  label?: string;
}

export interface TaskSnapshot {
  /** Origin metadata for the dominant task — used by the header widget. */
  origin: TaskOrigin | null;
  /** True when the task has completed and the user has navigated away. */
  taskCompleted: boolean;
  /** True when either an explicit or auto-origin is currently tracked. */
  hasActiveTask: boolean;
}

type OwnerKind = 'explicit' | 'auto';

interface OwnedOrigin {
  origin: TaskOrigin;
  completed: boolean;
  pathAtStart: string;
  kind: OwnerKind;
}

let pendingRequestCount = 0;
// Keyed by `origin.modalKey` for explicit tasks, or `AUTO_KEY` for the
// implicit origin that any HTTP request begins. A single explicit task
// supersedes a concurrent auto-origin in the widget, but both can coexist
// so that the request counter and the widget stay correct even if a
// long-running modal kicked off its own API call.
const activeOrigins = new Map<string, OwnedOrigin>();
const listeners = new Set<Listener>();
const AUTO_KEY = '__auto__';

const currentPath = (): string =>
  typeof window !== 'undefined' ? window.location.pathname : '';

const notify = () => {
  listeners.forEach((listener) => listener());
};

/** Choose which origin "owns" the widget right now. Explicit modal-driven
 *  tasks always win over the implicit auto-origin so the chip reads the
 *  more informative label (e.g. "AI Summary") when both are active. */
const findDominantOrigin = (): OwnedOrigin | null => {
  for (const o of activeOrigins.values()) {
    if (o.kind === 'explicit') return o;
  }
  return activeOrigins.get(AUTO_KEY) ?? null;
};

export const loadingTracker = {
  // ── HTTP request counter + auto-origin ─────────────────────────────────
  begin: () => {
    pendingRequestCount += 1;
    if (
      pendingRequestCount === 1 &&
      !activeOrigins.has(AUTO_KEY) &&
      !hasExplicitOrigin()
    ) {
      // First request of a fresh cycle, with no explicit task in flight —
      // start an implicit origin so any long-running request automatically
      // gets the same minimised-widget treatment the AI summary modal gets.
      // Subsequent `begin()` calls inside the same cycle leave the auto
      // origin's `pathAtStart` untouched so the user's navigating-away
      // detection stays accurate.
      const path = currentPath();
      activeOrigins.set(AUTO_KEY, {
        origin: { path, label: 'Loading' },
        completed: false,
        pathAtStart: path,
        kind: 'auto',
      });
    }
    notify();
  },
  end: (succeeded: boolean = true) => {
    pendingRequestCount = Math.max(0, pendingRequestCount - 1);
    if (pendingRequestCount === 0) {
      // Last request of the cycle finished. Garbage-collect any origins
      // that outlived their request:
      //   • If the request errored, drop the origin entirely — there's
      //     nothing useful to show in the widget for a 4xx/5xx.
      //   • If the user is still on the originating page, the task
      //     finished inline so we silently drop the origin (no widget
      //     needed — the page already shows the result, success or error).
      //   • Otherwise, mark the origin as `completed` so the widget
      //     flips to its success state and the user can click to return.
      const cur = currentPath();
      for (const [key, o] of [...activeOrigins.entries()]) {
        if (o.completed) continue;
        if (!succeeded || cur === o.pathAtStart) {
          activeOrigins.delete(key);
        } else {
          o.completed = true;
        }
      }
    }
    notify();
  },

  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /**
   * Whether any HTTP request is currently in flight. Drives the global
   * page-level `DelayedLoadingOverlay`.
   */
  getSnapshot: () => pendingRequestCount > 0,

  // ── Explicit long-task tracking (used by AudioSummaryModal etc.) ──────
  beginTask: (origin: TaskOrigin) => {
    const key = origin.modalKey ?? `__explicit_${Date.now()}__`;
    activeOrigins.set(key, {
      origin: { ...origin },
      completed: false,
      pathAtStart: origin.path,
      kind: 'explicit',
    });
    notify();
  },
  completeTask: () => {
    let changed = false;
    for (const o of activeOrigins.values()) {
      if (o.kind === 'explicit' && !o.completed) {
        o.completed = true;
        changed = true;
      }
    }
    if (changed) notify();
  },
  endTask: () => {
    // Dismiss the widget. The hook/owner that registered the task calls
    // this when the user has explicitly dismissed the affordance, so we
    // clear *both* kinds of origin at once — otherwise an orphaned auto
    // origin would re-appear in the widget the moment the next axios
    // request finishes the cycle.
    let changed = false;
    for (const key of [...activeOrigins.keys()]) {
      activeOrigins.delete(key);
      changed = true;
    }
    if (changed) notify();
  },

  /**
   * Snapshot used by the header `LoadingTaskWidget`. Returns the dominant
   * origin (explicit > auto), or `null` if no task is tracked. Returns a
   * fresh object each call; the widget only consumes individual fields.
   */
  getTaskSnapshot: (): TaskSnapshot => {
    const v = findDominantOrigin();
    if (!v) return { origin: null, taskCompleted: false, hasActiveTask: false };
    return {
      origin: v.origin,
      taskCompleted: v.completed,
      hasActiveTask: true,
    };
  },
};

function hasExplicitOrigin(): boolean {
  for (const o of activeOrigins.values()) {
    if (o.kind === 'explicit') return true;
  }
  return false;
}

// Dev-only: expose the singleton so we can poke it from DevTools or a
// browser-automation harness without having to round-trip through axios.
// No-op in production builds because Vite tree-shakes `import.meta.env.DEV`
// to `false` and the whole branch becomes dead code.
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __arsLoadingTracker?: typeof loadingTracker }).__arsLoadingTracker = loadingTracker;
}
