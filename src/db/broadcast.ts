type SyncMessage =
  | {
      type: 'DATA_CHANGED';
      store: string;
      id?: string;
      timestamp: number;
    }
  | {
      type: 'AUTH_LOGOUT';
      timestamp: number;
    };

let channel: BroadcastChannel | null = null;
const listeners: Set<() => void> = new Set();
const authListeners: Set<() => void> = new Set();

export function initBroadcastSync() {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    if (!channel) {
      channel = new BroadcastChannel('community_connect_sync');
      channel.onmessage = (event) => {
        if (event.data) {
          if (event.data.type === 'DATA_CHANGED') {
            listeners.forEach((listener) => listener());
          } else if (event.data.type === 'AUTH_LOGOUT') {
            authListeners.forEach((listener) => listener());
          }
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

export function broadcastLogout() {
  if (channel) {
    const msg: SyncMessage = {
      type: 'AUTH_LOGOUT',
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

export function subscribeToAuthSync(listener: () => void): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

