// ───────────────────────────────────────────────
// stealth.js • HireGhost Desktop
// ───────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const os = require('os');

let stealthInstance;

// Determine log path
let logPath;
try {
  const { app } = require('electron');
  logPath = app.getPath('userData');
} catch {
  logPath = os.homedir();
}
const errorLogFile = path.join(logPath, 'error.log');

// Initialize stealthInstance safely
try {
  const { StealthMode } = require('./native/build/Release/stealth');
  stealthInstance = new StealthMode();
} catch (error) {
  const errMsg = `Failed to load stealth addon: ${error.message}`;
  console.error(errMsg);
  fs.appendFileSync(errorLogFile, `${errMsg}\n`);
}

function getStealthStatus(event, isStealthEnabled) {
  event.reply('stealth-status-update', isStealthEnabled ? 'Stealth mode enabled' : 'Stealth mode disabled');
}

function toggleStealth(event, enable, mainWindow, floatWindow) {
  let isStealthEnabled = false;

  if (!stealthInstance) {
    const errorMsg = 'Error: Stealth mode not available';
    console.error(errorMsg);
    fs.appendFileSync(errorLogFile, `${errorMsg}\n`);
    event.reply('stealth-status', errorMsg);
    event.reply('stealth-status-update', 'Stealth mode disabled');
    return isStealthEnabled;
  }

  const hwnd = mainWindow ? Number(mainWindow.getNativeWindowHandle().readBigUInt64LE()) : null;
  const floatHwnd = floatWindow ? Number(floatWindow.getNativeWindowHandle().readBigUInt64LE()) : null;

  try {
    if (enable) {
      let mainResult = true;
      let floatResult = true;
      if (hwnd) mainResult = stealthInstance.enableStealthMode(hwnd);
      if (floatHwnd) floatResult = stealthInstance.enableStealthMode(floatHwnd);
      const status = (mainResult && floatResult) ? 'Stealth mode enabled' : 'Failed to enable stealth mode';
      isStealthEnabled = mainResult && floatResult;
      event.reply('stealth-status', status);
      event.reply('stealth-status-update', status);
    } else {
      let mainResult = true;
      let floatResult = true;
      if (hwnd) mainResult = stealthInstance.disableStealthMode(hwnd);
      if (floatHwnd) floatResult = stealthInstance.disableStealthMode(floatHwnd);
      const status = (mainResult && floatResult) ? 'Stealth mode disabled' : 'Failed to disable stealth mode';
      isStealthEnabled = !(mainResult && floatResult);
      event.reply('stealth-status', status);
      event.reply('stealth-status-update', status);
    }
  } catch (error) {
    const errorMsg = `Error: ${error.message}`;
    console.error(errorMsg);
    fs.appendFileSync(errorLogFile, `${errorMsg}\n`);
    event.reply('stealth-status', errorMsg);
    event.reply('stealth-status-update', 'Stealth mode disabled');
    isStealthEnabled = false;
  }

  return isStealthEnabled;
}

module.exports = {
  getStealthStatus,
  toggleStealth
};
