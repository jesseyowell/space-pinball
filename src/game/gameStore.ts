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
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    const idx = listeners.indexOf(fn as any);
    if (idx >= 0) listeners.splice(idx, 1);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(fn => (fn as any)(payload));
    }
  }
}

export const gameStore = new GameStore();
