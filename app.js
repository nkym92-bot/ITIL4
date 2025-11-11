// セキュリティ方針: innerHTMLは使わずtextContentで描画してXSSを回避
const $ = (sel) => document.querySelector(sel);
const quizArea = $("#quizArea");
const reviewArea = $("#reviewArea");
const modeSel = $("#mode");
const domainSel = $("#domain");
const countInput = $("#count");
const minutesInput = $("#minutes");
const startBtn = $("#startBtn");
const resetBtn = $("#resetBtn");
const submitBtn = $("#submitBtn");
const retryIncorrectBtn = $("#retryIncorrectBtn");
const timerSpan = $("#timer");
const progressSpan = $("#progress");
const scoreSpan = $("#score");
const exportBookmarksBtn = $("#exportBookmarksBtn");
const importBookmarksBtn = $("#importBookmarksBtn");
const importBookmarksFile = $("#importBookmarksFile");

const LS_KEYS = {
  BOOKMARKS: "itil4_bookmarks",
  PROGRESS: "itil4_progress"
};

let allQuestions = [];
let currentSet = [];
let answers = new Map();            // qid -> choiceIndex
let revealInstant = false;          // 練習モードで即判定
let examTimer = null;
let examEndTime = 0;

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(LS_KEYS.BOOKMARKS);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveBookmarks(set) {
  localStorage.setItem(LS_KEYS.BOOKMARKS, JSON.stringify([...set]));
}
let bookmarks = loadBookmarks();

function shuffle(arr) {
  const a = [...arr];
  for (let i=a.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

async function loadQuestions() {
  const res = await fetch("data/questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("questions.json 読込失敗");
  allQuestions = await res.json();
}

function filterQuestions() {
  const domain = domainSel.value;
  const pool = domain==="all" ? allQuestions : allQuestions.filter(q => q.domain === domain);
  const n = Math.min(Math.max(parseInt(countInput.value||"20",10), 1), pool.length);
  return shuffle(pool).slice(0, n);
}

function startTimer(minutes) {
  stopTimer();
  const now = Date.now();
  examEndTime = now + minutes*60*1000;
  tickTimer();
  examTimer = setInterval(tickTimer, 250);
}
function stopTimer() {
  if (examTimer) { clearInterval(examTimer); examTimer = null; }
  timerSpan.textContent = "";
}
function tickTimer() {
  const remain = Math.max(0, examEndTime - Date.now());
  const m = Math.floor(remain/60000);
  const s = Math.floor((remain%60000)/1000);
  timerSpan.textContent = `残り ${m}:${String(s).padStart(2,"0")}`;
  if (remain <= 0) {
    stopTimer();
    grade();
  }
}

function renderQuiz() {
  quizArea.innerHTML = "";
  quizArea.classList.remove("hidden");
  reviewArea.classList.add("hidden");
  submitBtn.classList.toggle("hidden", revealInstant);
  retryIncorrectBtn.classList.add("hidden");
  scoreSpan.textContent = "";
  progressSpan.textContent = `0 / ${currentSet.length}`;

  currentSet.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.qid = q.id;

    const head = document.createElement("div");
    head.className = "q-header";

    const title = document.createElement("div");
    title.textContent = `Q${idx+1}. ${q.question}`;

    const meta = document.createElement("div");
    const badge1 = document.createElement("span");
    badge1.className = "badge";
    badge1.textContent = q.domain;
    const badge2 = document.createElement("span");
    badge2.className = "badge";
    badge2.textContent = q.difficulty;
    meta.append(badge1, " ", badge2);

    head.append(title, meta);

    const choicesDiv = document.createElement("div");
    q.choices.forEach((choice, ci) => {
      const label = document.createElement("label");
      label.className = "choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `q-${q.id}`;
      input.value = String(ci);
      input.addEventListener("change", () => {
        answers.set(q.id, ci);
        progressSpan.textContent = `${answers.size} / ${currentSet.length}`;

        if (revealInstant) {
          // 即時判定
          [...choicesDiv.querySelectorAll(".choice")].forEach(el => {
            el.classList.remove("correct","wrong");
          });
          if (ci === q.answerIndex) {
            label.classList.add("correct");
          } else {
            label.classList.add("wrong");
            // 正解も薄く表示
            const correctLabel = choicesDiv.querySelectorAll(".choice")[q.answerIndex];
            if (correctLabel) correctLabel.classList.add("correct");
          }
          renderExplain(card, q, ci);
        }
      });

      const text = document.createElement("div");
      text.textContent = choice;

      label.append(input, text);
      choicesDiv.appendChild(label);
    });

    const actions = document.createElement("div");
    actions.className = "actions";

    const showBtn = document.createElement("button");
    showBtn.className = "btn";
    showBtn.textContent = "解説";
    showBtn.addEventListener("click", () => {
      const selected = answers.get(q.id);
      renderExplain(card, q, selected);
    });

    actions.append(bmBtn, showBtn);

    card.append(head, choicesDiv, actions);
    quizArea.appendChild(card);
  });
}

function renderExplain(card, q, selectedIndex) {
  let exp = card.querySelector(".explain");
  if (!exp) {
    exp = document.createElement("div");
    exp.className = "explain";
    card.appendChild(exp);
  }
  const selTxt = (typeof selectedIndex === "number") ? q.choices[selectedIndex] : "未選択";
  exp.innerHTML = ""; // innerHTML使わずテキストで
  const p1 = document.createElement("p");
  p1.textContent = `あなたの選択: ${selTxt}`;
  const p2 = document.createElement("p");
  p2.textContent = `正解: ${q.choices[q.answerIndex]}`;
  const p3 = document.createElement("p");
  p3.textContent = q.explanation;
  exp.append(p1, p2, p3);
}

function start() {
  answers.clear();
  currentSet = filterQuestions();
  revealInstant = (modeSel.value === "practice");

  if (modeSel.value === "exam") {
    const mins = Math.max(parseInt(minutesInput.value||"60",10), 10);
    startTimer(mins);
  } else {
    stopTimer();
  }
  renderQuiz();
}

function grade() {
  // 模擬採点
  let correct = 0;
  currentSet.forEach(q => {
    const chosen = answers.get(q.id);
    const card = quizArea.querySelector(`.card[data-qid="${q.id}"]`);
    if (!card) return;
    const choices = card.querySelectorAll(".choice");
    choices.forEach((el, idx) => {
      el.classList.toggle("correct", idx === q.answerIndex);
      if (typeof chosen === "number" && idx === chosen && chosen !== q.answerIndex) {
        el.classList.add("wrong");
      }
    });
    if (typeof chosen === "number" && chosen === q.answerIndex) correct++;
    renderExplain(card, q, chosen);
  });

  const scorePct = Math.round((correct / currentSet.length) * 100);
  scoreSpan.textContent = `得点: ${correct} / ${currentSet.length} (${scorePct}%)`;
  retryIncorrectBtn.classList.remove("hidden");
}

function retryIncorrect() {
  const wrong = currentSet.filter(q => answers.get(q.id) !== q.answerIndex);
  if (wrong.length === 0) {
    alert("不正解はありません。全問正解です！");
    return;
  }
  currentSet = shuffle(wrong);
  answers.clear();
  revealInstant = (modeSel.value === "practice");
  stopTimer();
  renderQuiz();
  scoreSpan.textContent = "";
}

function resetAll() {
  stopTimer();
  answers.clear();
  currentSet = [];
  quizArea.innerHTML = "";
  reviewArea.innerHTML = "";
  quizArea.classList.add("hidden");
  reviewArea.classList.add("hidden");
  submitBtn.classList.add("hidden");
  retryIncorrectBtn.classList.add("hidden");
  timerSpan.textContent = "";
  progressSpan.textContent = "";
  scoreSpan.textContent = "";
}

async function main() {
  await loadQuestions();
  // 進捗表示更新（練習時でも見えるように）
  document.addEventListener("change", (e) => {
    if (e.target && e.target.name && e.target.name.startsWith("q-")) {
      progressSpan.textContent = `${answers.size} / ${currentSet.length}`;
    }
  });

  startBtn.addEventListener("click", start);
  submitBtn.addEventListener("click", grade);
  retryIncorrectBtn.addEventListener("click", retryIncorrect);
  resetBtn.addEventListener("click", resetAll);

  modeSel.addEventListener("change", () => {
    // 練習モード→即判定、模擬→最後に採点
    if (modeSel.value === "practice") {
      submitBtn.classList.add("hidden");
    } else {
      if (!submitBtn.classList.contains("hidden")) return;
      submitBtn.classList.remove("hidden");
    }
  });

  exportBookmarksBtn.addEventListener("click", () => {
    const data = JSON.stringify([...bookmarks], null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bookmarks.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  importBookmarksBtn.addEventListener("click", () => importBookmarksFile.click());
  importBookmarksFile.addEventListener("change", async () => {
    const file = importBookmarksFile.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const arr = JSON.parse(text);
      bookmarks = new Set(arr);
      saveBookmarks(bookmarks);
      alert("ブックマークを読み込みました。");
    } catch {
      alert("JSONの形式が不正です。");
    }
  });
}

main().catch(err => {
  alert("初期化エラー: " + err.message);
});

