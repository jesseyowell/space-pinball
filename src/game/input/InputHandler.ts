import { stateMachine } from '../state/StateMachine';
import { Flipper, activateFlipper, deactivateFlipper } from '../physics/flippers';
import { gameStore } from '../gameStore';

export class InputHandler {
  private chargeStart: number | null = null;
  private maxCharge = 2000; // ms

  constructor(private flippers: { left: Flipper; right: Flipper }) {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
  }

  private onDown = (e: KeyboardEvent) => {
    const state = stateMachine.getState();

    if ((e.code === 'Space' || e.code === 'Enter') && state === 'IDLE') {
      e.preventDefault();
      stateMachine.startGame();
      return;
    }

    if (state === 'LAUNCHING' && e.code === 'Space' && this.chargeStart === null) {
      e.preventDefault();
      this.chargeStart = performance.now();
    }

    if (state === 'PLAYING' || state === 'MULTIBALL') {
      if (e.code === 'ArrowLeft' || e.code === 'KeyZ') activateFlipper(this.flippers.left);
      if (e.code === 'ArrowRight' || e.code === 'Slash') activateFlipper(this.flippers.right);
    }
  };

  private onUp = (e: KeyboardEvent) => {
    const state = stateMachine.getState();

    if (state === 'LAUNCHING' && e.code === 'Space' && this.chargeStart !== null) {
      const charge = Math.min(1, (performance.now() - this.chargeStart) / this.maxCharge);
      this.chargeStart = null;
      gameStore.emit('chargeChange', { charge: 0 }); // reset bar
      gameStore.emit('launchFire', { charge });       // dedicated fire event
    }

    if (e.code === 'ArrowLeft' || e.code === 'KeyZ') deactivateFlipper(this.flippers.left);
    if (e.code === 'ArrowRight' || e.code === 'Slash') deactivateFlipper(this.flippers.right);
  };

  // Called each frame during LAUNCHING to update charge bar
  tickCharge() {
    if (this.chargeStart === null) return;
    const charge = Math.min(1, (performance.now() - this.chargeStart) / this.maxCharge);
    gameStore.emit('chargeChange', { charge });
  }

  destroy() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
  }
}
