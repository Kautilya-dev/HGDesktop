// assets/js/app.js
const { ipcRenderer } = require('electron');

/* ─────────────────────────────
   HEADER  →  load + bootstrap
───────────────────────────── */
function loadHeader() {
  fetch('../assets/partials/header.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('header-container').innerHTML = html;

      // Re-initialise any Bootstrap components inserted dynamically
      if (window.bootstrap) {
        document
          .querySelectorAll('[data-bs-toggle="collapse"]')
          .forEach(btn => {
            new bootstrap.Collapse(
              document.querySelector(btn.dataset.bsTarget),
              { toggle: false }
            );
          });
      }

      bindHeaderControls();
    })
    .catch(err => console.error('Header load error:', err));
}
document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadHeader === 'function') loadHeader();
});
/* ─────────────────────────────
   Navigation helper
───────────────────────────── */
function navigateTo(page) {
  switch (page) {
    case 'index.html':   ipcRenderer.send('navigate-to-home');    break;
    case 'resume.html':  ipcRenderer.send('navigate-to-resume');  break;
    case 'resumes.html': ipcRenderer.send('navigate-to-resumes'); break;
    case 'chat.html':    ipcRenderer.send('navigate-to-chat', { resumeId:null, jdId:null }); break;
    default: console.warn('Unknown page:', page);
  }
}

/* ─────────────────────────────
   Stealth  /  minimise / close
───────────────────────────── */
function bindHeaderControls() {
  // Ask backend for current stealth status
  ipcRenderer.send('get-stealth-status');
}

/* Stealth round-trip */
ipcRenderer.on('stealth-status', (_e, enabled) => updateStealthBtn(enabled));

function toggleStealth() {
  const enabled = document
    .getElementById('stealthBtn')
    .classList.contains('btn-light');
  ipcRenderer.send('toggle-stealth', !enabled);
}

function updateStealthBtn(on) {
  const btn = document.getElementById('stealthBtn');
  if (!btn) return;
  if (on) {
    btn.classList.remove('btn-outline-light');
    btn.classList.add('btn-light');
    btn.innerHTML = '<i class="fas fa-eye-slash me-1"></i> Stealth On';
  } else {
    btn.classList.remove('btn-light');
    btn.classList.add('btn-outline-light');
    btn.innerHTML = '<i class="fas fa-eye me-1"></i> Stealth Off';
  }
}

/* Window controls */
function minimiseWindow() { ipcRenderer.send('minimize-window'); }
function closeWindow()    { ipcRenderer.send('close-window');    }

/* ─────────────────────────────
   Kick-start header injection
───────────────────────────── */
window.addEventListener('DOMContentLoaded', loadHeader);
