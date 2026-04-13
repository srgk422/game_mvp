import GameCanvas from './components/GameCanvas';

export default function App() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
      }}
    >
      <GameCanvas />
    </div>
  );
}
