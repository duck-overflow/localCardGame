(function(){
  const THRESHOLD = 11;
  const iframe = document.getElementById('dice-frame');
  const diceWrap = document.getElementById('dice-wrap');
  const chk = document.getElementById('chk');
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');
  const thresholdEl = document.getElementById('dice-threshold');
  const diceResult = document.getElementById('dice-result');
  const diceFace = document.getElementById('dice-face');
  if (thresholdEl) thresholdEl.textContent = String(THRESHOLD);
  let diceReady = false;
  let pending = null; // { form, timeoutId }

  function setHidden(form, name, value) {
    let input = form.querySelector('input[name="' + name + '"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    input.value = value;
  }

  function activeForm() {
    // Annahme: unchecked => signup, checked => login
    return (chk && chk.checked) ? loginForm : signupForm;
  }

  function fieldsFilled(form) {
    if (!form) return false;
    const u = form.querySelector('input[name="username"]');
    const p = form.querySelector('input[name="password"]');
    return !!(u && p && u.value.trim() && p.value.trim());
  }

  function updateDiceEnabled() {
    const form = activeForm();
    const ok = fieldsFilled(form);
    if (iframe) iframe.style.pointerEvents = ok ? 'auto' : 'none';
    if (diceWrap) diceWrap.classList.toggle('disabled', !ok);
  }

  window.addEventListener('message', (e) => {
    const data = e.data || {};
    if (data.type === 'dice:ready') {
      diceReady = true;
    }
    if (data.type === 'dice:rolled') {
      const face = Number(data.face);
      if (pending) {
        const { form, timeoutId } = pending;
        pending = null;
        if (timeoutId) clearTimeout(timeoutId);
        setHidden(form, 'dice_roll', Number.isFinite(face) ? String(face) : '');
        if (diceFace && diceResult) {
          diceFace.textContent = String(face);
          diceResult.hidden = false;
        }
        setTimeout(() => form.submit(), 3000);
      } else {
        // Fallback: user clicked inside the iframe directly
        const form = activeForm();
        if (fieldsFilled(form)) {
          setHidden(form, 'dice_roll', Number.isFinite(face) ? String(face) : '');
          form.submit();
        }
      }
    }
  });

  function requestRollThenSubmit(form) {
    if (!iframe || !iframe.contentWindow) {
      // Fallback: submit without dice value
      return form.submit();
    }
    // Ask dice to roll; wait for result, but never block submission indefinitely
    const timeoutId = setTimeout(() => {
      if (pending && pending.form === form) {
        pending = null;
        // Fallback value when dice didn't answer
        setHidden(form, 'dice_roll', '');
        form.submit();
      }
    }, 1500);
    pending = { form, timeoutId };
    iframe.contentWindow.postMessage({ type: 'dice:roll' }, '*');
  }

  // Intercept both forms: immer submitten, aber via Würfel triggern
  ;[signupForm, loginForm].forEach(f => {
    if (!f) return;
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!fieldsFilled(f)) return; // Sicherheitscheck
      if (diceReady) {
        requestRollThenSubmit(f);
      } else {
        setHidden(f, 'dice_roll', '');
        f.submit();
      }
    });
    // Realtime-Enable, wenn Inputs ausgefüllt
    f.querySelectorAll('input[name="username"], input[name="password"]').forEach(inp => {
      inp.addEventListener('input', updateDiceEnabled);
    });
  });

  // Würfel-Klick: roll + submit aktives Formular
  const diceClick = () => {
    const form = activeForm();
    if (!fieldsFilled(form)) return;
    if (diceReady) {
      requestRollThenSubmit(form);
    } else {
      setHidden(form, 'dice_roll', '');
      if (diceFace && diceResult) {
        diceFace.textContent = '-';
        diceResult.hidden = false;
      }
      setTimeout(() => form.submit(), 3000);
    }
  };
  // Klick auf Wrapper delegieren (zusätzlich zum iframe-internen Click)
  if (diceWrap) diceWrap.addEventListener('click', diceClick);

  if (chk) chk.addEventListener('change', updateDiceEnabled);
  updateDiceEnabled();
})();
