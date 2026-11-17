const socket = io();
const $ = (id) => document.getElementById(id);
const screens = ['homeScreen','lobbyScreen','gameScreen','studyScreen','resultScreen'];
const state = { name: '', avatar: '🚀', token: localStorage.getItem('brToken') || '', code: localStorage.getItem('brRoom') || '', name: localStorage.getItem('brName') || '', playerId: '', room: null, answered: false };
let toastTimer;
let studyReturnScreen = 'homeScreen';
if (state.name) $('playerName').value = state.name;
function showToast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
function showScreen(id) { screens.forEach(s => $(s).classList.toggle('hidden', s !== id)); window.scrollTo({top:0,behavior:'smooth'}); }
function getName() { const n = $('playerName').value.trim(); if (!n) { showToast('Escribe tu apodo primero.'); $('playerName').focus(); return ''; } return n.slice(0,18); }
function ensureToken() { if (!state.token) { state.token = (crypto.randomUUID ? crypto.randomUUID() : 'br-'+Math.random().toString(36).slice(2)); localStorage.setItem('brToken', state.token); } return state.token; }
function joinExistingIfPossible() {
  const code = localStorage.getItem('brRoom'), name = localStorage.getItem('brName');
  if (code && name && state.token) { state.name = name; socket.emit('room:join', {code, name, token:state.token, avatar:state.avatar}); }
}
function beginCreate() { const name = getName(); if (!name) return; state.name = name; state.code=''; localStorage.removeItem('brRoom'); localStorage.setItem('brName',name); socket.emit('room:create',{name,token:ensureToken(),avatar:state.avatar}); }
function beginJoin() { const name = getName(); if (!name) return; const code = $('roomCodeInput').value.trim(); if (!/^\d{5}$/.test(code)) return showToast('El código debe tener 5 números.'); state.name=name; localStorage.setItem('brName',name); socket.emit('room:join',{code,name,token:ensureToken(),avatar:state.avatar}); }
$('createBtn').addEventListener('click',beginCreate); $('joinBtn').addEventListener('click',beginJoin);
$('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')beginCreate();}); $('roomCodeInput').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,5));
document.querySelectorAll('.avatar-choice').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.avatar-choice').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');state.avatar=btn.dataset.avatar;$('avatarPreview').textContent=state.avatar;}));
$('copyCodeBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.code);showToast('Código copiado. ¡Compártelo con tus corredores!');}catch{showToast('Código de sala: '+state.code);}});
$('startBtn').addEventListener('click',()=>socket.emit('game:start'));
$('restartBtn').addEventListener('click',()=>socket.emit('game:restart'));
function leaveRoom(){socket.emit('room:leave');localStorage.removeItem('brRoom');state.code='';state.room=null;state.playerId='';state.answered=false;showScreen('homeScreen');showToast('Has salido de la sala.');}
$('backHomeBtn').addEventListener('click',leaveRoom);
$('leaveLobbyBtn').addEventListener('click',leaveRoom);
$('leaveGameBtn').addEventListener('click',()=>{if(confirm('¿Seguro que quieres salir de la carrera?'))leaveRoom();});
socket.on('connect',()=>{if(state.code && state.name && state.token) socket.emit('room:join',{code:state.code,name:state.name,token:state.token,avatar:state.avatar});});
socket.on('session:ready',data=>{state.token=data.token;state.code=data.code;state.playerId=data.playerId;localStorage.setItem('brToken',state.token);localStorage.setItem('brRoom',state.code);});
socket.on('app:error',message=>showToast(message));
socket.on('room:update',room=>{state.room=room;renderRoom(room);});
function renderRoom(room) {
  if ($('studyScreen') && !$('studyScreen').classList.contains('hidden')) return;
  if(room.status==='lobby') { showScreen('lobbyScreen'); $('roomCode').textContent=room.code; $('playerCount').textContent=`${room.players.length} / 4`; renderLobbyPlayers(room); const isHost=room.hostId===state.playerId; $('startBtn').classList.toggle('hidden',!isHost); $('hostHint').classList.toggle('hidden',isHost); $('startBtn').disabled=room.players.length<2; $('waitingNote').textContent=room.players.length<4?'⌛ Esperando a más corredores...':'🚦 ¡Parrilla completa!'; }
  if(room.status==='question'||room.status==='reveal') { showScreen('gameScreen'); renderGame(room); }
  if(room.status==='finished') { showScreen('resultScreen'); renderResults(room); }
}
function renderLobbyPlayers(room) {
  $('lobbyPlayers').innerHTML='';
  room.players.forEach(p=>{const card=document.createElement('div');card.className='lobby-player';card.innerHTML=`<div class="player-avatar" style="outline:2px solid ${p.color}">${p.avatar}</div><div><div class="player-name"></div><div class="player-sub">${p.connected?'● CONECTADO':'○ DESCONECTADO'}</div></div>${p.id===room.hostId?'<span class="host-chip">HOST</span>':''}`;card.querySelector('.player-name').textContent=p.name; $('lobbyPlayers').appendChild(card);});
}
function renderGame(room) {
  const q=room.question; if(!q)return;
  $('roundNumber').textContent=String(room.questionIndex+1).padStart(2,'0'); $('timerText').textContent=room.secondsLeft; $('timerBar').style.width=(room.secondsLeft/18*100)+'%'; $('questionPrompt').textContent=q.prompt;
  $('questionType').textContent=q.type==='definition'?'DEFINICIÓN':q.type==='spanish'?'TRADUCCIÓN':'SINÓNIMOS';
  const me=room.players.find(p=>p.id===state.playerId); state.answered=!!(me&&me.answered);
  const grid=$('answerGrid'); grid.innerHTML='';
  q.choices.forEach((choice,i)=>{const b=document.createElement('button');b.className='answer-btn';b.disabled=state.answered||room.status==='reveal';b.innerHTML=`<span style="color:var(--mint);margin-right:9px">${String.fromCharCode(65+i)}.</span>`;const span=document.createElement('span');span.textContent=choice;b.appendChild(span);if(me&&me.answered&&room.status==='question'&&me.answer===choice)b.classList.add('picked');b.addEventListener('click',()=>{if(!state.answered){state.answered=true;socket.emit('game:answer',{choice});$('answerStatus').textContent='Respuesta enviada. ¡A esperar el resultado!';grid.querySelectorAll('button').forEach(x=>x.disabled=true);}});grid.appendChild(b);});
  if(room.status==='reveal') { $('answerStatus').textContent='¡Mira la clasificación! Siguiente ronda en unos segundos.'; $('revealBanner').classList.remove('hidden'); $('revealAnswer').textContent=room.reveal.answer; $('revealDetail').textContent=room.reveal.detail; }
  else { $('revealBanner').classList.add('hidden'); $('answerStatus').textContent=state.answered?'Respuesta enviada. ¡Bien hecho!':'Elige tu respuesta antes de que termine el tiempo.'; }
  renderRace(room); renderScores(room);
}
function renderRace(room) {
  const lanes=$('raceLanes');lanes.innerHTML='';
  room.players.forEach(p=>{const lane=document.createElement('div');lane.className='race-lane';const pct=Math.min(94,Math.max(2,(p.correct/room.totalQuestions)*100));lane.innerHTML=`<div class="lane-fill" style="width:${pct}%;background:${p.color}"></div><span class="lane-label"></span><span class="lane-car" style="left:${pct}%">${p.avatar}</span>`;lane.querySelector('.lane-label').textContent=p.name;lanes.appendChild(lane);});
}
function renderScores(room) {
  const list=$('scoreList');list.innerHTML='';[...room.players].sort((a,b)=>b.score-a.score).forEach(p=>{const item=document.createElement('div');item.className='score-item';item.innerHTML=`<div class="player-avatar" style="outline:1px solid ${p.color}">${p.avatar}</div><div class="score-player"></div><div><div class="score-points">${p.score.toLocaleString('es')}</div><div class="score-correct">${p.correct}/10 aciertos</div></div>`;item.querySelector('.score-player').textContent=p.name;list.appendChild(item);});
}
function renderResults(room) {
  const ranked=[...room.players].sort((a,b)=>b.score-a.score||b.correct-a.correct);const winner=room.winner;
  $('winnerTitle').textContent=winner?(winner.tied?'¡EMPATE EN LA META!':`¡${winner.name.toUpperCase()} GANA!`):'¡CARRERA COMPLETADA!';$('winnerSubtitle').textContent='Cada palabra aprendida te acerca a tu próxima meta TOEIC.';
  const podium=$('finalRanking');podium.innerHTML='';ranked.forEach((p,i)=>{const card=document.createElement('div');card.className='podium-card'+(i===0?' first':'');card.innerHTML=`<div class="podium-avatar">${p.avatar}</div><div class="podium-rank">${['🥇 1.º LUGAR','🥈 2.º LUGAR','🥉 3.º LUGAR','4.º LUGAR'][i]}</div><div class="podium-name"></div><div class="podium-score">${p.score.toLocaleString('es')}</div><div class="podium-meta">${p.correct}/10 respuestas correctas</div>`;card.querySelector('.podium-name').textContent=p.name;podium.appendChild(card);});
  const isHost=room.hostId===state.playerId;$('restartBtn').classList.toggle('hidden',!isHost);if(!isHost){$('winnerSubtitle').textContent+=' El anfitrión puede iniciar una revancha.';}
}


// STUDY MODE: flashcards built from the same TOEIC glossary used by the race.
const study = { words: [], filtered: [], index: 0, filter: 'all', known: new Set(JSON.parse(localStorage.getItem('brKnownWords') || '[]')), review: new Set(JSON.parse(localStorage.getItem('brReviewWords') || '[]')) };
function saveStudyProgress(){localStorage.setItem('brKnownWords',JSON.stringify([...study.known]));localStorage.setItem('brReviewWords',JSON.stringify([...study.review]));}
async function openStudy(){
  try{
    if(!study.words.length){const response=await fetch('/words.json');if(!response.ok)throw new Error('No se pudo cargar el glosario');study.words=await response.json();}
    study.filter='all';
    $('leaveStudyRoomBtn').classList.toggle('hidden', studyReturnScreen==='homeScreen');
    document.querySelectorAll('.study-filter').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));
    updateStudyList();showScreen('studyScreen');
  }catch(e){showToast('No se pudo cargar el modo Study. Revisa words.json.');}
}
function updateStudyList(){
  study.filtered=study.words.filter(w=>study.filter==='review'?study.review.has(w.word):study.filter==='known'?study.known.has(w.word):true);
  if(!study.filtered.length){study.index=0;renderStudyEmpty();return;}
  study.index=Math.min(study.index,study.filtered.length-1);renderStudyCard();
}
function renderStudyEmpty(){ $('studyCounter').textContent='0 / 0';$('studyProgress').style.width='0%';$('flashWord').textContent='¡Todo listo!';$('flashPron').textContent='No hay tarjetas en esta categoría.';$('flashDefinition').textContent='Prueba otra categoría o continúa estudiando nuevas palabras.';$('flashSpanish').textContent='';$('flashBackPron').textContent='';$('flashcard').classList.remove('flipped');$('studyNote').textContent='Las tarjetas que marques como “Lo sé” o “Repasar” se guardan en este dispositivo.'; }
function renderStudyCard(){
  const w=study.filtered[study.index];if(!w)return renderStudyEmpty();
  $('studyCounter').textContent=`${study.index+1} / ${study.filtered.length} · ${study.known.size} dominadas · ${study.review.size} por repasar`;
  $('studyProgress').style.width=((study.index+1)/study.filtered.length*100)+'%';$('flashWord').textContent=w.word;$('flashPron').textContent=w.pronunciation||'Pronunciación no disponible';$('flashDefinition').textContent=w.definition||'Definición no disponible';$('flashSpanish').textContent=w.spanish||'Traducción no disponible';$('flashBackPron').textContent=w.pronunciation||'';$('flashcard').classList.remove('flipped');
  $('studyNote').textContent=study.known.has(w.word)?'✓ Esta palabra está marcada como dominada.':study.review.has(w.word)?'↻ Esta palabra está en tu lista para repasar.':'Intenta recordar el significado antes de voltear la tarjeta.';
}
function stepStudy(delta){if(!study.filtered.length)return;study.index=(study.index+delta+study.filtered.length)%study.filtered.length;renderStudyCard();}
function markStudy(kind){const w=study.filtered[study.index];if(!w)return;if(kind==='known'){study.known.add(w.word);study.review.delete(w.word);}else{study.review.add(w.word);study.known.delete(w.word);}saveStudyProgress();updateStudyList();}
$('studyHomeBtn').addEventListener('click',()=>{studyReturnScreen='homeScreen';openStudy();});
$('lobbyStudyBtn').addEventListener('click',()=>{studyReturnScreen='lobbyScreen';openStudy();});
$('exitStudyBtn').addEventListener('click',()=>showScreen(studyReturnScreen));
$('leaveStudyRoomBtn').addEventListener('click',leaveRoom);
$('flashcard').addEventListener('click',()=>$('flashcard').classList.toggle('flipped'));
$('prevCardBtn').addEventListener('click',()=>stepStudy(-1));$('nextCardBtn').addEventListener('click',()=>stepStudy(1));$('knownCardBtn').addEventListener('click',()=>markStudy('known'));$('reviewCardBtn').addEventListener('click',()=>markStudy('review'));
document.querySelectorAll('.study-filter').forEach(btn=>btn.addEventListener('click',()=>{study.filter=btn.dataset.filter;study.index=0;document.querySelectorAll('.study-filter').forEach(b=>b.classList.toggle('active',b===btn));updateStudyList();}));
