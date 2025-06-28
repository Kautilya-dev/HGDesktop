// ─────────────────────────────────────────────────────
//  Resumes.js  • HireGhost Desktop (Electron)
// ─────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const remote = require('@electron/remote');
let voiceOn = false;


const resumeDir = path.join(remote.app.getAppPath(), 'data');
console.log('🔍 Résumé directory resolved to:', resumeDir);

const fmtDate = d => new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
const $ = sel => document.querySelector(sel);

function safeJSON(fp) {
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    // Ensure jobDescriptions is always an array
    if (!Array.isArray(data.jobDescriptions)) data.jobDescriptions = [];
    // Filter out falsy or empty items
    data.jobDescriptions = data.jobDescriptions.filter(jd => jd && jd.title);
    return data;
  } catch (e) {
    console.warn(`⚠️ Bad JSON: ${path.basename(fp)} – ${e.message}`);
    return { jobDescriptions: [] };
  }
}


function renderSidebar() {
  const list = $('#resumeList');
  list.innerHTML = '';

  if (!fs.existsSync(resumeDir)) {
    list.innerHTML = `<div class="text-danger small px-3 py-2">No resume folder at ${resumeDir}</div>`;
    return;
  }

  const files = fs.readdirSync(resumeDir).filter(f => f.endsWith('.json'));
  if (!files.length) {
    list.innerHTML = '<p class="text-muted small">No resumes found.</p>';
    return;
  }

  console.log(`📄 Found ${files.length} resumes`);

  files.forEach(file => {
    const fp = path.join(resumeDir, file);
    const data = safeJSON(fp);
    if (!data) return;

    const card = document.createElement('ol');
    card.className = 'list-group';
    card.innerHTML = `
<li class="list-group-item d-flex justify-content-between align-items-center">
  <div class="fw-bold" onclick="loadResumeJDs('${file}')" style="cursor:pointer;">${data.displayName || file.replace('.json','')}</div>
  <div class="dropdown">
    <button class="btn btn-sm btn-light text-dark dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"></button>
    <ul class="dropdown-menu dropdown-menu-end">
      <li><a class="dropdown-item" onclick="editResume('${file}')"><i class="fas fa-pen me-1"></i>Edit</a></li>
      <li><a class="dropdown-item" onclick="openRename('${file}')"><i class="fas fa-i-cursor me-1"></i>Rename</a></li>
      <li><a class="dropdown-item" onclick="duplicateResume('${file}')"><i class="fas fa-copy me-1"></i>Duplicate</a></li>
      <li><hr class="dropdown-divider"></li>
      <li><a class="dropdown-item text-danger" onclick="confirmDeleteResume('${file}')"><i class="fas fa-trash me-1"></i>Delete</a></li>
    </ul>
  </div>
</li>`;
    list.appendChild(card);
  });
}

function editResume(file) {
  ipcRenderer.send('navigate-to-resume', { search: `?file=${encodeURIComponent(file)}` });
}

let renameTarget = null;
function openRename(file) {
  renameTarget = file;
  $('#renameInput').value = safeJSON(path.join(resumeDir, file))?.displayName || '';
  bootstrap.Modal.getOrCreateInstance('#renameModal').show();
}

$('#renameSave').addEventListener('click', () => {
  if (!renameTarget) return;

  const newName = $('#renameInput').value.trim();
  if (!newName) {
    alert('Display name cannot be empty.');
    return;
  }

  const fp = path.join(resumeDir, renameTarget);
  const json = safeJSON(fp);
  if (!json) {
    alert('Error reading resume data.');
    return;
  }

  const files = fs.readdirSync(resumeDir).filter(f => f.endsWith('.json') && f !== renameTarget);
  const clash = files.find(f => {
    const otherJson = safeJSON(path.join(resumeDir, f));
    return otherJson && (otherJson.displayName || '').toLowerCase() === newName.toLowerCase();
  });

  if (clash) {
    alert('A resume with this Display Name already exists.');
    return;
  }

  json.displayName = newName;
  fs.writeFileSync(fp, JSON.stringify(json, null, 2), 'utf-8');
  bootstrap.Modal.getInstance('#renameModal').hide();
  renderSidebar();
  renameTarget = null;
});

function duplicateResume(file) {
  const src = path.join(resumeDir, file);
  const json = safeJSON(src);
  if (!json) return;

  const originalName = json.displayName || 'Untitled';
  let newName = originalName + ' (Copy)';
  let counter = 1;
  const files = fs.readdirSync(resumeDir).filter(f => f.endsWith('.json'));
  const displayNames = files.map(f => safeJSON(path.join(resumeDir, f))?.displayName?.toLowerCase());

  while (displayNames.includes(newName.toLowerCase())) {
    newName = `${originalName} (Copy ${counter++})`;
  }

  json.displayName = newName;
  const dest = path.join(resumeDir, `resume-${Date.now()}.json`);
  fs.writeFileSync(dest, JSON.stringify(json, null, 2), 'utf-8');
  renderSidebar();
}

// ✅ Replace confirm with safe Bootstrap modal
let pendingDeleteResume = null;

function confirmDeleteResume(file) {
  pendingDeleteResume = file;
  bootstrap.Modal.getOrCreateInstance('#deleteConfirmModal').show();
}

$('#confirmDeleteBtn')?.addEventListener('click', () => {
  if (!pendingDeleteResume) return;
  fs.unlinkSync(path.join(resumeDir, pendingDeleteResume));
  renderSidebar();
  bootstrap.Modal.getInstance('#deleteConfirmModal').hide();
  pendingDeleteResume = null;
});

// ✅ JD CRUD
function createJD(file) {
  const fp = path.join(resumeDir, file);
  const json = safeJSON(fp);
  if (!json) return alert('Failed to load resume data.');

  const newJD = {
    id: Date.now(),
    title: $('#jd_title').value.trim(),
    company: $('#jd_company').value.trim(),
    description: $('#jd_description').value.trim(),
    requirements: $('#jd_requirements').value.trim(),
    location: $('#jd_location').value.trim(),
    createdAt: new Date().toISOString()
  };

  // Validate: prevent empty title or company
  if (!newJD.title || !newJD.company) {
    alert('Job Title and Company should not be same.');
    return;
  }

  json.jobDescriptions.push(newJD);
  fs.writeFileSync(fp, JSON.stringify(json, null, 2), 'utf-8');

  $('#addJobDescriptionForm').reset();
  bootstrap.Modal.getInstance('#staticBackdrop').hide();
  loadResumeJDs(file);
}

let pendingDeleteJD = { file: null, jdId: null };

function confirmDeleteJD(file, jdId) {
  pendingDeleteJD.file = file;
  pendingDeleteJD.jdId = jdId;
  bootstrap.Modal.getOrCreateInstance('#deleteConfirmModal').show();
}

$('#confirmDeleteBtn')?.addEventListener('click', () => {
  if (pendingDeleteJD.file && pendingDeleteJD.jdId) {
    const fp = path.join(resumeDir, pendingDeleteJD.file);
    const json = safeJSON(fp);
    if (!json) return;

    json.jobDescriptions = (json.jobDescriptions || []).filter(jd => jd.id !== pendingDeleteJD.jdId);
    fs.writeFileSync(fp, JSON.stringify(json, null, 2), 'utf-8');
    loadResumeJDs(pendingDeleteJD.file);

    bootstrap.Modal.getInstance('#deleteConfirmModal').hide();
    pendingDeleteJD = { file: null, jdId: null };
  }
});

function loadResumeJDs(file) {
  const main = document.getElementById('maincontent');
  if (!main) return;

  const fp = path.join(resumeDir, file);
  const json = safeJSON(fp);
  if (!json) {
    main.innerHTML = '<div class="alert alert-danger">Failed to load resume data.</div>';
    return;
  }

  main.dataset.resumeFile = file;

  const jdList = (json.jobDescriptions || []).filter(jd => jd && jd.title).map(jd => `
    <a href="#" class="list-group-item list-group-item-action">
      <div class="d-flex w-100 justify-content-between">
        <h5 class="mb-1">${jd.title}</h5>
        <small>${new Date(jd.createdAt).toLocaleDateString()}</small>
      </div>
      <div class="d-flex w-100 justify-content-between">
        <p class="mb-1">${jd.company}</p>
        <div>
          <button type="button" class="btn btn-primary ms-auto" onclick="startChat('${file}', ${jd.id})">Chat</button>
          <button type="button" class="btn btn-danger ms-1" onclick="confirmDeleteJD('${file}', ${jd.id})">Delete</button>
        </div>
      </div>
    </a>
  `).join('');

  main.innerHTML = `
  <div class="card form-section">
    <div class="card-header d-flex py-2">
      <div class="col-9 py-2">
        <h4>Job Descriptions</h4>
      </div>
      <div class="col-3 py-2">
        <button type="button" class="btn btn-success float-end" data-bs-toggle="modal" data-bs-target="#staticBackdrop">Create Job</button>
      </div>
    </div>

    <div class="card-body p-0 rounded-0">
      <div class="list-group rounded-0">
        ${jdList || '<p class="text-muted p-3">No job descriptions added yet.</p>'}
      </div>
    </div>
  </div>

  <!-- Create JD Modal and Delete Confirmation Modal are expected in HTML -->
  `;

  $('#addJobDescriptionForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    createJD(file);
  });
}

// Sidebar toggling
document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  const sidebar = $('#sidebar');
  $('#toggleSidebar')?.addEventListener('click', () => {
    if (window.innerWidth < 768) sidebar.classList.remove('show');
    else sidebar.classList.toggle('collapsed');
  });
  $('#mobileSidebarBtn')?.addEventListener('click', () => {
    sidebar.classList.add('show');
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) sidebar.classList.remove('show');
  });
});

// Expose
window.editResume = editResume;
window.openRename = openRename;
window.duplicateResume = duplicateResume;
window.confirmDeleteResume = confirmDeleteResume;
window.loadResumeJDs = loadResumeJDs;
window.createJD = createJD;
window.confirmDeleteJD = confirmDeleteJD;

window.startChat = async function(file, jdId) {
  const main = document.getElementById('maincontent');
  if (!main) return;

  const fs = require('fs');
  const path = require('path');
  const { ipcRenderer } = require('electron');
  const resumeDir = path.join(require('@electron/remote').app.getAppPath(), 'data');
  const resumePath = path.join(resumeDir, file);

  const json = JSON.parse(fs.readFileSync(resumePath, 'utf-8'));
  const resumeData = json;
  const jd = json.jobDescriptions.find(j => j.id === jdId);
  const chats = (json.chats && json.chats[jdId]) || [];

ipcRenderer.on('auto-transcript-response', (event, data) => {
  const { question, answer } = data;
  if (question) { appendMessage('question', 'Interviewer: ' + question); }
  if (answer) {
    const cleanedAnswer = answer.replace(/```[\s\S]*?```/g, '').replace(/`/g, '');
    appendMessage('answer', 'Candidate: ' + cleanedAnswer.trim());
  }
});

  // Build Chat Interface
  main.innerHTML = `
  <style>
    .chat-container {
        max-height: 400px;
        overflow-y: auto;
        border: 1px solid #ddd;
        padding: 10px;
        margin-bottom: 15px;
    }
    .question, .answer {
        margin-bottom: 10px;
    }
    .question {
        font-weight: bold;
        color: #007bff;
    }
    .answer {
        color: #333;
    }
  </style>
  <div class="card">
    <div class="row card-header">
      <div class="col-9">
        <h3 class="card-title">${jd.title} - Interview Chat</h3>
      </div>
      <div class="col-3">
        <button class="btn btn-outline-danger float-end" onclick="loadResumeJDs('${file}')">END SESSION</button>
      </div>
    </div>
    <div class="card-body">
      <div class="chat-container" id="chatDisplay"></div>
      <div class="input-group mb-3">
        <input type="text" class="form-control" id="chatInput" placeholder="Type your message...">
        <button class="btn btn-primary" id="sendChat">Send</button>
      </div>
      <div class="d-flex justify-content-between flex-wrap gap-2">
        <button id="toggleVoice" class="btn btn-outline-success">Voice On</button>
        <button class="btn btn-outline-warning" onclick="askQuestion()">Ask Question</button>
      </div>
    </div>
  </div>
  `;

  const chatDisplay = document.getElementById('chatDisplay');

  // Load existing chat history
  chats.forEach(m => {
    const div = document.createElement('div');
    div.className = m.role === 'user' ? 'answer' : 'question';
    div.innerHTML = (m.role === 'user' ? 'Candidate: ' : 'Interviewer: ') + m.content;
    chatDisplay.appendChild(div);
  });
  chatDisplay.scrollTop = chatDisplay.scrollHeight;

  // Append AI message with Elaborate button
  function appendAIMessage(content, promptForElaboration) {
    const div = document.createElement('div');
    div.className = 'question';
    div.innerHTML = `
      Interviewer: ${content}
      <button class="btn btn-sm btn-link" onclick="elaborateAnswer('${encodeURIComponent(promptForElaboration)}')">Elaborate</button>
    `;
    chatDisplay.appendChild(div);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
  }

  // Append general message
  function appendMessage(type, message) {
    const div = document.createElement('div');
    div.className = type === 'question' ? 'question' : 'answer';
    div.textContent = message;
    chatDisplay.appendChild(div);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
  }

  // Pre-load first interviewer question
  appendAIMessage('Can you introduce yourself?', 'Can you introduce yourself?');

  // Send button logic
  document.getElementById('sendChat').addEventListener('click', async () => {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    appendMessage('answer', 'Candidate: ' + msg);
    chats.push({ role: 'user', content: msg });
    input.value = '';

    const prompt = `
You are an experienced job seeker with strong communication skills, technical proficiency, and confidence in interviews.

Job Description:
Title: ${jd.title}
Company: ${jd.company}
Description: ${jd.description}
Requirements: ${jd.requirements}

Resume Summary:
Name: ${resumeData.displayName}
Education: ${resumeData.education?.map(e => e.degree + ' from ' + e.institution).join('; ') || 'N/A'}
Experience: ${resumeData.professionalSummary || 'N/A'}

Respond as a confident candidate to this question:
"${msg}"
    `;

    const response = await ipcRenderer.invoke('openai-chat', prompt);

    appendAIMessage(response, msg);
    chats.push({ role: 'assistant', content: response });

    // Save updated chat
    if (!json.chats) json.chats = {};
    json.chats[jdId] = chats;
    fs.writeFileSync(resumePath, JSON.stringify(json, null, 2), 'utf-8');
  });

  // Attach Voice Toggle Event Listener (fixed here)
  let voiceOn = false;
  document.getElementById('toggleVoice').addEventListener('click', () => {
    voiceOn = !voiceOn;

    const btn = document.getElementById('toggleVoice');
    btn.textContent = voiceOn ? 'Voice Off' : 'Voice On';
    btn.classList.toggle('btn-outline-danger', voiceOn);
    btn.classList.toggle('btn-outline-success', !voiceOn);

    console.log('🔁 [Voice Toggle] Clicked. voiceOn =', voiceOn);
    ipcRenderer.send('toggle-voice', voiceOn);
  });

  // Ask Question button logic (subject-based)
  window.askQuestion = async function() {
    const prompt = `
Generate a subject-specific interview question for the following job role:

Job Title: ${jd.title}
Description: ${jd.description}
Requirements: ${jd.requirements}

Provide only the question text.
    `;

    const question = await ipcRenderer.invoke('openai-chat', prompt);
    appendAIMessage(question, question);
  };

  // Helper functions
  window.voiceMode = async function() {
    appendMessage('question', 'Listening... Speak now.');

    try {
      const result = await ipcRenderer.invoke('voice-chat');

      if (typeof result === 'string') {
        appendMessage('question', result);
      } else {
        appendMessage('question', 'Interviewer: ' + result.question);
        appendMessage('answer', 'Candidate: ' + result.answer);
      }
    } catch (err) {
      console.error('Voice mode error:', err);
      appendMessage('question', 'Error accessing speech service.');
    }
  };

};


// Elaborate Answer function
window.elaborateAnswer = async function(encodedPrompt) {
  const prompt = decodeURIComponent(encodedPrompt);
  const { ipcRenderer } = require('electron');

  const elaboratePrompt = `
Act as a highly proficient job seeker and provide a detailed, elaborate explanation with examples for the following interview question:

"${prompt}"
  `;

  const response = await ipcRenderer.invoke('openai-chat', elaboratePrompt);
  const chatDisplay = document.getElementById('chatDisplay');

  const div = document.createElement('div');
  div.className = 'question';
  div.textContent = 'Interviewer (Elaborate): ' + response;
  chatDisplay.appendChild(div);
  chatDisplay.scrollTop = chatDisplay.scrollHeight;
};

