(() => {
  const COLS = 15; // x
  const ROWS = 8;  // y
  const TOTAL = COLS * ROWS;
  const MIN = 1, MAX = 9;
  const DURATION = 60; // seconds

  const board = document.getElementById('board');
  const dragRectEl = document.getElementById('dragRect');
  const scoreEl = document.getElementById('score');
  const statusText = document.getElementById('statusText');
  const timeText = document.getElementById('timeText');
  const scoreText = document.getElementById('scoreText');
  const helpBtn = document.getElementById('helpBtn');
  const modal = document.getElementById('modal');
  const closeModal = document.getElementById('closeModal');
  const startBtn = document.getElementById('startBtn');
  const timeFill = document.getElementById('timeFill');
  const timeSideLabel = document.getElementById('timeSideLabel');
  const intro = document.getElementById('intro');
  const introStart = document.getElementById('introStart');
  const bgm = document.getElementById('bgm');
  const toIntroBtn = document.getElementById('toIntroBtn');
  const sfxSelect = document.getElementById('sfxSelect');
  const groupOutline = document.getElementById('groupOutline');

  let values = [];
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let currentSelection = new Set();
  let score = 0;
  let timeLeft = DURATION;
  let timerId = null;
  let isOver = false;

  function randint(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function initGrid() {
    values = Array.from({ length: TOTAL }, () => randint(MIN, MAX));
    board.innerHTML = '';
    for (let i = 0; i < TOTAL; i++) {
      const val = values[i];
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = String(i);
      cell.textContent = String(val);
      board.appendChild(cell);
    }
  }

  function resetGame() {
    isOver = false;
    score = 0;
    timeLeft = DURATION;
    updateScore();
    updateTime();
    statusText.textContent = '상태: playing';
    initGrid();
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      timeLeft -= 1;
      updateTime();
      if (timeLeft <= 0) {
        endGame();
      }
    }, 1000);
    if (bgm) {
      try { bgm.currentTime = 0; bgm.play().catch(() => {}); } catch(_) {}
    }
  }

  function endGame() {
    if (timerId) clearInterval(timerId);
    isOver = true;
    statusText.textContent = '상태: ended';
    if (timeFill) timeFill.style.height = '0%';
    if (bgm) { try { bgm.pause(); } catch(_){} }
    alert(`시간 종료! 최종 점수: ${score}`);
  }

  function showIntro() {
    if (timerId) clearInterval(timerId);
    isOver = true;
    if (bgm) { try { bgm.pause(); } catch(_){} }
    if (intro) {
      intro.style.display = 'flex';
      intro.classList.remove('fade-out');
    }
    statusText.textContent = '상태: ready';
  }

  function updateScore() {
    scoreEl.textContent = `점수: ${score}`;
    scoreText.textContent = `점수: ${score}`;
  }
  function updateTime() {
    const t = Math.max(0, timeLeft);
    timeText.textContent = `시간: ${t}s`;
    if (timeSideLabel) timeSideLabel.textContent = `${t}s`;
    if (timeFill) {
      const pct = (t / DURATION) * 100;
      timeFill.style.height = pct + '%';
      if (t <= 10) {
        timeFill.style.background = 'linear-gradient(180deg,#ff5252,#b71c1c)';
      } else {
        timeFill.style.background = 'linear-gradient(180deg,#66bb6a,#2e7d32)';
      }
    }
  }

  function getRectFromPoints(p1, p2) {
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.abs(p1.x - p2.x);
    const h = Math.abs(p1.y - p2.y);
    return { x, y, w, h };
  }

  function rectsIntersect(a, b) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
  }

  function getCellRect(cell) {
    const br = board.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    return { x: r.left - br.left, y: r.top - br.top, w: r.width, h: r.height };
  }

  function clearSelection() {
    // remove any legacy per-cell selection classes
    currentSelection.forEach(i => {
      const el = board.querySelector(`.cell[data-index="${i}"]`);
      if (el) el.classList.remove('selected');
    });
    currentSelection.clear();
    if (groupOutline) groupOutline.classList.add('hidden');
  }

  function applySelection(rect) {
    // build selection set only; no per-apple rings
    currentSelection.clear();
    const cells = board.querySelectorAll('.cell');
    cells.forEach(cell => {
      if (cell.classList.contains('removed')) return;
      const cr = getCellRect(cell);
      if (rectsIntersect(rect, cr)) {
        currentSelection.add(Number(cell.dataset.index));
      }
    });
    updateGroupOutlineFromSelection();
  }

  function updateGroupOutlineFromSelection() {
    if (!groupOutline) return;
    if (currentSelection.size === 0) {
      groupOutline.classList.add('hidden');
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    currentSelection.forEach(i => {
      const el = board.querySelector(`.cell[data-index="${i}"]`);
      if (!el) return;
      const r = getCellRect(el);
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    });
    if (!isFinite(minX)) {
      groupOutline.classList.add('hidden');
      return;
    }
    const padding = 8; // thicker border, center visually
    groupOutline.style.left = (minX - padding) + 'px';
    groupOutline.style.top = (minY - padding) + 'px';
    groupOutline.style.width = (maxX - minX + padding * 2) + 'px';
    groupOutline.style.height = (maxY - minY + padding * 2) + 'px';
    groupOutline.classList.remove('hidden');
  }

  function selectionSum() {
    let s = 0;
    currentSelection.forEach(i => {
      const v = values[i];
      if (v != null) s += v;
    });
    return s;
  }

  function removeSelectedRingsOnly() { /* no-op now: we don't add per-apple rings */ }

  function removeSelectedIfValid() {
    const sum = selectionSum();
    if (sum !== 10) {
      // Not valid: keep the selection set but hide per-apple rings
      removeSelectedRingsOnly();
      updateGroupOutlineFromSelection();
      return false;
    }
    // valid -> remove and score equals number of apples
    if (typeof sfxSelect !== 'undefined' && sfxSelect) {
      try { sfxSelect.currentTime = 0; sfxSelect.play().catch(() => {}); } catch(_) {}
    }
    const count = currentSelection.size;
    currentSelection.forEach(i => {
      const el = board.querySelector(`.cell[data-index="${i}"]`);
      if (el) {
        el.classList.add('removed');
        el.classList.remove('selected');
        el.textContent = '';
      }
      values[i] = null; // keep hole
    });
    currentSelection.clear();
    score += count;
    updateScore();
    if (groupOutline) groupOutline.classList.add('hidden');
    return true;
  }

  function onPointerDown(e) {
    if (isOver) return;
    isDragging = true;
    const br = board.getBoundingClientRect();
    dragStart = { x: e.clientX - br.left, y: e.clientY - br.top };
    dragRectEl.classList.remove('hidden');
    updateDragRect(dragStart, dragStart);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const br = board.getBoundingClientRect();
    const now = { x: e.clientX - br.left, y: e.clientY - br.top };
    updateDragRect(dragStart, now);
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    dragRectEl.classList.add('hidden');
    const valid = removeSelectedIfValid();
    if (!valid && sfxSelect) {
      try { sfxSelect.currentTime = 0; sfxSelect.play().catch(() => {}); } catch(_) {}
    }
    // Always hide outline and clear selection after releasing
    if (groupOutline) groupOutline.classList.add('hidden');
    currentSelection.clear();
  }

  function updateDragRect(p1, p2) {
    const rect = getRectFromPoints(p1, p2);
    dragRectEl.style.left = rect.x + 'px';
    dragRectEl.style.top = rect.y + 'px';
    dragRectEl.style.width = rect.w + 'px';
    dragRectEl.style.height = rect.h + 'px';
    applySelection(rect);
  }

  // Setup events
  board.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  helpBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  closeModal.addEventListener('click', () => modal.classList.add('hidden'));
  startBtn.addEventListener('click', resetGame);
  if (introStart) {
    introStart.addEventListener('click', () => {
      if (intro) {
        intro.classList.add('fade-out');
        setTimeout(() => { intro.style.display = 'none'; }, 250);
      }
      resetGame();
    });
  }

  if (toIntroBtn) {
    toIntroBtn.addEventListener('click', showIntro);
  }

  // initial state
  initGrid();
})();


