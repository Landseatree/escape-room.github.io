/* ===========================================================
   謎解きウェブサイト ― ロジック
   画面構成:
     1. #screen-wait      待機画面
     2. #screen-question  問題画面
     3. #screen-correct   正解画面
     4. #screen-fail      脱落画面
=========================================================== */
 
(() => {
  'use strict';
 
  // -----------------------------------------------------
  // 設定: 謎ごとのファイルパス（現在は no1 のみ）
  // 謎を増やす場合はこの配列に追記し、QUESTION_INDEX を進める処理を加える
  // -----------------------------------------------------
  const PUZZLES = [
    { folder: 'no1', image: 'question1.jpg', answerFile: 'answer1.txt' }
  ];
  let currentPuzzleIndex = 0;
 
  // -----------------------------------------------------
  // ひらがなキーパッド配列（5列）
  // -----------------------------------------------------
  const HIRAGANA_ROWS = [
    ['あ','い','う','え','お'],
    ['か','き','く','け','こ'],
    ['さ','し','す','せ','そ'],
    ['た','ち','つ','て','と'],
    ['な','に','ぬ','ね','の'],
    ['は','ひ','ふ','へ','ほ'],
    ['ま','み','む','め','も'],
    ['や','　','ゆ','　','よ'],
    ['ら','り','る','れ','ろ'],
    ['わ','を','ん','ー','ゃ'],
    ['ゅ','ょ','っ','゛','゜']
  ];
 
  // -----------------------------------------------------
  // DOM参照
  // -----------------------------------------------------
  const screens = {
    wait: document.getElementById('screen-wait'),
    question: document.getElementById('screen-question'),
    correct: document.getElementById('screen-correct'),
    fail: document.getElementById('screen-fail')
  };
 
  const doors = document.querySelectorAll('.door');
  const keypadEl = document.getElementById('keypad');
  const answerTextEl = document.getElementById('answerText');
  const answerBoxEl = document.getElementById('answerBox');
  const placeholderEl = document.getElementById('answerPlaceholder');
  const wrongMarkEl = document.getElementById('wrongMark');
  const timerEl = document.getElementById('timer');
  const timerNumEl = document.getElementById('timerNum');
  const timerRingEl = document.getElementById('timerRing');
  const questionImageEl = document.getElementById('questionImage');
 
  const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 in svg
 
  // -----------------------------------------------------
  // 状態
  // -----------------------------------------------------
  let currentInput = '';
  let correctAnswer = '';
  let timeLimit = 90;
  let remainingTime = 90;
  let timerInterval = null;
  let isLocked = false; // 正誤判定中などの入力ロック
 
  // -----------------------------------------------------
  // 画面切り替え
  // -----------------------------------------------------
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('screen--active'));
    screens[name].classList.add('screen--active');
  }
 
  // -----------------------------------------------------
  // キーパッド生成
  // -----------------------------------------------------
  function buildKeypad() {
    keypadEl.innerHTML = '';
 
    HIRAGANA_ROWS.flat().forEach(char => {
      const btn = document.createElement('button');
      btn.className = 'key';
      btn.type = 'button';
      if (char === '　') {
        btn.classList.add('key--blank');
        btn.disabled = true;
        btn.setAttribute('aria-hidden', 'true');
      } else {
        btn.textContent = char;
        btn.addEventListener('click', () => inputChar(char));
      }
      keypadEl.appendChild(btn);
    });
 
    const delBtn = document.createElement('button');
    delBtn.className = 'key key--del';
    delBtn.type = 'button';
    delBtn.textContent = '1文字削除';
    delBtn.addEventListener('click', deleteChar);
    keypadEl.appendChild(delBtn);
 
    const enterBtn = document.createElement('button');
    enterBtn.className = 'key key--enter';
    enterBtn.type = 'button';
    enterBtn.textContent = '確定';
    enterBtn.addEventListener('click', submitAnswer);
    keypadEl.appendChild(enterBtn);
  }
 
  function inputChar(char) {
    if (isLocked) return;
    currentInput += char;
    renderAnswer();
  }
 
  function deleteChar() {
    if (isLocked) return;
    currentInput = currentInput.slice(0, -1);
    renderAnswer();
  }
 
  function clearInput() {
    currentInput = '';
    renderAnswer();
  }
 
  function renderAnswer() {
    answerTextEl.textContent = currentInput;
    if (currentInput.length > 0) {
      placeholderEl.style.display = 'none';
    } else {
      placeholderEl.style.display = '';
    }
  }
 
  // -----------------------------------------------------
  // 正解データの読み込み
  // -----------------------------------------------------
  async function loadAnswer(puzzle) {
    const res = await fetch(`${puzzle.folder}/${puzzle.answerFile}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('answer file not found: ' + puzzle.answerFile);
    const text = await res.text();
    return text.trim();
  }
 
  function loadQuestionImage(puzzle) {
    questionImageEl.src = `${puzzle.folder}/${puzzle.image}`;
  }
 
  // -----------------------------------------------------
  // タイマー
  // -----------------------------------------------------
  function startTimer(seconds) {
    stopTimer();
    timeLimit = seconds;
    remainingTime = seconds;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      remainingTime -= 1;
      updateTimerDisplay();
      if (remainingTime <= 0) {
        stopTimer();
        goToFail();
      }
    }, 1000);
  }
 
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
 
  function updateTimerDisplay() {
    const shown = Math.max(remainingTime, 0);
    timerNumEl.textContent = shown;
 
    const ratio = Math.max(remainingTime, 0) / timeLimit;
    const offset = RING_CIRCUMFERENCE * (1 - ratio);
    timerRingEl.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
    timerRingEl.style.strokeDashoffset = `${offset}`;
 
    if (remainingTime <= 10) {
      timerEl.classList.add('timer--warning', 'timer--pulse');
    } else {
      timerEl.classList.remove('timer--warning', 'timer--pulse');
    }
  }
 
  // -----------------------------------------------------
  // 正誤判定
  // -----------------------------------------------------
  async function submitAnswer() {
    if (isLocked) return;
    if (currentInput.length === 0) return;
 
    if (currentInput === correctAnswer) {
      isLocked = true;
      stopTimer();
      goToCorrect();
    } else {
      showWrongMark();
    }
  }
 
  function showWrongMark() {
    isLocked = true;
    wrongMarkEl.classList.add('wrongmark--show');
    setTimeout(() => {
      wrongMarkEl.classList.remove('wrongmark--show');
      clearInput();
      isLocked = false;
    }, 2000);
  }
 
  // -----------------------------------------------------
  // 画面遷移アクション
  // -----------------------------------------------------
  function goToQuestion(players, seconds) {
    currentPuzzleIndex = 0; // 必要であれば呼び出し元で進める
    const puzzle = PUZZLES[currentPuzzleIndex];
 
    currentInput = '';
    isLocked = false;
    renderAnswer();
    loadQuestionImage(puzzle);
 
    loadAnswer(puzzle)
      .then(ans => { correctAnswer = ans; })
      .catch(err => {
        console.error(err);
        correctAnswer = '';
      });
 
    showScreen('question');
    startTimer(seconds);
  }
 
  function goToCorrect() {
    showScreen('correct');
    setTimeout(() => {
      goToWait();
    }, 5000);
  }
 
  function goToFail() {
    showScreen('fail');
    // 仕様上、脱落画面からの自動遷移先は明示されていないため
    // 5秒表示後そのまま待機画面へ戻す（運用上の再挑戦準備）
    setTimeout(() => {
      goToWait();
    }, 5000);
  }
 
  function goToWait() {
    stopTimer();
    currentInput = '';
    renderAnswer();
    showScreen('wait');
  }
 
  // -----------------------------------------------------
  // 初期化
  // -----------------------------------------------------
  function init() {
    buildKeypad();
 
    doors.forEach(door => {
      door.addEventListener('click', () => {
        const players = parseInt(door.dataset.players, 10);
        const seconds = parseInt(door.dataset.time, 10);
        goToQuestion(players, seconds);
      });
    });
 
    showScreen('wait');
  }
 
  document.addEventListener('DOMContentLoaded', init);
})();
