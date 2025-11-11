let questions = [];
let currentIndex = 0;
let selectedAnswers = {};
let mode = "practice";
let filteredQuestions = [];
let timerInterval = null;
let timeLeft = 0;

// HTML要素
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const submitBtn = document.getElementById("submitBtn");
const retryIncorrectBtn = document.getElementById("retryIncorrectBtn");
const quizArea = document.getElementById("quizArea");
const reviewArea = document.getElementById("reviewArea");
const modeSelect = document.getElementById("mode");
const domainSelect = document.getElementById("domain");
const countInput = document.getElementById("count");
const minutesInput = document.getElementById("minutes");
const timerDisplay = document.getElementById("timer");
const progressDisplay = document.getElementById("progress");
const scoreDisplay = document.getElementById("score");

// JSON読込
fetch("data/questions.json")
  .then((res) => res.json())
  .then((data) => {
    questions = data;
  })
  .catch((err) => console.error("問題データの読み込みに失敗:", err));

// クイズ開始
startBtn.addEventListener("click", () => {
  mode = modeSelect.value;
  const domain = domainSelect.value;
  const count = parseInt(countInput.value) || 10;

  filteredQuestions =
    domain === "all" ? [...questions] : questions.filter((q) => q.domain === domain);

  shuffle(filteredQuestions);
  filteredQuestions = filteredQuestions.slice(0, count);
  currentIndex = 0;
  selectedAnswers = {};
  showQuestion();

  quizArea.classList.remove("hidden");
  reviewArea.classList.add("hidden");
  retryIncorrectBtn.classList.add("hidden");
  submitBtn.classList.toggle("hidden", mode === "practice");
  scoreDisplay.textContent = "";

  if (mode === "exam") startTimer();
});

// タイマー開始（模擬試験モード用）
function startTimer() {
  clearInterval(timerInterval);
  timeLeft = parseInt(minutesInput.value) * 60;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert("制限時間終了です。採点します。");
      gradeExam();
    }
  }, 1000);
}

function updateTimerDisplay() {
  if (mode !== "exam") {
    timerDisplay.textContent = "";
    return;
  }
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  timerDisplay.textContent = `残り時間: ${m}:${s.toString().padStart(2, "0")}`;
}

// 問題表示
function showQuestion() {
  const q = filteredQuestions[currentIndex];
  progressDisplay.textContent = `問題 ${currentIndex + 1} / ${filteredQuestions.length}`;
  quizArea.innerHTML = `
    <div class="question-card">
      <p class="question-text">${q.id}. ${q.question}</p>
      <ul class="choices">
        ${q.choices
          .map(
            (choice, i) => `
            <li>
              <label>
                <input type="radio" name="q${q.id}" value="${i}" ${
              selectedAnswers[q.id] == i ? "checked" : ""
            }>
                ${choice}
              </label>
            </li>`
          )
          .join("")}
      </ul>
      <div class="nav-buttons">
        <button id="prevBtn" ${currentIndex === 0 ? "disabled" : ""}>前へ</button>
        <button id="nextBtn">${
          currentIndex === filteredQuestions.length - 1 ? "終了" : "次へ"
        }</button>
      </div>
    </div>
  `;

  document.querySelectorAll(`input[name="q${q.id}"]`).forEach((radio) => {
    radio.addEventListener("change", (e) => {
      selectedAnswers[q.id] = parseInt(e.target.value);
      if (mode === "practice") checkAnswer(q);
    });
  });

  document.getElementById("prevBtn").onclick = prevQuestion;
  document.getElementById("nextBtn").onclick = nextQuestion;
}

function checkAnswer(q) {
  const selected = selectedAnswers[q.id];
  const correct = q.answerIndex;
  const explanation = q.explanation ? `<p class="explanation">${q.explanation}</p>` : "";
  if (selected === correct) {
    quizArea.querySelector(".question-card").insertAdjacentHTML(
      "beforeend",
      `<div class="feedback correct">正解！${explanation}</div>`
    );
  } else {
    quizArea.querySelector(".question-card").insertAdjacentHTML(
      "beforeend",
      `<div class="feedback incorrect">不正解。正解は「${q.choices[correct]}」${explanation}</div>`
    );
  }
}

function nextQuestion() {
  saveSelection();
  if (currentIndex < filteredQuestions.length - 1) {
    currentIndex++;
    showQuestion();
  } else if (mode === "exam") {
    gradeExam();
  }
}

function prevQuestion() {
  saveSelection();
  if (currentIndex > 0) {
    currentIndex--;
    showQuestion();
  }
}

function saveSelection() {
  const q = filteredQuestions[currentIndex];
  const selected = document.querySelector(`input[name="q${q.id}"]:checked`);
  if (selected) selectedAnswers[q.id] = parseInt(selected.value);
}

// 採点
submitBtn.addEventListener("click", gradeExam);

function gradeExam() {
  clearInterval(timerInterval);
  const total = filteredQuestions.length;
  let correctCount = 0;
  const incorrectQuestions = [];

  filteredQuestions.forEach((q) => {
    if (selectedAnswers[q.id] === q.answerIndex) correctCount++;
    else incorrectQuestions.push(q);
  });

  const score = Math.round((correctCount / total) * 100);
  scoreDisplay.textContent = `スコア: ${correctCount}/${total} (${score}%)`;

  reviewArea.innerHTML = `
    <h2>結果一覧</h2>
    <ul class="review-list">
      ${filteredQuestions
        .map((q) => {
          const userAns = selectedAnswers[q.id];
          const correct = q.answerIndex;
          const correctText = q.choices[correct];
          const isCorrect = userAns === correct;
          return `
            <li class="${isCorrect ? "correct" : "incorrect"}">
              <p><strong>Q${q.id}:</strong> ${q.question}</p>
              <p>あなたの回答: ${
                userAns != null ? q.choices[userAns] : "未回答"
              }</p>
              <p>正解: ${correctText}</p>
              <p class="explanation">${q.explanation || ""}</p>
            </li>`;
        })
        .join("")}
    </ul>
  `;

  quizArea.classList.add("hidden");
  reviewArea.classList.remove("hidden");
  retryIncorrectBtn.classList.toggle("hidden", incorrectQuestions.length === 0);

  retryIncorrectBtn.onclick = () => retryIncorrect(incorrectQuestions);
}

function retryIncorrect(incorrectQuestions) {
  filteredQuestions = incorrectQuestions;
  shuffle(filteredQuestions);
  selectedAnswers = {};
  currentIndex = 0;
  showQuestion();
  quizArea.classList.remove("hidden");
  reviewArea.classList.add("hidden");
  retryIncorrectBtn.classList.add("hidden");
}

// リセット
resetBtn.addEventListener("click", () => {
  clearInterval(timerInterval);
  quizArea.innerHTML = "";
  reviewArea.innerHTML = "";
  quizArea.classList.add("hidden");
  reviewArea.classList.add("hidden");
  scoreDisplay.textContent = "";
  retryIncorrectBtn.classList.add("hidden");
  submitBtn.classList.add("hidden");
  timerDisplay.textContent = "";
});

// ユーティリティ
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
