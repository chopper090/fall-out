// Nomi degli eventi con cui i sistemi comunicano
export const EVENTS = {
  STEER: 'steer',
};

// Bus di eventi: chi emette non conosce chi ascolta
export function createEventBus() {
  const handlers = new Map();
  return {
    on(name, handler) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(handler);
    },
    emit(name, payload) {
      handlers.get(name)?.forEach((handler) => handler(payload));
    },
  };
}
