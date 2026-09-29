import { bindTouchAction } from './touch-action.js';

// Every game starts and resumes with its map visible. CSS owns the layout breakpoint;
// controllers supply the gameplay state and keep recovery rules in each game.
export function createDrivingUI(ui) {
  const shell = ui['game-shell'];
  const mapToggle = ui['map-toggle'];
  const mapPanel = ui['map-panel'];

  function setMapOpen(open) {
    shell.classList.toggle('map-open', open);
    mapToggle.setAttribute('aria-expanded', String(open));
  }
  const disposeMapAction = bindTouchAction(mapToggle, () => {
    if (!shell.classList.contains('is-driving') || mapPanel.classList.contains('hidden')) return;
    setMapOpen(!shell.classList.contains('map-open'));
  });

  return {
    setPlaying(playing, paused = false) {
      shell.classList.toggle('is-driving', playing);
      mapPanel.classList.toggle('menu-map', !playing);
      mapToggle.classList.toggle('hidden', !playing || mapPanel.classList.contains('hidden'));
      ui['menu-recover'].classList.toggle('hidden', !paused);
      setMapOpen(playing && !mapPanel.classList.contains('hidden'));
    },
    dispose() {
      disposeMapAction();
    },
  };
}
