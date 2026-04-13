import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { Boot } from '../scenes/Boot';
import { Game } from '../scenes/Game';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1280,
      height: 720,
      backgroundColor: '#1a1a2e',
      parent: containerRef.current ?? undefined,
      scene: [Boot, Game],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    const game = new Phaser.Game(config);

    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} />;
}
