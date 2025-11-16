// =======================================================
// --- FINAL SCRIPT.JS: Typewriter Effect Aur 5s Timer ---
// --- Timer aur Typewriter dono client-side hain ---
// =======================================================

// --- 1. ZAROORI ELEMENTS AUR STATE VARIABLES ---
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const form = document.getElementById('composer');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const clearBtn = document.getElementById('clearBtn');
const voiceToggle = document.getElementById('voice-toggle'); 

// --- CONFIGURATION ---
const SERVER_PORT = 3000;
const STORAGE_KEY = 'sentinelChatHistory'; 
const CLIENT_SECRET_KEY = 'mera_bohot_secret_key_12345'; // Apni key yahan daaliye

// ✅ NEW: Typewriter speed (prati character kitni der rukna hai)
const TYPING_DELAY = 3; // 20 milliseconds prati character

// --- TIMER CONFIGURATION (20 seconds, 2 prompts) ---
const INACTIVITY_DELAY = 50000; 

// --- STATE ---
let convo = { id: Date.now().toString(), messages: [] };
let messageQueue = [];    
let isProcessing = false; 
let voiceEnabled = false;
let isServerDown = false;

// --- TIMER STATE ---
let inactivityTimer;
let promptCount = 0; 
let isTimerInitialized = false; 

let recognition = null; 

// -------------------------------------------------------------------

// --- 2. UTILITY & PERSISTENCE FUNCTIONS ---

function timeNow() {
  const d = new Date();
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}


// --- NAYA AUR FINAL formatContent FUNCTION (Inline Styling Included) ---
function formatContent(text) {
    // ... [Basic HTML escaping aur Code Block logic yahaan upar jaisa hi rahega] ...

    let html = String(text)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;');
    
    // Code Blocks ko retain rakho
    html = html.replace(/```(\w+)?\n?([\s\S]*?)```/g, function(match, lang, code) {
        const language = lang || 'plaintext';
        return `<pre class="code-block" data-lang="${language}"><code>${code.trim()}</code></pre>`;
    });

    // 1. ✅ FIX: Markdown Links ko clickable HTML links mein badlo (Inline Style)
    // Inline style mein sirf normal color control kar sakte hain. Hover nahi.
    const baseStyle = 'color: #81d4fa; text-decoration: none;'; // Halka Blue (Base Color)

    html = html.replace(/\[(.?)\]\((.?)\)/g, function(match, linkText, url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="${baseStyle}">${linkText}</a>`;
    });

    // 2. ✅ FIX: Plain URLs ko bhi clickable banao (Inline Style)
    html = html.replace(/(https?:\/\/[^\s]+)/g, function(url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="${baseStyle}">${url}</a>`;
    });

    // Final HTML wapas karo
    return html;
}

function saveHistory() {
    const historyToSave = convo.messages.filter(msg => 
        // Inactivity prompt ko history mein save nahi karte
        msg.content !== 'Yaar, tum to busy ho shayad... 🤔');
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(historyToSave));
    } catch (e) {
        console.warn("Could not save history to localStorage:", e);
    }
}

function loadHistory() {
    const savedHistory = localStorage.getItem(STORAGE_KEY);
    
    if (savedHistory && savedHistory !== '[]') {
        try {
            const messages = JSON.parse(savedHistory);
            convo.messages = []; 
            
            messages.forEach(msg => {
                const msgTime = msg.ts ? new Date(msg.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : timeNow();
                // ✅ Badlav: History load karte waqt direct message append karte hain (no typewriter)
                if (messagesEl) appendMessage(msg.role, msg.content, msgTime, false); 
                convo.messages.push(msg); 
            });

            // Agar history hai toh timer ko chalu kar do (yeh isse reset karega)
            if (convo.messages.length > 1) {
                isTimerInitialized = true;
                setInactivityTimer();
            }
        } catch (e) {
            console.error("Failed to load or parse history, showing fresh greeting:", e);
            initialGreeting(); 
        }
    } else {
        initialGreeting(); 
    }
}

/**
 * ✅ IMPORTANT CHANGE: Ab yeh function reply ka body element wapas karta hai
 * taaki typewriter effect usmein likh sake.
 * Pure text ko sidha append nahi karta.
 */
function appendMessage(role, text, ts = '', shouldSave = true) {
  if (!messagesEl) return; 
  const el = document.createElement('div');
  el.className = 'msg ' + (role === 'user' ? 'user' : 'assistant');
  
  // Body aur Meta elements banao
  const metaEl = document.createElement('div');
  metaEl.className = 'meta';
  metaEl.textContent = `${role} • ${ts}`;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'body';
  
  // Agar user ka message hai, toh poora content format karke ek baar mein daal do
  if (role === 'user' || text === 'Yaar, tum to busy ho shayad... 🤔') {
      bodyEl.innerHTML = formatContent(text);
  } else if (text) {
      // History load karte waqt (jab shouldSave false ho)
      bodyEl.innerHTML = formatContent(text);
  }

  el.appendChild(metaEl);
  el.appendChild(bodyEl);
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  
  // Sirf user message aur server reply ko save karte hain (inactivity prompt nahi)
  if (shouldSave && role !== 'assistant' && text !== 'Yaar, tum to busy ho shayad... 🤔') {
      saveHistory();
  }
  
  // Return karte hain body element taaki Typewriter effect use kar sake
  return bodyEl;
}

function showTyping() {
  if (!messagesEl) return; 
  const t = document.createElement('div');
  t.id = '__typing';
  t.className = 'typing';
  t.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
  messagesEl.appendChild(t);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function hideTyping() { const t = document.getElementById('__typing'); if(t) t.remove(); }

// -------------------------------------------------------------------

// ✅ NEW: Typewriter Effect Function
async function startTypewriterEffect(bodyEl, fullText) {
    // Text ko tokens mein todo (yahan har character ek token hai)
    const tokens = fullText.split('');
    let currentText = '';

    for (const token of tokens) {
        currentText += token;
        
        // HTML content update karo (taaki code blocks theek se render ho)
        bodyEl.innerHTML = formatContent(currentText);

        // Har token ke baad thoda wait karo
        await new Promise(resolve => setTimeout(resolve, TYPING_DELAY));
        
        // Scroll ko niche rakho taaki user ko pura message dikhe
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
}

// -------------------------------------------------------------------

// --- 3. 5-SECOND CLIENT-SIDE TIMER LOGIC ---

// Timer ko reset (clear + naya start) karta hai
function resetTimer() {
    clearTimeout(inactivityTimer);
    promptCount = 0; // Reset counter for 2 attempts
    setInactivityTimer();
}

// Timer ko set (chalu) karta hai
function setInactivityTimer() {
    inactivityTimer = setTimeout(sendInactivityPrompt, INACTIVITY_DELAY);
    isTimerInitialized = true;
}

// Inactivity hone par chalta hai
function sendInactivityPrompt() {
    // Agar chat khali hai toh kuch mat karo
    if (convo.messages.length === 0) {
        setInactivityTimer(); // Fir se check karega
        return;
    }
    
    promptCount++;
    const prompt = `Yaar, tum to busy ho shayad... 🤔`;

    if (promptCount <= 2) { // Sirf 2 prompts
        // Message ko seedhe UI par assistant ki taraf se dikhao. Server ko disturb mat karo.
        // Plain append message use karo, typewriter ki zarurat nahi
        appendMessage('assistant', prompt, timeNow(), false); 
        
        // Agle 5 seconds ke liye timer set karo
        if (promptCount < 2) {
            setInactivityTimer();
        } else {
            // 2 prompts ke baad timer ko permanently band kar do
            clearTimeout(inactivityTimer); 
        }
    } else {
        clearTimeout(inactivityTimer); 
    }
}
// -------------------------------------------------------------------
// --- 4. QUEUE AND SEND LOGIC ---
function processQueue() {
    if (messageQueue.length === 0 || isProcessing) {
        return;
    }
    isProcessing = true;
    const nextMessage = messageQueue.shift();
    // User ka message UI aur history mein add karo
    // User ke liye typewriter nahi chahiye, seedha append karo
    // Server ko bhejne ke liye function call karo
    sendMessageToServer(nextMessage.content);
}
async function sendMessageToServer(promptText) {
    if (!promptText) return;

    const tempConvo = convo.messages;

    showTyping();
    if (sendBtn) sendBtn.disabled= false;

    // ✅ NEW: Pehle ek khali container banao jismein reply stream hoga
    const botMessageBodyEl = appendMessage('assistant', '', timeNow(), false);
    
    try {
        const resp = await fetch(`http://localhost:${SERVER_PORT}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-client-key': CLIENT_SECRET_KEY, 
            },
            body: JSON.stringify({ messages: tempConvo }),
        });

        // hideTyping() ko yahan se hata diya hai, ab yeh Typewriter ke baad hide hoga

        // --- 401 Unauthorized Error Handling (HINGLISH) ---
        if (resp.status === 401) {
            isServerDown = true;
            hideTyping();
            const unauthorizedMsg = "🚨 Unauthorized! Tumhara Client Key (Client Secret Key) match nahi kar raha hai. Server access denied. Check karo settings.";
            botMessageBodyEl.innerHTML = formatContent(unauthorizedMsg);
            return;
        }

        // --- General HTTP Error Handling (e.g., 500) (HINGLISH) ---
        if (!resp.ok) {
            isServerDown = true;
            hideTyping();
            const userFriendlyError = "Yaar, lagta hai mere server ke andar koi problem (internal issue) aa gayi hai. 🛠 Jab tak yeh theek nahi hota, main tumhari help nahi kar paunga. **Please ise fix karke try karo.";
            botMessageBodyEl.innerHTML = formatContent(userFriendlyError);
            return;
        }

        const data = await resp.json(); 
        const botReply = data.reply || 'No reply received.';
        
        isServerDown = false;
        
        // ✅ NEW: Poore reply ko seedha append karne ke bajaye, typewriter effect chalao
        await startTypewriterEffect(botMessageBodyEl, botReply);
        
        // Ab typing indicator hata do
        hideTyping();
        
        // Bot ka reply history mein add karo (sirf final text)
        convo.messages.push({ role: 'assistant', content: botReply, ts: Date.now() });
        
        if(voiceEnabled) speakText(botReply);

        // Server se reply aane aur Typewriter complete hone ke baad timer ko reset karo
        resetTimer(); 

    } catch (err) {
        hideTyping();
        isServerDown = true;
        console.error('Fetch Error:', err);
        const userFriendlyError = "Hey, lagta hai mera server (network) se disconnect ho gaya hai. 🌐 Jab tak yeh online nahi aata, main reply nahi de paunga. Please check karo ki server run ho raha hai ya nahi.";
        botMessageBodyEl.innerHTML = formatContent(userFriendlyError);
    } finally {
        isProcessing = false;
        if (sendBtn) sendBtn.disabled = false;
        processQueue(); 
    }
}

// -------------------------------------------------------------------

// --- 5. EVENT LISTENERS AND INITIALIZATION ---

function sendMessageToQueue(message) {
    if (!message.trim() || isServerDown) {
        inputEl.value = '';
        inputEl.style.height = '40px';
        return;
    }
    // Input field clear karo
    inputEl.value = '';
    inputEl.style.height = '40px'; 
    
    // Agar timer shuru nahi hua hai toh shuru karo (pehla message)
    if(!isTimerInitialized){
        setInactivityTimer();
    }
    appendMessage('user',message, timeNow(),false);
    convo.messages.push({content: message, role: 'user',ts: Date.now()});
    
    // Message queue mein add karo
    messageQueue.push({ content: message, role: 'user' }); 

    // Queue processing shuru karo
    if (!isProcessing) {
        processQueue();
    }
}

// Voice Recognition Setup (No change)
if (micBtn) { 
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript;
            sendMessageToQueue(transcript); 
        };
        recognition.onerror = (event) => { console.error('Speech recognition error:', event.error); micBtn.innerHTML = '🎙'; };

    } else {
        micBtn.disabled = true;
        micBtn.style.opacity = 0.5;
        console.warn('Speech recognition not supported in this browser.');
    }

    micBtn.addEventListener('click', () => {
      if(!recognition) { console.error('Voice typing not supported.'); return; }
      try {
        recognition.start();
        micBtn.innerHTML = '🎙...';
        recognition.onend = () => { micBtn.innerHTML = '🎙'; };
      } catch(e) { console.error(e); micBtn.innerHTML = '🎙'; }
    });
}

function speakText(txt){
  if(!('speechSynthesis' in window) || !voiceEnabled) return;
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'en-US'; 
  u.rate = 1.0;
  u.pitch = 1.0;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}


if (voiceToggle) {
    voiceToggle.addEventListener('change', (e) => {
        voiceEnabled = e.target.checked;
        if (!voiceEnabled) {
            window.speechSynthesis.cancel();
        }
    });
}


// Form Submit (No change)
if (form && sendBtn && inputEl) { 
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessageToQueue(inputEl.value);
    });
} else {
    console.error("CRITICAL ERROR: Composer form or input elements not found in HTML.");
}

// Clear Button
if (clearBtn) { 
    clearBtn.addEventListener('click', () => {
      if (messagesEl) messagesEl.innerHTML = ''; 
      convo = { id: Date.now().toString(), messages: [] };
      messageQueue = []; 
      isProcessing = false;
      isServerDown = false;
      
      // Timer clean-up
      clearTimeout(inactivityTimer);
      promptCount = 0;
      isTimerInitialized = false; 
      
      localStorage.removeItem(STORAGE_KEY); 
      
      initialGreeting();
    });
}
// --- ✅ NAYA CODE: Enter Key Handling ---
if (inputEl) {
    // ... [Purana 'input' event listener yahaan hai] ...

    inputEl.addEventListener('keydown', (e) => {
        // Agar key 'Enter' hai aur 'Shift' ya 'Ctrl' key nahi dabai gayi hai
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault(); // Naye line mein jaane se roko
            
            // Check karo ki input khaali toh nahi hai
            if (inputEl.value.trim() !== '') {
                // Form submit karne ke bajaye, seedhe sendMessageToQueue ko call karo
                sendMessageToQueue(inputEl.value); 
            }
        }
    });
}


// Initial Greeting Logic
function initialGreeting() {
    const greeting = 'hey lucky 👋';
    appendMessage('assistant', greeting, timeNow(), false); 
    convo.messages.push({ role: 'assistant', content: greeting, ts: Date.now()});
    saveHistory(); 
}

// Initial Call: Load history or show greeting
document.addEventListener('DOMContentLoaded', loadHistory);