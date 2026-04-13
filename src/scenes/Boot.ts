import Phaser from 'phaser';

export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    // load global assets here
  }

  create(): void {
    this.scene.start('Game');
  }
}
