const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true } });
const PORT = process.env.PORT || 3000;
const words = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'words.json'), 'utf8'));
const rooms = new Map();
const COLORS = ['#65e6c4', '#ffca69', '#a995ff', '#ff829b'];
const AVATARS = ['🚀', '🦊', '🐼', '🐸'];
const TOTAL_QUESTIONS = 10;
const QUESTION_SECONDS = 18;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true, rooms: rooms.size }));

function cleanName(v) { return String(v || '').trim().replace(/[<>]/g, '').slice(0, 18); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function makeQuestions() {
  const pool = shuffle(words);
  return pool.slice(0, TOTAL_QUESTIONS).map((entry, i) => {
    const mode = i % 3;
    let prompt, answer, type, detail;
    if (mode === 0) {
      type = 'definition'; prompt = `Which TOEIC word matches this definition?\n${entry.definition}`; answer = entry.word;
      detail = `${entry.word} means “${entry.definition}”`;
    } else if (mode === 1) {
      type = 'spanish'; prompt = `Choose the English word for:\n${entry.spanish}`; answer = entry.word;
      detail = `${entry.word} = ${entry.spanish}. ${entry.definition}`;
    } else if (entry.synonyms.length) {
      type = 'synonym'; prompt = `Which word is closest in meaning to “${entry.word}”?`; answer = pick(entry.synonyms);
      detail = `${entry.word}: ${entry.definition} A near-synonym in your glossary is “${answer}”.`;
    } else {
      type = 'definition'; prompt = `Which TOEIC word matches this definition?\n${entry.definition}`; answer = entry.word;
      detail = `${entry.word} means “${entry.definition}”`;
    }
    let distractors;
    if (type === 'synonym') {
      distractors = shuffle(words.filter(w => w.word !== entry.word).map(w => w.word)).slice(0, 3);
    } else {
      distractors = shuffle(words.filter(w => w.word !== entry.word).map(w => w.word)).slice(0, 3);
    }
    const choices = shuffle([answer, ...distractors]);
    return { number: i + 1, type, prompt, choices, answer, detail, word: entry.word, pronunciation: entry.pronunciation };
  });
}
function publicRoom(room) {
  return {
    code: room.code, status: room.status, hostId: room.hostId,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color, avatar: p.avatar, score: p.score, correct: p.correct, answered: !!p.answer, connected: p.connected })),
    questionIndex: room.questionIndex, totalQuestions: TOTAL_QUESTIONS,
    secondsLeft: room.secondsLeft, question: room.status === 'question' || room.status === 'reveal' ? (({ answer, detail, ...safeQ }) => safeQ)(room.questions[room.questionIndex]) : null,
    reveal: room.status === 'reveal' ? { answer: room.questions[room.questionIndex].answer, detail: room.questions[room.questionIndex].detail } : null,
    winner: room.winner || null
  };
}
function emitRoom(room) { io.to(room.code).emit('room:update', publicRoom(room)); }
function sendError(socket, message) { socket.emit('app:error', message); }
function stopTimer(room) { if (room.timer) clearTimeout(room.timer); room.timer = null; }
function startQuestion(room) {
  stopTimer(room);
  if (room.questionIndex >= TOTAL_QUESTIONS) return finishGame(room);
  room.status = 'question'; room.secondsLeft = QUESTION_SECONDS;
  for (const p of room.players.values()) p.answer = null;
  emitRoom(room);
  room.timer = setInterval(() => {
    room.secondsLeft -= 1;
    if (room.secondsLeft <= 0) revealQuestion(room);
    else emitRoom(room);
  }, 1000);
}
function revealQuestion(room) {
  if (room.status !== 'question') return;
  stopTimer(room);
  room.status = 'reveal';
  const q = room.questions[room.questionIndex];
  for (const p of room.players.values()) {
    if (p.answer && p.answer.choice === q.answer) {
      p.correct += 1;
      p.score += 100 + Math.max(0, Math.ceil(p.answer.remaining * 3));
    }
  }
  emitRoom(room);
  room.timer = setTimeout(() => { room.questionIndex += 1; startQuestion(room); }, 3200);
}
function finishGame(room) {
  stopTimer(room); room.status = 'finished';
  const ranked = [...room.players.values()].sort((a,b) => b.score - a.score || b.correct - a.correct);
  room.winner = ranked.length ? { id: ranked[0].id, name: ranked[0].name, tied: ranked.length > 1 && ranked[0].score === ranked[1].score } : null;
  emitRoom(room);
}
function createRoom(socket, name, token, avatar) {
  let code;
  do { code = String(Math.floor(10000 + Math.random() * 90000)); } while (rooms.has(code));
  const id = token || crypto.randomUUID();
  const room = { code, hostId: id, players: new Map(), status: 'lobby', questions: [], questionIndex: 0, secondsLeft: 0, timer: null };
  rooms.set(code, room);
  addPlayer(socket, room, name, id, avatar);
}
function addPlayer(socket, room, name, id, avatar) {
  if (!room.players.has(id) && room.players.size >= 4) return sendError(socket, 'Esta sala ya tiene 4 jugadores.');
  let p = room.players.get(id);
  if (!p) {
    const slot = room.players.size;
    p = { id, name, color: COLORS[slot], avatar: AVATARS.includes(avatar) ? avatar : AVATARS[slot], score: 0, correct: 0, answer: null, connected: true };
    room.players.set(id, p);
  } else { p.name = name || p.name; if (AVATARS.includes(avatar)) p.avatar = avatar; p.connected = true; }
  if (socket.data.roomCode && socket.data.roomCode !== room.code) socket.leave(socket.data.roomCode);
  socket.data.roomCode = room.code; socket.data.playerId = id;
  socket.join(room.code);
  socket.emit('session:ready', { token: id, code: room.code, playerId: id });
  emitRoom(room);
}

io.on('connection', socket => {
  socket.on('room:create', ({ name, token, avatar } = {}) => {
    name = cleanName(name); if (!name) return sendError(socket, 'Escribe un apodo para entrar.');
    createRoom(socket, name, token, avatar);
  });
  socket.on('room:join', ({ code, name, token, avatar } = {}) => {
    name = cleanName(name); code = String(code || '').trim();
    if (!name) return sendError(socket, 'Escribe un apodo para entrar.');
    const room = rooms.get(code);
    if (!room) return sendError(socket, 'No encontramos esa sala. Revisa el código.');
    if (room.status !== 'lobby' && !room.players.has(token)) return sendError(socket, 'La partida ya comenzó.');
    if (room.players.size >= 4 && !room.players.has(token)) return sendError(socket, 'La sala está completa.');
    addPlayer(socket, room, name, token || crypto.randomUUID(), avatar);
  });
  socket.on('game:start', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.data.playerId) return sendError(socket, 'Solo quien creó la sala puede iniciar.');
    if (room.status !== 'lobby') return;
    if (room.players.size < 2) return sendError(socket, 'Necesitan al menos 2 jugadores para comenzar.');
    room.questions = makeQuestions(); room.questionIndex = 0;
    for (const p of room.players.values()) { p.score = 0; p.correct = 0; }
    startQuestion(room);
  });
  socket.on('game:answer', ({ choice } = {}) => {
    const room = rooms.get(socket.data.roomCode); if (!room || room.status !== 'question') return;
    const p = room.players.get(socket.data.playerId); const q = room.questions[room.questionIndex];
    if (!p || p.answer || !q.choices.includes(choice)) return;
    p.answer = { choice, remaining: room.secondsLeft };
    emitRoom(room);
    const active = [...room.players.values()].filter(x => x.connected);
    if (active.length && active.every(x => x.answer)) revealQuestion(room);
  });
  socket.on('room:leave', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const id = socket.data.playerId;
    room.players.delete(id);
    socket.leave(room.code);
    if (room.hostId === id) { const next = [...room.players.values()].find(p => p.connected); if (next) room.hostId = next.id; }
    if (room.players.size === 0) { stopTimer(room); rooms.delete(room.code); } else emitRoom(room);
    socket.data.roomCode = null; socket.data.playerId = null;
  });
  socket.on('game:restart', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.data.playerId || room.status !== 'finished') return;
    room.status = 'lobby'; room.questions = []; room.questionIndex = 0; room.winner = null;
    for (const p of room.players.values()) { p.score = 0; p.correct = 0; p.answer = null; }
    emitRoom(room);
  });
  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomCode); if (!room) return;
    const p = room.players.get(socket.data.playerId); if (p) p.connected = false;
    emitRoom(room);
    if (room.players.size && [...room.players.values()].every(x => !x.connected)) {
      stopTimer(room); setTimeout(() => { if ([...room.players.values()].every(x => !x.connected)) rooms.delete(room.code); }, 60000);
    }
  });
});

server.listen(PORT, () => console.log(`Brain Racers running on port ${PORT}`));
