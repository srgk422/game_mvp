import Phaser from 'phaser';

export const EventBus = new Phaser.Events.EventEmitter();

export const Events = {
  SERVER_UPDATE: 'SERVER_UPDATE',
  PLAYER_INPUT: 'PLAYER_INPUT',
} as const;
