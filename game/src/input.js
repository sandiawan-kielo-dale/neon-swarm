// Keyboard, mouse and touch input. Produces one frame of intent per read:
// movement (-1..1), aim in field coordinates, firing, and edge-triggered actions.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

export function createInput(canvas, toField) {
  const keys = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let touchActive = false;
  let touchX = 0;
  let touchY = 0;
  let actions = 0;

  function fieldOf(clientX, clientY) {
    return toField(clientX, clientY);
  }

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.key.toLowerCase());
    if (event.key === 'Enter' || event.key === ' ') actions |= ACTION_CONFIRM;
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') actions |= ACTION_PAUSE;
    if (event.key === 'm' || event.key === 'M') actions |= ACTION_MUTE;
    if (event.key === 'r' || event.key === 'R') actions |= ACTION_RESTART;
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function onMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
  }

  function onMouseDown(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  }

  function onMouseUp() {
    mouseDown = false;
  }

  function onTouchStart(event) {
    event.preventDefault();
    const t = event.changedTouches[0];
    touchActive = true;
    touchX = t.clientX;
    touchY = t.clientY;
    actions |= ACTION_CONFIRM;
  }

  function onTouchMove(event) {
    event.preventDefault();
    const t = event.changedTouches[0];
    touchX = t.clientX;
    touchY = t.clientY;
  }

  function onTouchEnd(event) {
    event.preventDefault();
    touchActive = false;
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
    touchActive = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

  return {
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // Movement + aim for this frame. `player` is used for touch steering.
    read(player) {
      let mx = 0;
      let my = 0;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
      if (keys.has('d') || keys.has('arrowright')) mx += 1;
      if (keys.has('w') || keys.has('arrowup')) my -= 1;
      if (keys.has('s') || keys.has('arrowdown')) my += 1;
      const aim = fieldOf(mouseX, mouseY);
      let aimX = aim.x;
      let aimY = aim.y;
      let firing = mouseDown || keys.has(' ');
      if (touchActive && player) {
        const target = fieldOf(touchX, touchY);
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const d = Math.hypot(dx, dy);
        if (d > 12) {
          mx = dx / d;
          my = dy / d;
        }
        aimX = target.x;
        aimY = target.y;
        firing = true;
      }
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      return { mx, my, aimX, aimY, firing };
    },
  };
}
