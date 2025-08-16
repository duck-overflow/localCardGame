(() => {
  'use strict';

  const die = document.querySelector('.die');
  if (!die) return;

  const sides = 20;
  let lastFace = 0;

  const randomFace = () => {
    let face;
    do {
      face = Math.floor(Math.random() * sides) + 1; // 1..20
    } while (face === lastFace);
    lastFace = face;
    return face;
  };

  const rollTo = (face) => {
    die.setAttribute('data-face', String(face));
  };

  const roll = () => {
    if (die.classList.contains('rolling')) return;
    die.classList.add('rolling');
    const onEnd = () => {
      die.classList.remove('rolling');
      const face = randomFace();
      rollTo(face);
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'dice:rolled', face }, '*');
        }
      } catch (_) { /* noop */ }
    };
    die.addEventListener('animationend', onEnd, { once: true });
  };

  die.addEventListener('click', (e) => {
    e.preventDefault();
    roll();
  }, { passive: true });

  // Ensure initial visible face if none set
  if (!die.getAttribute('data-face')) {
    die.setAttribute('data-face', '1');
  }

  // Respond to parent requests to roll
  window.addEventListener('message', (e) => {
    const data = e.data || {};
    if (data && data.type === 'dice:roll') {
      roll();
    }
  });

  // Notify parent that dice is ready
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'dice:ready' }, '*');
    }
  } catch (_) { /* noop */ }
})();
