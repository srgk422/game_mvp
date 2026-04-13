import { useEffect, useState } from 'react';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import { EventBus, Events } from './core/EventBus';
import type { GameState } from './types/game';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    const handler = (state: GameState) => setGameState(state);
    EventBus.on(Events.SERVER_UPDATE, handler);
    return () => {
      EventBus.off(Events.SERVER_UPDATE, handler);
    };
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
    }}>
      <GameCanvas />
      <HUD state={gameState} />
    </div>
  );
}
