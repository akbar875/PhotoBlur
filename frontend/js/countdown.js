export class Countdown {
  constructor(onTick, onComplete) {
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    let value = 3;
    this.onTick(value);

    this.timer = window.setInterval(() => {
      value -= 1;
      if (value > 0) {
        this.onTick(value);
        return;
      }

      this.stop(false);
      this.onTick("");
      this.onComplete();
    }, 900);
  }

  stop(clearDisplay = true) {
    window.clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    if (clearDisplay) this.onTick("");
  }
}
