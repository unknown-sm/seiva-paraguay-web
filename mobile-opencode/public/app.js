const socket = io({
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000
});

const $ = (id) => document.getElementById(id);
const messagesEl = $('messages');
const inputEl = $('input');
const btnSend = $('btn-send');
const btnStart = $('btn-start');
const btnStop = $('btn-stop');
const btnRestart = $('btn-restart');
const statusEl = $('status');

let connected = false;
let opencodeRunning = false;
let isProcessing = false;
let assistantBuffer = '';
let hasHistory = false;

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = 'status ' + cls;
}

function scrollBottom() {
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function formatTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatContent(text) {
  let html = '';
  const parts = text.split(/(```[\s\S]*?```)/);

  for (const part of parts) {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3);
      const firstLineEnd = inner.indexOf('\n');
      let lang = '';
      let code = inner;
      if (firstLineEnd !== -1) {
        lang = inner.slice(0, firstLineEnd).trim();
        code = inner.slice(firstLineEnd + 1);
      }
      const escaped = escapeHtml(code);
      html += '<div class="code-block">';
      html += `<div class="code-header"><span>${lang || 'code'}</span><button onclick="copyCode(this)">Copiar</button></div>`;
      html += `<pre><code class="language-${lang || 'plaintext'}">${escaped}</code></pre>`;
      html += '</div>';
    } else {
      html += escapeInline(part);
    }
  }

  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeInline(str) {
  return escapeHtml(str)
    .replace(/\n/g, '<br>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
}

function addMessage(role, content, time) {
  const el = document.createElement('div');
  el.className = 'message ' + role;

  let formatted = '';
  if (role === 'system') {
    formatted = `<div class="msg-bubble">${escapeHtml(content)}</div>`;
  } else {
    formatted = `<div class="msg-bubble">${formatContent(content)}</div>`;
  }

  formatted += `<div class="msg-time">${time || formatTime()}</div>`;
  el.innerHTML = formatted;
  messagesEl.appendChild(el);
  scrollBottom();
  return el;
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'message assistant typing-indicator';
  el.innerHTML = `<div class="msg-bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
  messagesEl.appendChild(el);
  scrollBottom();
  return el;
}

function removeTyping() {
  const el = messagesEl.querySelector('.typing-indicator');
  if (el) el.remove();
}

function updateAssistantContent(chunk) {
  assistantBuffer += chunk;
  let el = messagesEl.querySelector('.message.assistant:last-child');
  if (!el) {
    el = addMessage('assistant', '');
  }
  el.querySelector('.msg-bubble').innerHTML = formatContent(assistantBuffer);
  scrollBottom();
}

function finalizeAssistant() {
  assistantBuffer = '';
  isProcessing = false;
}

function copyCode(btn) {
  const pre = btn.closest('.code-block').querySelector('pre');
  const code = pre.textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copiado';
    setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
  });
}

function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || !connected || !opencodeRunning) return;

  addMessage('user', text);
  inputEl.value = '';
  inputEl.style.height = 'auto';
  isProcessing = true;
  finalizeAssistant();
  showTyping();
  socket.emit('input', text + '\n');
}

inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

btnSend.addEventListener('click', sendMessage);

btnStart.addEventListener('click', () => {
  socket.emit('start');
  setStatus('Iniciando...', 'connecting');
});

btnStop.addEventListener('click', () => {
  socket.emit('stop');
  opencodeRunning = false;
  updateUI();
  addMessage('system', 'Sesión detenida');
});

btnRestart.addEventListener('click', () => {
  socket.emit('stop');
  setTimeout(() => {
    socket.emit('start');
    addMessage('system', 'Reiniciando sesión...');
  }, 1000);
});

function updateUI() {
  const running = connected && opencodeRunning;
  inputEl.disabled = !running;
  btnSend.disabled = !running;
  btnStart.style.display = running ? 'none' : 'inline-flex';
  btnStop.style.display = running ? 'inline-flex' : 'none';
  btnRestart.style.display = connected ? 'inline-flex' : 'none';
}

// Socket events
socket.on('connect', () => {
  connected = true;
  setStatus('Conectado', 'connected');
  updateUI();
});

socket.on('disconnect', () => {
  connected = false;
  opencodeRunning = false;
  setStatus('Desconectado', 'disconnected');
  updateUI();
});

socket.on('boot', (data) => {
  if (data.buffer && data.buffer.length > 0) {
    hasHistory = true;
    const full = data.buffer.join('');
    addMessage('assistant', full, 'historial');
  }
  if (data.running) {
    opencodeRunning = true;
    setStatus('Ejecutando', 'running');
  } else {
    setStatus('Detenido', 'disconnected');
  }
  updateUI();
});

socket.on('output', (data) => {
  if (!opencodeRunning) {
    opencodeRunning = true;
    setStatus('Ejecutando', 'running');
    updateUI();
  }

  removeTyping();

  if (isProcessing) {
    updateAssistantContent(data);
  } else {
    updateAssistantContent(data);
  }
});

socket.on('exit', () => {
  opencodeRunning = false;
  setStatus('Detenido', 'disconnected');
  finalizeAssistant();
  updateUI();
  addMessage('system', 'Proceso terminado');
});

socket.on('connect_error', (err) => {
  setStatus('Error de conexión', 'disconnected');
});
