// ─────────────────────────────────────────────────────
//  main.js  • HireGhost Desktop (Electron)
// ─────────────────────────────────────────────────────

require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron');
const path   = require('path');
const fs     = require('fs');
const windowManager = require('./window');
const stealth       = require('./stealth');
let transcriptionInterval = null;


const { spawn } = require('child_process');

const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey:"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"
});


// — NEW: audio-capture for WASAPI loopback —
const capture = require('audio-capture');
const { Writable } = require('stream');

// — Enable @electron/remote —
require('@electron/remote/main').initialize();

// ───── Globals ──────────────────────────────────────
let mainWindow, tray, floatWindow;
let isStealthEnabled = false;

// — JSON resume save location —
const resumeSavePath = path.join(__dirname, 'data');
console.log('📁 Resume save path:', resumeSavePath);
try {
  if (!fs.existsSync(resumeSavePath)) fs.mkdirSync(resumeSavePath, { recursive: true });

  const files = fs.readdirSync(resumeSavePath).filter(f => f.endsWith('.json'));
  console.log(`📄 Found ${files.length} resumes in /data`);
  files.forEach(file => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(resumeSavePath, file), 'utf-8'));
      console.log(`   └─ ${file}: ${content.displayName || '[No displayName]'}`);
    } catch (err) {
      console.warn(`   ⚠️  Unable to read ${file}:`, err.message);
    }
  });
} catch (err) {
  console.error('Failed to initialise /data:', err.message);
}

// ───── Utility: Logger ──────────────────────────────
function logFatal(label, err) {
  const full = `❌ ${label}: ${err?.message || err}\n${err?.stack || ''}\n`;
  console.error(full);
  try { fs.appendFileSync(path.join(__dirname, 'error.log'), full); } catch {/* ignore */ }
}

// ───── Create BrowserWindow / Tray / Float ─────────
function createWindow() {
  const { mainWindow: win, tray: t, floatWindow: fw } = windowManager.createMainWindow();
  mainWindow  = win;
  tray        = t;
  floatWindow = fw;

  mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
    const lv = ['LOG','WARN','ERROR','INFO','DEBUG'][level] || level;
    console.log(`🖥️  [Renderer ${lv}] ${message}  (${source}:${line})`);
  });

  require('@electron/remote/main').enable(mainWindow.webContents);

  mainWindow.on('resize', () => {
    const [w, h] = mainWindow.getContentSize();
    mainWindow.webContents.send('window-resize', { width: w, height: h });
  });
}

// ───── App Lifecycle ───────────────────────────────
app.whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((err) => {
    logFatal('App init error', err);
    app.quit();
  });

// ────────────────────────────────────────────────────
//  IPC ROUTES
// ────────────────────────────────────────────────────

// — Navigation —
ipcMain.on('navigate-to-home',    () => windowManager.loadPage(mainWindow, 'index.html'));
ipcMain.on('navigate-to-resume',  (e, args) => windowManager.loadPage(mainWindow, 'resume.html', args));
ipcMain.on('navigate-to-resumes', () => windowManager.loadPage(mainWindow, 'resumes.html'));
ipcMain.on('navigate-to-chat',    (e,{resumeId,jdId}) =>
  windowManager.loadPage(mainWindow,'chat.html',{search:`?resumeId=${resumeId}&jdId=${jdId}`})
);
ipcMain.on('restore-window', () =>
  windowManager.restoreMainWindow(mainWindow, floatWindow, tray)
);

// — JSON Resume SAVE —
ipcMain.on('save-resume', (event, data) => {
  try {
    if (!data.displayName) throw new Error('Display Name is required');
    const targetFile = data._sourceFile
      ? path.join(resumeSavePath, data._sourceFile)
      : null;

    const files = fs.readdirSync(resumeSavePath).filter(f => f.endsWith('.json'));
    const duplicate = files.find(file => {
      const fullPath = path.join(resumeSavePath, file);
      const json = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      if (targetFile && path.resolve(fullPath) === path.resolve(targetFile)) return false;
      return (json.displayName || '').trim().toLowerCase() === data.displayName.trim().toLowerCase();
    });

    if (duplicate) throw new Error('A resume with this Display Name already exists');

    const saveFile = targetFile || path.join(resumeSavePath, `resume-${Date.now()}.json`);
    fs.writeFileSync(saveFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log('✅ Resume saved to:', saveFile);
    event.reply('resume-saved', saveFile);
  } catch (err) {
    console.error('❌ Save failed:', err.message);
    event.reply('resume-save-error', err.message);
  }
});

// — Stealth Mode —
ipcMain.on('get-stealth-status', (e) => {
  e.sender.send('stealth-status', isStealthEnabled);
});
ipcMain.on('toggle-stealth', (e, enable) => {
  isStealthEnabled = stealth.toggleStealth(e, enable, mainWindow, floatWindow);
  e.sender.send('stealth-status', isStealthEnabled);
});

// — Window Controls —
ipcMain.on('minimize-window', () =>
  windowManager.minimizeMainWindow(mainWindow, floatWindow, tray)
);
ipcMain.on('close-window', () =>
  windowManager.closeApp(floatWindow)
);

// — Chat (OpenAI) —
ipcMain.handle('openai-chat', async (event, prompt) => {
  try {
    console.log('🔷 [OpenAI Chat] Received prompt:', prompt);
    const response = await openai.chat.completions.create({

      model: "gpt-4.1",
      messages: [
        { role: "system", content: "You are a helpful AI job seeker responding confidently to interview questions." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });
    console.log('✅ [OpenAI Chat] Response:', response.choices[0].message.content);
    return response.choices[0].message.content;
  } catch (err) {
    console.error('❌ [OpenAI Chat] Error:', err);
    return "Sorry, an error occurred while fetching response.";
  }
});

ipcMain.handle('voice-chat', async () => {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    const { app } = require('electron');

    // Determine speech_service.exe path based on environment
    const isDev = process.env.NODE_ENV === 'development';
    let pythonServicePath;

    if (isDev) {
      pythonServicePath = path.join(__dirname, 'python_services', 'speech_service.exe');
    } else {
      // In production, extraResources are in process.resourcesPath
      pythonServicePath = path.join(process.resourcesPath, 'python_services', 'speech_service.exe');
    }

    console.log("🛠️ Python service path:", pythonServicePath);

    if (!fs.existsSync(pythonServicePath)) {
      const errMsg = "❌ speech_service.exe not found at: " + pythonServicePath;
      console.error(errMsg);
      reject(errMsg);
      return;
    }

    const python = spawn(pythonServicePath);
    let output = '';

  python.stdout.on('data', async (data) => {
  const text = data.toString();
  console.log('📥 [STDOUT] Python output received:', text);
  output += text;

  // Save full raw output to debug file for analysis
  const debugLogPath = path.join(app.getPath('userData'), 'transcription_debug.log');
  fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] ${text}\n`);

  try {
    const parsed = JSON.parse(text);
    const transcript = parsed.transcript;

    if (!transcript || transcript.trim() === "") {
      console.log('⚠️ No speech detected.');
      return;
    }

    console.log('🎤 Transcript parsed successfully:', transcript);

    // Emit transcript (question) immediately
    mainWindow.webContents.send('auto-transcript-response', {
      question: transcript,
      answer: null
    });

    // Call OpenAI for response
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: "You are a helpful AI job seeker responding confidently to interview questions." },
          { role: "user", content: transcript }
        ],
        temperature: 0.7
      });

      const chatAnswer = response.choices[0].message.content;
      console.log('🤖 ChatGPT Response:', chatAnswer);

      // Emit answer
      mainWindow.webContents.send('auto-transcript-response', {
        question: null,
        answer: chatAnswer
      });

    } catch (apiErr) {
      console.error('❌ OpenAI Chat API Error:', apiErr);
      mainWindow.webContents.send('auto-transcript-response', {
        question: null,
        answer: "Error fetching answer: " + apiErr.message
      });
    }

  } catch (err) {
    console.error('❌ JSON parse error. This line was ignored:', text);
    fs.appendFileSync(debugLogPath, `[PARSE ERROR] ${err.message}\n`);
  }
});


python.stderr.on('data', (data) => {
  const text = data.toString();
  console.error('❌ [STDERR] Python error output:', text);
  const debugLogPath = path.join(app.getPath('userData'), 'transcription_debug.log');
  fs.appendFileSync(debugLogPath, `[STDERR ${new Date().toISOString()}] ${text}\n`);
});


python.on('close', (code) => {
  console.log(`🔻 Python process exited with code ${code}`);
  const debugLogPath = path.join(app.getPath('userData'), 'transcription_debug.log');
  fs.appendFileSync(debugLogPath, `[CLOSE ${new Date().toISOString()}] Exit code: ${code}\n`);
});

    python.on('error', (err) => {
      console.error('❌ Failed to start Python process:', err);
      reject('Failed to start Python process: ' + err);
    });
  });
});


ipcMain.on('toggle-voice', (event, isEnabled) => {
  console.log('🔁 Voice transcription toggled:', isEnabled);
  voiceTranscriptionEnabled = isEnabled;

  if (isEnabled) {
    console.log('🟢 Starting continuous transcription loop...');
    startContinuousTranscription();
  } else {
    console.log('🛑 Voice transcription turned off.');
    if (transcriptionInterval) {
      clearInterval(transcriptionInterval);
      transcriptionInterval = null;
    }
  }
});


function startContinuousTranscription() {
  console.log('🔴 Entered startContinuousTranscription() function');

  const runTranscription = () => {
    if (!voiceTranscriptionEnabled) {
      console.log('🛑 Voice transcription disabled. Clearing interval.');
      clearInterval(transcriptionInterval);
      transcriptionInterval = null;
      return;
    }

    let pythonServicePath;
    if (app.isPackaged) {
      // Production: use speech_service.exe in resources
      pythonServicePath = path.join(process.resourcesPath, 'python_services', 'speech_service.exe');
    } else {
      // Development: use python script directly
      pythonServicePath = 'python';
    }

    console.log('🟢 Running speech_service:', pythonServicePath);

    let python;
    if (app.isPackaged) {
      if (!fs.existsSync(pythonServicePath)) {
        console.error('❌ speech_service.exe not found at:', pythonServicePath);
        return;
      }
      python = spawn(pythonServicePath);
    } else {
      python = spawn(pythonServicePath, ['python_services/speech_service.py']);
    }

    let output = '';

    python.stdout.on('data', async (data) => {
  const text = data.toString();
  console.log('📥 [STDOUT] Python output received:', text);
  output += text;

  // Save full raw output to debug file for analysis
  const debugLogPath = path.join(app.getPath('userData'), 'transcription_debug.log');
  fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] ${text}\n`);

  try {
    const parsed = JSON.parse(text);
    const transcript = parsed.transcript;

    if (!transcript || transcript.trim() === "") {
      console.log('⚠️ No speech detected.');
      return;
    }

    console.log('🎤 Transcript parsed successfully:', transcript);

    // Emit transcript (question) immediately
    mainWindow.webContents.send('auto-transcript-response', {
      question: transcript,
      answer: null
    });

    // Call OpenAI for response
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: "You are a helpful AI job seeker responding confidently to interview questions." },
          { role: "user", content: transcript }
        ],
        temperature: 0.7
      });

      const chatAnswer = response.choices[0].message.content;
      console.log('🤖 ChatGPT Response:', chatAnswer);

      // Emit answer
      mainWindow.webContents.send('auto-transcript-response', {
        question: null,
        answer: chatAnswer
      });

    } catch (apiErr) {
      console.error('❌ OpenAI Chat API Error:', apiErr);
      mainWindow.webContents.send('auto-transcript-response', {
        question: null,
        answer: "Error fetching answer: " + apiErr.message
      });
    }

  } catch (err) {
    console.error('❌ JSON parse error. This line was ignored:', text);
    fs.appendFileSync(debugLogPath, `[PARSE ERROR] ${err.message}\n`);
  }
});

python.stderr.on('data', (data) => {
  const text = data.toString();
  console.error('❌ [STDERR] Python error output:', text);
  const debugLogPath = path.join(app.getPath('userData'), 'transcription_debug.log');
  fs.appendFileSync(debugLogPath, `[STDERR ${new Date().toISOString()}] ${text}\n`);
});


python.on('close', (code) => {
  console.log(`🔻 Python process exited with code ${code}`);
  const debugLogPath = path.join(app.getPath('userData'), 'transcription_debug.log');
  fs.appendFileSync(debugLogPath, `[CLOSE ${new Date().toISOString()}] Exit code: ${code}\n`);
});
  };

  // Start interval to run every 5 seconds
  if (!transcriptionInterval) {
    transcriptionInterval = setInterval(runTranscription, 5000);
    runTranscription(); // Run immediately
  }
}

