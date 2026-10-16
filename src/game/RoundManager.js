'use strict';

// Placeholder for future local matches. Kept tiny on purpose.
class RoundManager {
  constructor() {
    this.state = 'test';
    this.round = 1;
  }

  startRound() {
    this.state = 'playing';
  }

  endRound(/* winner */) {
    this.state = 'roundOver';
  }

  reset() {
    this.state = 'test';
    this.round = 1;
  }
}
