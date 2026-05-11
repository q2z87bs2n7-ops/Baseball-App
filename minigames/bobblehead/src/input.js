import { state, PHASES } from './state.js';

export function bindInput({ swingBtn, onSwingPress }) {
  const press = () => {
    if (state.phase === PHASES.IDLE || state.phase === PHASES.RESULT || state.phase === PHASES.GAME_OVER) {
      onSwingPress({ kind: 'pitch' });
    } else if (state.phase === PHASES.PITCHING && state.swing.armed) {
      onSwingPress({ kind: 'swing', timing: state.pitch.t });
    }
  };

  swingBtn.addEventListener('click', press);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      press();
    }
  });
}
