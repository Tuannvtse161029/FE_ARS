type Listener = () => void;

let pendingRequestCount = 0;
const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const loadingTracker = {
  begin: () => {
    pendingRequestCount += 1;
    notify();
  },
  end: () => {
    pendingRequestCount = Math.max(0, pendingRequestCount - 1);
    notify();
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => pendingRequestCount > 0,
};
