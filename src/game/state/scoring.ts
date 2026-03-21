import { gameStore } from '../gameStore';

const HIGH_SCORE_KEY = 'pinball_high_score';

class Scoring {
  private score = 0;
  private multiplier = 1;
  private highScore = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) ?? '0', 10);
    }
  }

  getScore() { return this.score; }
  getMultiplier() { return this.multiplier; }
  getHighScore() { return this.highScore; }

  setMultiplier(m: number) {
    this.multiplier = m;
  }

  add(base: number) {
    const pts = base * this.multiplier;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof window !== 'undefined') {
        localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      }
    }
    gameStore.emit('scoreChange', { score: this.score, highScore: this.highScore });
    return pts;
  }

  reset() {
    this.score = 0;
    this.multiplier = 1;
    gameStore.emit('scoreChange', { score: 0, highScore: this.highScore });
  }
}

export const scoring = new Scoring();
export const POINTS = {
  BUMPER: 100,
  RAMP: 500,
  TRICK_HOLE: 1000,
} as const;
