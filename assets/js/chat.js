const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

let chatHistory = [];
let resumeFile = '';
let jdId = null;

// Load Resume + JD data
ipcRenderer.on('load-chat', (event, data) => {
  resumeFile = data.resumeFile;
  jdId = data.jdId;

  const resumePath = path.join(__dirname, '..', '..', 'data', resumeFile);
  const json = JSON.parse(fs.readFileSync(resumePath, 'utf-8'));
  const jd = json.jobDescriptions.find(j => j.id === jdId);

  document.getElementById('jdTitle').innerText = jd.title;

  loadPreviousChat(json);
});

// Load previous chat from JSON
function loadPreviousChat(json) {
  chatHistory = json.chats?.[jdId] || [];
  chatHistory.forEach(m => appendMessage(m.role, m.content));
}

// Save chat to file
function saveChat() {
  const resumePath = path.join(__dirname, '..', '..', 'data', resumeFile);
  const json = JSON.parse(fs.readFileSync(resumePath, 'utf-8'));

  if (!json.chats) json.chats = {};
  json.chats[jdId] = chatHistory;

  fs.writeFileSync(resumePath, JSON.stringify(json, null, 2), 'utf-8');
}

// Append message to UI
function appendMessage(role, content) {
  const chatDisplay = document.getElementById('chatDisplay');
  const div = document.createElement('div');
  div.className = role === 'user' ? 'answer' : 'question';
  div.textContent = (role === 'user' ? 'Candidate: ' : 'Interviewer: ') + content;
  chatDisplay.appendChild(div);
  chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

// Send text message
document.getElementById('sendChat').addEventListener('click', async () => {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;

  appendMessage('user', msg);
  chatHistory.push({ role: 'user', content: msg });
  input.value = '';

  const response = await ipcRenderer.invoke('openai-chat', {
    prompt: msg,
    resumeFile,
    jdId
  });

  appendMessage('assistant', response);
  chatHistory.push({ role: 'assistant', content: response });

  saveChat();
});

// End Session
document.getElementById('endSession').addEventListener('click', () => {
  saveChat();
  alert('Session saved and ended.');
  window.location.href = 'resumes.html'; // Redirect back
});


function startChat(file, jdId) {
  const { ipcRenderer } = require('electron');
  ipcRenderer.send('navigate-to-chat', { resumeFile: file, jdId });
}