const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const stripAnsi = require('strip-ansi');

let pty;
try {
  pty = require('node-pty');
} catch (e) {
  console.log('node-pty not available, trying child_process fallback');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const state = {
  process: null,
  buffer: [],
  clients: new Set(),
  running: false
};

function startOencode() {
  if (state.process) return;

  const cmd = process.env.CMD || 'opencode';
  const workDir = process.env.WORK_DIR || process.env.HOME || '/root';

  if (pty) {
    state.process = pty.spawn(cmd, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 40,
      cwd: workDir,
      env: { ...process.env, TERM: 'xterm-256color' }
    });

    state.process.onData((data) => {
      const clean = stripAnsi(data);
      state.buffer.push(clean);
      if (state.buffer.length > 10000) state.buffer.shift();
      for (const client of state.clients) {
        client.emit('output', clean);
      }
    });

    state.process.onExit(() => {
      state.process = null;
      state.running = false;
      for (const client of state.clients) {
        client.emit('exit');
      }
    });

    state.running = true;
  }
}

function stopProcess() {
  if (state.process) {
    try {
      if (pty) {
        state.process.write('exit\r');
        setTimeout(() => {
          if (state.process) {
            try { state.process.kill(); } catch (e) {}
            state.process = null;
            state.running = false;
          }
        }, 2000);
      }
    } catch (e) {
      state.process = null;
      state.running = false;
    }
  }
}

io.on('connection', (socket) => {
  state.clients.add(socket);

  socket.emit('boot', {
    buffer: state.buffer.slice(-500),
    running: state.running
  });

  socket.on('input', (data) => {
    if (state.process && pty) {
      state.process.write(data);
    }
  });

  socket.on('start', () => {
    startOencode();
  });

  socket.on('stop', () => {
    stopProcess();
  });

  socket.on('disconnect', () => {
    state.clients.delete(socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`mobile-opencode running on http://0.0.0.0:${PORT}`);
});
