/* script.js
   WhatsApp-like front-end logic.
   Connects to POST /api/chat with { messages: [...] }
   Expects response JSON: { reply: "..." }
*/

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const form = document.getElementById('composer');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const clearBtn = document.getElementById('clearBtn');

let convo = { id: Date.now().toString(), messages: [] };
let waiting = false;
let recognition = null;
let voiceEnabled = false;

// helper: format time
function timeNow() {
  const d = new Date();
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

// helper: append message bubble
function appendMessage(role, text, ts = '') {
  const el = document.createElement('div');
  el.className = 'msg ' + (role === 'user' ? 'user' : 'assistant');
  if(ts) el.innerHTML = `<div class="meta">${role} • ${ts}</div>  <div class="body">${escapeHtml(text)}</div>`;
  else el.innerHTML = `<div class="body">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// escape
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// show typing indicator
function showTyping() {
  const t = document.createElement('div');
  t.id = '__typing';
  t.className = 'typing';
  t.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
  messagesEl.appendChild(t);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function hideTyping() { const t = document.getElementById('__typing'); if(t) t.remove(); }

// send message to server
async function sendMessageToServer() {
  if(waiting) return;
  const text = inputEl.value.trim();
  if(!text) return;
  // show user bubble
  appendMessage('user', text, timeNow());
  convo.messages.push({ role: 'user', content: text, ts: Date.now() });
  inputEl.value = '';
  inputEl.style.height = 'auto';

  // UI lock
  waiting = true;
  sendBtn.disabled = true;
  showTyping();

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: convo.messages })
    });
    if(!resp.ok) {
      const txt = await resp.text();
      hideTyping();
      appendMessage('assistant', 'Server error: ' + txt, timeNow());
    } else {
      const data = await resp.json();
      hideTyping();
      appendMessage('assistant', data.reply || 'No reply', timeNow());
      convo.messages.push({ role: 'assistant', content: data.reply || '', ts: Date.now() });
      if(voiceEnabled) speakText(data.reply || '');
    }
  } catch(err) {
    hideTyping();
    appendMessage('assistant', 'Network error: ' + err.message, timeNow());
  } finally {
    waiting = false;
    sendBtn.disabled = false;
  }
}

// voice (optional) - basic webspeech recognition & tts
if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (e) => {
    const t = e.results[0][0].transcript;
    inputEl.value = t;
    // auto send after recognition ends
    sendMessageToServer();
  };
  recognition.onerror = (e) => { console.error('Speech error', e); };
} else {
  micBtn.style.display = 'none';
}

micBtn.addEventListener('click', () => {
  if(!recognition) { alert('Voice typing not supported in this browser.'); return; }
  try {
    recognition.start();
    micBtn.textContent = '🎙...';
    recognition.onend = () => { micBtn.textContent = '🎙'; };
  } catch(e) { console.error(e); micBtn.textContent = '🎙'; }
});

// simple TTS
function speakText(txt){
  if(!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'en-IN';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// form submit
form.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessageToServer();
});

// clear button
clearBtn.addEventListener('click', () => {
  messagesEl.innerHTML = '';
  convo = { id: Date.now().toString(), messages: [] };
});

// auto-resize textarea
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = (inputEl.scrollHeight) + 'px';
});

// initial greeting from assistant (local)
appendMessage('assistant', 'Namaste! Main Vision — apka AI assistant. Kuch puchna chahenge?', timeNow());
convo.messages.push({ role: 'assistant', content: 'Namaste! Main Vision — apka AI assistant. Kuch puchna chahenge?', ts: Date.now() });