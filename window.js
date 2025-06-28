const { BrowserWindow, Tray, Menu, screen, app } = require('electron');
const path = require('path');
const fs = require('fs');
const stealth = require('./stealth');

let mainWindow;
let tray;
let floatWindow;

function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: width / 2,
    height: height,
    x: width / 2,
    y: 0,
    alwaysOnTop: true,
    resizable: true,
    frame: true,
    skipTaskbar: true,
    backgroundThrottling: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: process.env.NODE_ENV === 'development'
    }
  });

  const indexPath = path.join(__dirname, 'views', 'index.html');
  mainWindow.loadFile(indexPath).catch(err => {
    if (process.env.NODE_ENV !== 'development') {
      fs.appendFileSync(path.join(__dirname, 'error.log'), `Failed to load index.html: ${err}\n`);
    } else {
      console.error('Failed to load index.html:', err);
    }
  });

  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath);
      const contextMenu = Menu.buildFromTemplate([
        { 
          label: 'Restore', 
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.maximize();
              if (floatWindow) floatWindow.hide();
              tray.setToolTip('HireGhost');
              if (process.env.NODE_ENV === 'development') {
                console.log('Tray restore clicked');
              }
            }
          }
        },
        { label: 'Quit', click: () => app.quit() }
      ]);
      tray.setToolTip('HireGhost');
      tray.setContextMenu(contextMenu);
      tray.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.maximize();
          if (floatWindow) floatWindow.hide();
          tray.setToolTip('HireGhost');
          if (process.env.NODE_ENV === 'development') {
            console.log('Tray icon clicked to restore');
          }
        }
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('Tray icon created successfully at:', iconPath);
      }
    } else {
      console.warn('Tray icon not found at:', iconPath);
      if (process.env.NODE_ENV !== 'development') {
        fs.appendFileSync(path.join(__dirname, 'error.log'), `Tray icon not found at: ${iconPath}\n`);
      }
    }
  } catch (error) {
    console.error('Failed to create tray:', error);
    if (process.env.NODE_ENV !== 'development') {
      fs.appendFileSync(path.join(__dirname, 'error.log'), `Failed to create tray: ${error}\n`);
    }
  }

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
    if (tray) {
      tray.setToolTip('HireGhost - Click to restore');
      if (process.env.NODE_ENV === 'development') {
        console.log('Window minimized, tray icon active');
      }
    }
    if (!floatWindow) {
      createFloatWindow();
    } else {
      floatWindow.show();
    }
    if (stealth && stealth.toggleStealth) {
      stealth.toggleStealth({ reply: () => {} }, true, mainWindow, floatWindow);
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('Main window minimized, float window shown');
    }
  });

  mainWindow.on('restore', () => {
    mainWindow.show();
    mainWindow.maximize();
    if (floatWindow) floatWindow.hide();
    if (tray) tray.setToolTip('HireGhost');
    if (process.env.NODE_ENV === 'development') {
      console.log('Main window restored');
    }
  });

  mainWindow.on('maximize', () => {
    if (floatWindow) floatWindow.hide();
    if (tray) tray.setToolTip('HireGhost');
    if (process.env.NODE_ENV === 'development') {
      console.log('Main window maximized');
    }
  });

  mainWindow.on('show', () => {
    if (floatWindow) floatWindow.hide();
    if (tray) tray.setToolTip('HireGhost');
    if (process.env.NODE_ENV === 'development') {
      console.log('Main window shown');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (floatWindow) {
      floatWindow.close();
      floatWindow = null;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('Main window closed');
    }
  });

  return { mainWindow, tray, floatWindow };
}

function createFloatWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  floatWindow = new BrowserWindow({
    width: 50,
    height: 50,
    x: width - 60,
    y: height - 60,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  floatWindow.loadFile(path.join(__dirname, 'views', 'float.html')).catch(err => {
    console.error('Failed to load float.html:', err);
    if (process.env.NODE_ENV !== 'development') {
      fs.appendFileSync(path.join(__dirname, 'error.log'), `Failed to load float.html: ${err}\n`);
    }
  });

  if (stealth && stealth.toggleStealth) {
    const floatHwnd = floatWindow ? Number(floatWindow.getNativeWindowHandle().readBigUInt64LE()) : null;
    if (floatHwnd) {
      stealth.toggleStealth({ reply: () => {} }, true, null, floatWindow);
    }
  }

  floatWindow.on('closed', () => {
    floatWindow = null;
    if (process.env.NODE_ENV === 'development') {
      console.log('Float window closed');
    }
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('Float window created');
  }
}

function loadPage(mainWindow, page, options = {}) {
  mainWindow.loadFile(path.join(__dirname, 'views', page), options).catch(err => {
    console.error(`Failed to load ${page}:`, err);
    if (process.env.NODE_ENV !== 'development') {
      fs.appendFileSync(path.join(__dirname, 'error.log'), `Failed to load ${page}: ${err}\n`);
    }
  });
}

function restoreMainWindow(mainWindow, floatWindow, tray) {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.maximize();
    if (floatWindow) floatWindow.hide();
    if (tray) tray.setToolTip('HireGhost');
    if (process.env.NODE_ENV === 'development') {
      console.log('Restore window triggered via IPC');
    }
  }
}

function minimizeMainWindow(mainWindow, floatWindow, tray) {
  if (mainWindow) {
    mainWindow.hide();
    if (tray) {
      tray.setToolTip('HireGhost - Click to restore');
      if (process.env.NODE_ENV === 'development') {
        console.log('Window minimized, tray icon active');
      }
    }
    if (!floatWindow) {
      createFloatWindow();
    } else {
      floatWindow.show();
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('Main window minimized, float window shown');
    }
  }
}

function closeApp(floatWindow) {
  if (floatWindow) {
    floatWindow.close();
  }
  app.quit();
}

module.exports = {
  createMainWindow,
  createFloatWindow,
  loadPage,
  restoreMainWindow,
  minimizeMainWindow,
  closeApp
};