import { gameStore, GameState } from '../gameStore';

export class StateMachine {
  private state: GameState = 'IDLE';
  private ballsRemaining = 3;
  private activeBalls = 0;
  private ballLostTimer: ReturnType<typeof setTimeout> | null = null;

  getState() { return this.state; }
  getBallsRemaining() { return this.ballsRemaining; }
  getActiveBalls() { return this.activeBalls; }

  private transition(next: GameState) {
    this.state = next;
    gameStore.emit('stateChange', { state: next });
  }

  startGame() {
    if (this.state !== 'IDLE') return;
    this.ballsRemaining = 3;
    this.transition('LAUNCHING');
  }

  ballLaunched() {
    if (this.state !== 'LAUNCHING') return;
    this.activeBalls = 1;
    this.transition('PLAYING');
  }

  multiBallStart() {
    if (this.state !== 'PLAYING') return;
    this.activeBalls = 2;
    this.transition('MULTIBALL');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gameStore.emit('multiBallStart', undefined as any);
  }

  ballDrained(_ballId: number) {
    if (this.state === 'BALL_LOST') return; // discard
    this.activeBalls = Math.max(0, this.activeBalls - 1);
    if (this.activeBalls >= 1) {
      // Return to PLAYING from MULTIBALL
      if (this.state === 'MULTIBALL') {
        this.transition('PLAYING');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gameStore.emit('multiBallEnd', undefined as any);
      }
      return;
    }
    // Last ball drained
    this.ballsRemaining -= 1;
    gameStore.emit('ballChange', { ballsRemaining: this.ballsRemaining });
    this.transition('BALL_LOST');
    this.ballLostTimer = setTimeout(() => {
      if (this.ballsRemaining > 0) {
        this.transition('LAUNCHING');
      } else {
        this.transition('GAME_OVER');
      }
    }, 1500);
  }

  reset() {
    if (this.ballLostTimer) clearTimeout(this.ballLostTimer);
    this.state = 'IDLE';
    this.ballsRemaining = 3;
    this.activeBalls = 0;
    this.transition('IDLE');
  }
}

export const stateMachine = new StateMachine();
