import type { GameState } from '../types/game';

interface HUDProps {
  state: GameState | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function HUD({ state }: HUDProps) {
  if (!state) return null;

  const { status, timer, coreHP } = state.room;
  const isParalyzed = state.player.status === 'PARALYZED';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      fontFamily: 'monospace',
      color: '#fff',
    }}>
      {/* Paralysis warning */}
      {isParalyzed && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -80%)',
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#ffff00',
          textShadow: '0 0 20px #ffff00, 0 0 40px rgba(255,255,0,0.4)',
          animation: 'pulse 0.6s ease-in-out infinite alternate',
          whiteSpace: 'nowrap',
        }}>
          SYSTEM FAILURE: PARALYZED
        </div>
      )}

      {/* Top bar: timer + core HP */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 24px',
      }}>
        {/* Timer */}
        <div style={{ fontSize: '20px' }}>
          <span style={{ opacity: 0.6 }}>TIME </span>
          <span style={{ color: timer <= 30 ? '#ff4444' : '#fff' }}>
            {formatTime(timer)}
          </span>
        </div>

        {/* Core HP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px', opacity: 0.6 }}>CORE</span>
          <div style={{
            width: '160px',
            height: '16px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${coreHP}%`,
              height: '100%',
              background: coreHP > 30
                ? 'linear-gradient(90deg, #00cc66, #00ffaa)'
                : 'linear-gradient(90deg, #ff4444, #ffaa00)',
              transition: 'width 0.15s ease',
            }} />
          </div>
          <span style={{ fontSize: '16px', minWidth: '40px' }}>{coreHP}%</span>
        </div>
      </div>

      {/* End-game overlay */}
      {status !== 'ACTIVE' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
        }}>
          <div style={{
            fontSize: '56px',
            fontWeight: 'bold',
            color: status === 'WON' ? '#00ffaa' : '#ff4444',
            textShadow: `0 0 30px ${status === 'WON' ? '#00ffaa' : '#ff4444'}`,
          }}>
            {status === 'WON' ? 'VICTORY' : 'CONNECTION LOST (TIME OUT)'}
          </div>
        </div>
      )}
    </div>
  );
}
