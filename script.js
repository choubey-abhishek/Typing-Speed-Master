// ============================================================
// TypeForge — Typing Speed Lab
// Author: Abhishek Choubey
// Features: Modes, Difficulty, History, PB, Sound, Theme, etc.
// ============================================================

// ── Sample Passages by Difficulty ──────────────────────────
const PASSAGES = {
  easy: [
    `The sun rose slowly over the quiet hills. Birds began to sing as the morning light filled the sky. A gentle breeze moved through the trees and the day felt full of promise. Simple moments like these remind us to slow down and enjoy the world around us.`,
    `Reading books is one of the best ways to learn new things. A good book can take you to another world and show you new ideas. Many people find that reading for even a few minutes each day makes a big difference in how they think and feel.`,
    `Cooking at home is a great skill to have. You can make healthy meals and save money at the same time. Start with simple recipes and work your way up to harder ones. Over time you will become more confident in the kitchen.`
  ],
  medium: [
    `Computer science is built on the foundation of problem-solving, logical thinking, and continuous learning. A CS student often works with programming languages, algorithms, and data structures to create efficient solutions. As technology evolves rapidly, students must adapt to new tools, frameworks, and industry practices.`,
    `Machine learning is transforming every industry by enabling computers to learn patterns from data without being explicitly programmed. Neural networks, inspired by the human brain, form the backbone of modern AI systems. Training these models requires vast amounts of data and significant computational power.`,
    `The internet has revolutionized how humans communicate, access information, and conduct business. Open-source software, collaborative platforms, and cloud computing have lowered the barriers to entry for developers worldwide. Today, a single engineer can deploy applications that serve millions of users globally.`,
    `Algorithms are the heart of computing. Understanding their time and space complexity allows engineers to make intelligent tradeoffs between performance and resource usage. Sorting, searching, and graph traversal algorithms appear in almost every meaningful software application built today.`
  ],
  hard: [
    `Asynchronous programming paradigms, particularly event-loop architectures and promise-based concurrency, have fundamentally restructured how developers reason about I/O-bound operations. Understanding the nuances of microtask queues, backpressure mechanisms, and cooperative multitasking requires deep familiarity with runtime internals that most tutorials conspicuously omit.`,
    `Distributed systems engineering grapples with the inherent impossibility results captured by the CAP theorem: consistency, availability, and partition tolerance cannot simultaneously be guaranteed. Practitioners must navigate trade-offs between eventual consistency models, quorum-based consensus algorithms, and the operational complexity introduced by Byzantine fault tolerance protocols.`,
    `Cryptographic primitives — elliptic curve Diffie-Hellman, RSA-OAEP, AES-GCM, and BLAKE3 — provide the mathematical underpinnings for modern secure communication. Zero-knowledge proofs extend this further by allowing one party to demonstrate knowledge of a secret without revealing the secret itself, enabling privacy-preserving authentication at scale.`,
    `Compilers transform high-level source code through a sequence of intermediate representations: lexical analysis, parsing into an abstract syntax tree, semantic analysis, intermediate code generation, optimization passes, and finally target code emission. Each phase introduces correctness constraints that propagate forward, making compiler engineering among the most intellectually demanding subdisciplines in software.`
  ]
};

const WORD_POOLS = {
  easy:   ['the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','day','get','has','him','how','its','may','new','now','old','see','two','who','boy','did','has','let','put','say','she','too','use'],
  medium: ['about','after','again','because','before','between','different','during','example','following','generally','important','including','information','language','learning','multiple','national','number','other','over','part','people','place','problem','program','should','small','social','some','state','study','system','their','these','through','time','under','using','various','where','which','while','without','world','would','year'],
  hard:   ['algorithm','asynchronous','authentication','axiomatically','Byzantine','complexity','cryptographic','distributed','encapsulation','eventually','idempotent','implementation','infrastructure','inheritance','instantiation','microservices','multithreading','optimization','parallelism','polymorphism','probabilistic','refactoring','serialization','specification','throughput','transactional','virtualization']
};

// ── State ───────────────────────────────────────────────────
let state = {
  mode:       'free',    // free | timed | words
  difficulty: 'easy',
  timeLimit:  30,
  wordTarget: 50,
  sampleText: '',
  startTime:  null,
  timerInterval: null,
  countdownInterval: null,
  finished:   false,
  soundOn:    true,
  theme:      'dark',
  errorCount: 0,
  rawCharsTyped: 0,
  history:    JSON.parse(localStorage.getItem('tf_history') || '[]'),
  pb:         JSON.parse(localStorage.getItem('tf_pb')      || '{"wpm":0,"acc":0}'),
};

// ── DOM Refs ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const passageEl   = $('passage');
const inputEl     = $('input');
const wpmEl       = $('wpm');
const rawWpmEl    = $('raw-wpm');
const accuracyEl  = $('accuracy');
const cpmEl       = $('cpm');
const elapsedEl   = $('elapsed');
const errorsEl    = $('errors');
const progressBar = $('progress-bar');
const progressPct = $('progress-pct');
const displayTimer= $('display-timer');
const modeLabel   = $('mode-label');
const wpmBar      = $('wpm-bar');
const wordCounter = $('word-counter');

// ── Audio ────────────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}

function playTick(isCorrect) {
  if (!state.soundOn) return;
  try {
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.value = isCorrect ? 600 : 200;
    g.gain.setValueAtTime(0.04, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.06);
    o.start(); o.stop(audioCtx.currentTime + 0.06);
  } catch(e) {}
}

function playFinishSound() {
  if (!state.soundOn) return;
  try {
    ensureAudio();
    [440, 554, 659, 880].forEach((freq, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      const t = audioCtx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.start(t); o.stop(t + 0.25);
    });
  } catch(e) {}
}

// ── Passage Generation ───────────────────────────────────────
function buildWordCountText(diff, count) {
  const pool = WORD_POOLS[diff];
  let words = [];
  for (let i = 0; i < count; i++) {
    words.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return words.join(' ');
}

function getPassage() {
  if (state.mode === 'words') {
    return buildWordCountText(state.difficulty, state.wordTarget);
  }
  const list = PASSAGES[state.difficulty];
  return list[Math.floor(Math.random() * list.length)];
}

function setPassage(text) {
  state.sampleText = text;
  passageEl.innerHTML = '';
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.textContent = text[i];
    span.className = 'char';
    span.dataset.idx = i;
    passageEl.appendChild(span);
  }
  // Mark first char as cursor
  passageEl.children[0]?.classList.add('cursor');
  resetTest(true);
}

// ── Reset ────────────────────────────────────────────────────
function resetTest(keepText = false) {
  clearInterval(state.timerInterval);
  clearInterval(state.countdownInterval);
  state.startTime    = null;
  state.finished     = false;
  state.errorCount   = 0;
  state.rawCharsTyped = 0;
  inputEl.value      = '';
  elapsedEl.textContent    = '00:00';
  displayTimer.textContent = state.mode === 'timed' ? formatTime(state.timeLimit) : '00:00';
  wpmEl.textContent        = '0';
  rawWpmEl.textContent     = '0';
  cpmEl.textContent        = '0';
  accuracyEl.textContent   = '100%';
  errorsEl.textContent     = '0';
  progressBar.style.width  = '0%';
  progressPct.textContent  = '0%';
  wordCounter.textContent  = '0 words';
  wpmBar.style.width       = '0%';

  passageEl.querySelectorAll('.char').forEach((s, i) => {
    s.classList.remove('correct', 'incorrect', 'cursor');
  });
  passageEl.children[0]?.classList.add('cursor');

  modeLabel.textContent = state.mode === 'timed' ? `${state.timeLimit}s` :
                          state.mode === 'words'  ? `${state.wordTarget}w` : 'Free';
}

// ── Start Timer ──────────────────────────────────────────────
function startTimerIfNeeded() {
  if (state.startTime) return;
  state.startTime = Date.now();

  if (state.mode === 'timed') {
    // Countdown
    const endTime = Date.now() + state.timeLimit * 1000;
    state.countdownInterval = setInterval(() => {
      const remaining = Math.max(0, (endTime - Date.now()) / 1000);
      displayTimer.textContent = formatTime(remaining);
      elapsedEl.textContent    = formatTime(remaining);
      if (remaining <= 0) {
        clearInterval(state.countdownInterval);
        finishTest();
      }
    }, 200);
  } else {
    state.timerInterval = setInterval(updateStats, 200);
  }
  updateStats();
}

// ── Update Stats ─────────────────────────────────────────────
function updateStats() {
  if (state.finished) return;
  const typed    = inputEl.value;
  const total    = state.sampleText.length;
  const elapsed  = state.startTime ? (Date.now() - state.startTime) / 1000 : 0;
  const minutes  = Math.max(1 / 60, elapsed / 60);

  // Correctness
  let correctChars = 0;
  let errors = 0;
  Array.from(typed).forEach((ch, i) => {
    if (state.sampleText[i] === ch) correctChars++;
    else errors++;
  });
  state.errorCount = errors;

  const acc     = typed.length === 0 ? 100 : Math.round((correctChars / typed.length) * 100);
  const words   = typed.trim().length === 0 ? 0 : typed.trim().split(/\s+/).length;
  const netWpm  = Math.max(0, Math.round(words / minutes));
  const rawWpm  = Math.round((typed.length / 5) / minutes);
  const cpm     = Math.round(typed.length / minutes);

  wpmEl.textContent      = isFinite(netWpm) ? netWpm : 0;
  rawWpmEl.textContent   = isFinite(rawWpm) ? rawWpm : 0;
  cpmEl.textContent      = isFinite(cpm)    ? cpm    : 0;
  accuracyEl.textContent = `${acc}%`;
  errorsEl.textContent   = errors;
  wordCounter.textContent= `${words} words`;

  if (state.mode !== 'timed') {
    const t = formatTime(elapsed);
    elapsedEl.textContent    = t;
    displayTimer.textContent = t;
  }

  // Progress bar
  const pct = Math.min(100, Math.round((typed.length / total) * 100));
  progressBar.style.width = `${pct}%`;
  progressPct.textContent = `${pct}%`;
  wpmBar.style.width      = `${Math.min(100, netWpm)}%`;

  // Char highlighting + caret
  const chars = passageEl.querySelectorAll('.char');
  chars.forEach((span, idx) => {
    span.classList.remove('correct', 'incorrect', 'cursor');
    const ch = typed[idx];
    if (ch == null) return;
    span.classList.add(ch === span.textContent ? 'correct' : 'incorrect');
  });
  // Caret on next untyped char
  if (typed.length < total) chars[typed.length]?.classList.add('cursor');

  // Scroll passage to keep cursor visible
  const cursorEl = passageEl.querySelector('.cursor');
  if (cursorEl) cursorEl.scrollIntoView({ block: 'nearest' });

  // Auto-finish for free / words mode
  if (typed.length >= total && !state.finished) finishTest();
}

// ── Input Handler ────────────────────────────────────────────
let lastLen = 0;
inputEl.addEventListener('input', () => {
  if (state.finished) { inputEl.value = ''; return; }
  startTimerIfNeeded();

  const typed = inputEl.value;
  const newLen = typed.length;
  // Sound on each keypress
  if (newLen > lastLen) {
    const idx = newLen - 1;
    const correct = state.sampleText[idx] === typed[idx];
    playTick(correct);
  }
  lastLen = newLen;
  updateStats();
});

// ── Finish ───────────────────────────────────────────────────
function finishTest() {
  if (state.finished) return;
  state.finished = true;
  clearInterval(state.timerInterval);
  clearInterval(state.countdownInterval);
  updateStats();
  playFinishSound();
  showResultsModal();
}

// ── Results Modal ────────────────────────────────────────────
function showResultsModal() {
  const typed   = inputEl.value;
  const elapsed = state.startTime ? (Date.now() - state.startTime) / 1000 : 0;
  const minutes = Math.max(1 / 60, elapsed / 60);

  let correctChars = 0, errors = 0;
  Array.from(typed).forEach((ch, i) => {
    if (state.sampleText[i] === ch) correctChars++;
    else errors++;
  });
  const acc    = typed.length === 0 ? 100 : Math.round((correctChars / typed.length) * 100);
  const words  = typed.trim().length === 0 ? 0 : typed.trim().split(/\s+/).length;
  const netWpm = Math.max(0, Math.round(words / minutes));
  const rawWpm = Math.round((typed.length / 5) / minutes);
  const cpm    = Math.round(typed.length / minutes);

  $('m-wpm').textContent     = isFinite(netWpm) ? netWpm : 0;
  $('m-rawwpm').textContent  = isFinite(rawWpm) ? rawWpm : 0;
  $('m-acc').textContent     = `${acc}%`;
  $('m-cpm').textContent     = isFinite(cpm) ? cpm : 0;
  $('m-errors').textContent  = errors;
  $('m-time').textContent    = `${Math.round(elapsed)}s`;

  // Check personal best
  const pbLabel = $('pb-label');
  let pbMsg = '';
  if (netWpm > state.pb.wpm) {
    state.pb.wpm = netWpm;
    pbMsg = `🎉 New WPM record: ${netWpm}!`;
  }
  if (acc > state.pb.acc) {
    state.pb.acc = acc;
  }
  localStorage.setItem('tf_pb', JSON.stringify(state.pb));
  pbLabel.textContent = pbMsg;
  updatePBDisplay();

  // Save to history
  const run = { wpm: netWpm, acc, time: Math.round(elapsed), diff: state.difficulty };
  state.history.unshift(run);
  if (state.history.length > 10) state.history.pop();
  localStorage.setItem('tf_history', JSON.stringify(state.history));
  renderHistory();

  $('results-modal').classList.remove('hidden');
  $('modal-title').textContent = netWpm >= 80 ? 'Blazing Fast! 🔥' :
                                  netWpm >= 50 ? 'Great Job! ✓' :
                                  netWpm >= 30 ? 'Keep Practicing!' : 'Just Getting Started';
}

function updatePBDisplay() {
  $('pb-wpm').textContent = state.pb.wpm > 0 ? `${state.pb.wpm} WPM` : '—';
  $('pb-acc').textContent = state.pb.acc > 0 ? `${state.pb.acc}%` : '—';
}

function renderHistory() {
  const list = $('history-list');
  list.innerHTML = '';
  if (state.history.length === 0) {
    list.innerHTML = '<div class="no-history">No runs yet</div>';
    return;
  }
  state.history.slice(0, 8).forEach(r => {
    const d = document.createElement('div');
    d.className = 'history-item';
    d.innerHTML = `<span class="h-wpm">${r.wpm} WPM</span><span class="h-acc">${r.acc}%</span><span class="h-time">${r.time}s · ${r.diff}</span>`;
    list.appendChild(d);
  });
}

// ── Format Time ──────────────────────────────────────────────
function formatTime(s) {
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

// ── Config Controls ──────────────────────────────────────────
function setupSegControl(containerId, handler) {
  const container = $(containerId);
  container.querySelectorAll('.seg').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      handler(btn);
    });
  });
}

setupSegControl('mode-seg', btn => {
  state.mode = btn.dataset.mode;
  $('time-group').style.display  = state.mode === 'timed' ? '' : 'none';
  $('words-group').style.display = state.mode === 'words' ? '' : 'none';
  newPassage();
});

setupSegControl('time-seg', btn => {
  state.timeLimit = parseInt(btn.dataset.time);
  newPassage();
});

setupSegControl('words-seg', btn => {
  state.wordTarget = parseInt(btn.dataset.words);
  newPassage();
});

setupSegControl('diff-seg', btn => {
  state.difficulty = btn.dataset.diff;
  newPassage();
});

function newPassage() {
  setPassage(getPassage());
}

// ── Button Events ─────────────────────────────────────────────
$('restart').addEventListener('click', () => {
  $('results-modal').classList.add('hidden');
  resetTest(false);
  setPassage(state.sampleText);
});

$('finish').addEventListener('click', finishTest);

$('change-sample').addEventListener('click', newPassage);

$('paste-text').addEventListener('click', () => {
  const t = prompt('Paste your custom passage:');
  if (t && t.trim()) setPassage(t.trim());
});

$('modal-retry').addEventListener('click', () => {
  $('results-modal').classList.add('hidden');
  setPassage(state.sampleText);
});

$('modal-new').addEventListener('click', () => {
  $('results-modal').classList.add('hidden');
  newPassage();
});

$('modal-close').addEventListener('click', () => {
  $('results-modal').classList.add('hidden');
});

// ── Theme Toggle ─────────────────────────────────────────────
$('theme-toggle').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme === 'light' ? 'light' : '');
  $('theme-toggle').classList.toggle('active', state.theme === 'light');
});

// ── Sound Toggle ─────────────────────────────────────────────
$('sound-toggle').addEventListener('click', () => {
  state.soundOn = !state.soundOn;
  $('sound-toggle').textContent = state.soundOn ? '♪' : '♩';
  $('sound-toggle').classList.toggle('active', !state.soundOn);
});

// ── Caps Lock Detection ───────────────────────────────────────
document.addEventListener('keyup', e => {
  const capsOn = e.getModifierState && e.getModifierState('CapsLock');
  $('caps-warn').classList.toggle('hidden', !capsOn);
});
document.addEventListener('keydown', e => {
  const capsOn = e.getModifierState && e.getModifierState('CapsLock');
  $('caps-warn').classList.toggle('hidden', !capsOn);

  // Ctrl+R shortcut
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
    e.preventDefault();
    setPassage(state.sampleText);
  }
});

// ── Passage click → focus input ──────────────────────────────
passageEl.addEventListener('click', () => inputEl.focus());

// ── Background Canvas ─────────────────────────────────────────
(function initCanvas() {
  const canvas = $('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, dots;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeDots() {
    dots = Array.from({ length: 60 }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      r:  Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const isDark = state.theme === 'dark';
    const dotColor = isDark ? 'rgba(56,189,248,' : 'rgba(29,111,202,';

    dots.forEach(d => {
      d.x = (d.x + d.vx + W) % W;
      d.y = (d.y + d.vy + H) % H;

      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = dotColor + '0.6)';
      ctx.fill();
    });

    // Draw faint connecting lines
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x;
        const dy = dots[i].y - dots[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(dots[i].x, dots[i].y);
          ctx.lineTo(dots[j].x, dots[j].y);
          ctx.strokeStyle = dotColor + (0.12 * (1 - dist / 120)) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); makeDots(); });
  resize();
  makeDots();
  draw();
})();

// ── Init ──────────────────────────────────────────────────────
updatePBDisplay();
renderHistory();
newPassage();
inputEl.focus();
