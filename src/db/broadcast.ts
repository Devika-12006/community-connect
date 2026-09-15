type SyncMessage = {
  type: 'DATA_CHANGED';
  store: string;
  id?: string;
  timestamp: number;
};

let channel: BroadcastChannel | null = null;
const listeners: Set<() => void> = new Set();

export function initBroadcastSync() {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    if (!channel) {
      channel = new BroadcastChannel('community_connect_sync');
      channel.onmessage = (event) => {
        if (event.data && event.data.type === 'DATA_CHANGED') {
          listeners.forEach((listener) => listener());
        }
      };
    }
  }
}

export function broadcastDataChange(store: string, id?: string) {
  if (channel) {
    const msg: SyncMessage = {
      type: 'DATA_CHANGED',
      store,
      id,
      timestamp: Date.now(),
    };
    channel.postMessage(msg);
  }
}

export function subscribeToSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
