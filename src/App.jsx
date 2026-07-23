import { Analytics } from '@vercel/analytics/react';
import GameScreen from './GameScreen';
import './App.css';

function App() {
  return (
    <div className="fullscreen-game-container">
      <GameScreen />
      <Analytics />
    </div>
  );
}

export default App;