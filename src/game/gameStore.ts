type EventMap = {
  stateChange: { state: GameState };
  scoreChange: { score: number; highScore: number };
  ballChange: { ballsRemaining: number };
  multiBallStart: void;
  multiBallEnd: void;
  chargeChange: { charge: number }; // 0–1, updated each frame during charging
  launchFire: { charge: number };   // fired once on Space release with final charge (0–1)
};

export type GameState =
  | 'IDLE'
  | 'LAUNCHING'
  | 'PLAYING'
  | 'MULTIBALL'
  | 'BALL_LOST'
  | 'GAME_OVER';

type Listener<T> = (payload: T) => void;

class GameStore {
  private listeners: Map<keyof EventMap, Listener<any>[]> = new Map();

  on<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(fn as any);
    return () => this.off(event, fn);
  }

  off<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>) {
    const updated = (this.listeners.get(event) ?? []).filter(f => f !== fn);
    if (updated.length === 0) {
      this.listeners.delete(event);
    } else {
      this.listeners.set(event, updated);
    }
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    (this.listeners.get(event) ?? []).forEach(fn => {
      try {
        (fn as any)(payload);
      } catch (e) {
        console.error(`[gameStore] listener error for "${String(event)}":`, e);
      }
    });
  }
}

export const gameStore = new GameStore();
