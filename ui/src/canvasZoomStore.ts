export interface CanvasZoomStore {
  getSnapshot(): number;
  set(value: number): void;
  subscribe(listener: () => void): () => void;
}

/**
 * Tiny external store for the view zoom. Only components that subscribe
 * (the zoom indicator) re-render when the view changes; DiagramBuilder does not.
 */
export function createCanvasZoomStore(initial: number): CanvasZoomStore {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => value,
    set(nextValue: number) {
      if (nextValue === value) {
        return;
      }

      value = nextValue;

      for (const listener of [...listeners]) {
        listener();
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }
  };
}
