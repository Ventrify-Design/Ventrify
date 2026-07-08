// ============================================================
// Ventrify OS — Design System · device-preview harness
// mountHarness(el, specimenUrl, opts) renders a resizable iframe inside a
// device frame with Phone / Tablet / Desktop / Fit presets + a custom width.
// Because it's a real iframe at a real pixel width, real CSS media queries
// fire — this is how we test ADAPTIVE layout + content across devices.
//
// Reused by widget.html and templates.html. Iframes re-sync theme live when
// any .theme-toggle fires the 'ventrify-theme' event (see ds.js initShell).
// ============================================================

const PRESETS = [
  { key: 'phone', label: 'Phone', icon: 'smartphone', w: 390 },
  { key: 'tablet', label: 'Tablet', icon: 'tablet', w: 768 },
  { key: 'desktop', label: 'Desktop', icon: 'desktop_windows', w: 1280 },
  { key: 'fit', label: 'Fit', icon: 'fit_screen', w: null }
];

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return; stylesInjected = true;
  const css = `
  .vh { border: 1px solid var(--md-sys-color-outline-variant); border-radius: 16px; overflow: hidden; background: var(--md-sys-color-surface); }
  .vh-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 10px 14px; background: var(--md-sys-color-surface-container-low); border-bottom: 1px solid var(--md-sys-color-surface-container-highest); }
  .vh-seg { display: flex; gap: 2px; background: var(--md-sys-color-surface-container-high); border-radius: 999px; padding: 3px; }
  .vh-seg button { border: none; background: transparent; color: var(--md-sys-color-on-surface-variant); height: 32px; padding: 0 12px; border-radius: 999px; font-family: 'Roboto', sans-serif; font-size: 12.5px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .vh-seg button .material-symbols-rounded { font-size: 17px; }
  .vh-seg button.on { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
  .vh-w { display: flex; align-items: center; gap: 6px; margin-left: auto; color: var(--md-sys-color-on-surface-variant); font-size: 12px; }
  .vh-w input { width: 62px; height: 32px; border-radius: 8px; border: 1px solid var(--md-sys-color-outline-variant); background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); font-family: 'Roboto Mono', monospace; font-size: 12px; text-align: center; padding: 0 4px; }
  .vh-w input::-webkit-outer-spin-button, .vh-w input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .vh-open { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--md-sys-color-outline); background: transparent; color: var(--md-sys-color-primary); font-family: 'Roboto', sans-serif; font-size: 12.5px; font-weight: 500; cursor: pointer; }
  .vh-open:hover { background: var(--md-sys-color-secondary-container); border-color: transparent; color: var(--md-sys-color-on-secondary-container); }
  .vh-open .material-symbols-rounded { font-size: 16px; }
  .vh-stage { overflow: auto; text-align: center; background: var(--md-sys-color-surface-container-lowest); background-image: radial-gradient(var(--md-sys-color-surface-container-highest) 1px, transparent 1px); background-size: 22px 22px; }
  .vh-device { display: inline-block; vertical-align: top; margin: 16px; text-align: left; background: var(--md-sys-color-surface); border: 1px solid var(--md-sys-color-outline-variant); border-radius: 18px; overflow: hidden; box-shadow: var(--md-elev-2); }
  .vh-device.fit { display: block; margin: 0; border: none; border-radius: 0; box-shadow: none; }
  .vh-device iframe { display: block; border: none; width: 100%; height: 100%; background: var(--md-sys-color-surface); }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

function curTheme() { return document.documentElement.classList.contains('light') ? 'light' : 'dark'; }
function withTheme(url, theme) { return url + (url.includes('?') ? '&' : '?') + 'theme=' + theme; }

/**
 * @param {HTMLElement} el   container to fill
 * @param {string} specimenUrl  e.g. 'specimen.html?id=verdictCard'
 * @param {object} [opts]  { height=640, start='fit' }
 */
export function mountHarness(el, specimenUrl, opts = {}) {
  injectStyles();
  const H = opts.height || 640;
  let mode = opts.start || 'fit';
  let customW = 1280;
  let url = specimenUrl;

  el.classList.add('vh');
  el.innerHTML = `
    <div class="vh-bar">
      <div class="vh-seg">${PRESETS.map(p => `<button data-k="${p.key}"><span class="material-symbols-rounded">${p.icon}</span>${p.label}</button>`).join('')}</div>
      <label class="vh-w"><span class="material-symbols-rounded" style="font-size:16px">straighten</span><input type="number" min="280" max="2200" step="1" value="${customW}"> px</label>
      <button class="vh-open"><span class="material-symbols-rounded">open_in_new</span>New window</button>
    </div>
    <div class="vh-stage" style="height:${H}px"><div class="vh-device"><iframe title="device preview" loading="lazy"></iframe></div></div>`;

  const stage = el.querySelector('.vh-stage');
  const device = el.querySelector('.vh-device');
  const iframe = el.querySelector('iframe');
  const input = el.querySelector('.vh-w input');
  const segBtns = [...el.querySelectorAll('.vh-seg button')];

  function widthFor() {
    if (mode === 'fit') return null;
    if (mode === 'custom') return customW;
    return PRESETS.find(p => p.key === mode).w;
  }
  function apply() {
    const w = widthFor();
    segBtns.forEach(b => b.classList.toggle('on', b.dataset.k === mode));
    if (w == null) {
      device.classList.add('fit');
      device.style.width = ''; device.style.height = (H) + 'px';
    } else {
      device.classList.remove('fit');
      device.style.width = w + 'px';
      device.style.height = (H - 32) + 'px';
      input.value = w;
    }
  }
  function load() { iframe.src = withTheme(url, curTheme()); }

  segBtns.forEach(b => b.addEventListener('click', () => { mode = b.dataset.k; apply(); }));
  input.addEventListener('input', () => {
    const v = parseInt(input.value, 10);
    if (!isNaN(v) && v >= 280 && v <= 2200) { customW = v; mode = 'custom'; apply(); }
  });
  el.querySelector('.vh-open').addEventListener('click', () => {
    const w = widthFor() || 1280;
    window.open(withTheme(url, curTheme()), '_blank', `width=${w},height=${Math.round(H * 1.2)},noopener,resizable,scrollbars`);
  });
  window.addEventListener('ventrify-theme', () => load());

  apply();
  load();
  return { reload: load, setUrl: (u) => { url = u; load(); } };
}
