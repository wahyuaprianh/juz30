/**
 * Aplikasi Kuis Tebak Surat & Ayat Juz 30
 * Logika interaksi kuis, pemutar audio murottal per ayat, custom searchable dropdown,
 * validasi input, penilaian skor, dan pengatur tema gelap/terang.
 */

(function () {
  'use strict';

  // Helper selektor elemen
  const $ = (id) => document.getElementById(id);

  /* ==========================================================================
     Theme Manager (Mode Gelap & Terang dengan localStorage dan preferensi OS)
     ========================================================================== */
  const THEME_STORAGE_KEY = 'tafahhum_theme';

  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    const textEl = $('theme-text');
    if (textEl) {
      textEl.textContent = theme === 'dark' ? 'Terang' : 'Gelap';
    }

    const toggleBtn = $('theme-toggle');
    if (toggleBtn) {
      const tooltip = theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap';
      toggleBtn.setAttribute('title', tooltip);
      toggleBtn.setAttribute('aria-label', tooltip);
    }
  }

  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  const themeToggleBtn = $('theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.onclick = function () {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const target = current === 'dark' ? 'light' : 'dark';
      applyTheme(target);
    };
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  /* ==========================================================================
     Verifikasi & Pengolahan Data Al-Qur'an
     ========================================================================== */
  if (typeof QURAN_DATA === 'undefined' || typeof SURAH_NAMES === 'undefined') {
    console.error('Data Al-Qur\'an tidak ditemukan. Pastikan data.js dimuat sebelum app.js.');
    return;
  }

  function normalizeSurahName(text) {
    let t = String(text || '')
      .toLowerCase()
      .replace(/surat|surah|q\.?s\.?/g, '')
      .replace(/[^a-z0-9]/g, '');

    return t.replace(/^(adh|ash|asy|ats|ath|al|an|at|ad|ar|as|az)(?=[a-z]{3,})/, '');
  }

  const surahInfo = {};
  const questionBank = [];
  const textLocationMap = {};
  const allSurahsList = [];

  QURAN_DATA.forEach(function ([surahNum, ayahs]) {
    const meta = SURAH_NAMES[surahNum];
    const officialName = meta ? meta[0] : 'Surat ' + surahNum;
    const aliases = meta ? meta[1] : [];
    const arabicTitle = (typeof ARABIC_SURAH_NAMES !== 'undefined' && ARABIC_SURAH_NAMES[surahNum]) || '';

    const validKeywords = [officialName, ...aliases, String(surahNum)].map(normalizeSurahName);

    const surahObj = {
      num: surahNum,
      name: officialName,
      aliases: aliases,
      arabic: arabicTitle,
      ayatCount: ayahs.length,
      keywords: validKeywords
    };

    surahInfo[surahNum] = surahObj;
    allSurahsList.push(surahObj);

    ayahs.forEach(function (ayahText, idx) {
      const item = {
        surah: surahNum,
        ayah: idx + 1,
        text: ayahText
      };
      questionBank.push(item);

      if (!textLocationMap[ayahText]) {
        textLocationMap[ayahText] = [];
      }
      textLocationMap[ayahText].push(item);
    });
  });

  const totalCountEl = $('cnt');
  if (totalCountEl) {
    totalCountEl.textContent = questionBank.length;
  }

  /* ==========================================================================
     Audio Player (Murottal Misyari Rasyid Al-Afasy via EveryAyah CDN)
     ========================================================================== */
  let activeAudio = null;
  let activeAudioButton = null;

  function pad3(num) {
    return String(num).padStart(3, '0');
  }

  function getAyahAudioUrl(surah, ayah) {
    return 'https://everyayah.com/data/Alafasy_128kbps/' + pad3(surah) + pad3(ayah) + '.mp3';
  }

  function stopAudio() {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }

    if (activeAudioButton) {
      activeAudioButton.classList.remove('playing', 'loading');
      const textEl = activeAudioButton.querySelector('#audio-btn-text');
      if (textEl) textEl.textContent = 'Dengarkan Ayat';
      const iconEl = activeAudioButton.querySelector('#audio-icon');
      if (iconEl) iconEl.hidden = false;
      const wavesEl = activeAudioButton.querySelector('#audio-waves');
      if (wavesEl) wavesEl.hidden = true;
      activeAudioButton = null;
    }
  }

  function playAyahAudio(surah, ayah, buttonEl) {
    // Jika tombol yang sama ditekan saat sedang memutar, lakukan pause/stop
    if (activeAudio && activeAudioButton === buttonEl) {
      stopAudio();
      return;
    }

    stopAudio();

    const audioUrl = getAyahAudioUrl(surah, ayah);
    const audio = new Audio(audioUrl);
    activeAudio = audio;
    activeAudioButton = buttonEl;

    if (buttonEl) {
      buttonEl.classList.add('loading');
      const textEl = buttonEl.querySelector('#audio-btn-text');
      if (textEl) textEl.textContent = 'Memuat audio...';
    }

    audio.addEventListener('playing', function () {
      if (buttonEl) {
        buttonEl.classList.remove('loading');
        buttonEl.classList.add('playing');
        const textEl = buttonEl.querySelector('#audio-btn-text');
        if (textEl) textEl.textContent = 'Memutar...';
        const iconEl = buttonEl.querySelector('#audio-icon');
        if (iconEl) iconEl.hidden = true;
        const wavesEl = buttonEl.querySelector('#audio-waves');
        if (wavesEl) wavesEl.hidden = false;
      }
    });

    audio.addEventListener('ended', function () {
      stopAudio();
    });

    audio.addEventListener('error', function () {
      console.warn('Gagal memuat audio ayat dari EveryAyah CDN.');
      if (buttonEl) {
        const textEl = buttonEl.querySelector('#audio-btn-text');
        if (textEl) textEl.textContent = 'Audio tidak tersedia';
      }
      setTimeout(stopAudio, 1500);
    });

    audio.play().catch(function (err) {
      console.warn('Playback dicegah oleh browser:', err);
      stopAudio();
    });
  }

  // Pasang listener pada tombol audio kuis
  const mainAudioBtn = $('btn-audio');
  if (mainAudioBtn) {
    mainAudioBtn.onclick = function () {
      if (!quizList || !quizList[currentIndex]) return;
      const cur = quizList[currentIndex];
      playAyahAudio(cur.surah, cur.ayah, mainAudioBtn);
    };
  }

  /* ==========================================================================
     Custom Searchable Dropdown untuk Nama Surat
     ========================================================================== */
  const surahDropdown = $('surah-dropdown');
  const surahInput = $('s');
  const surahMenu = $('surah-menu');
  const dropdownToggleBtn = $('dropdown-toggle-btn');
  let highlightedIndex = -1;
  let currentFilteredList = [];

  function isDropdownOpen() {
    return surahDropdown && surahDropdown.classList.contains('open');
  }

  function openDropdown() {
    if (!surahDropdown || !surahMenu) return;
    surahDropdown.classList.add('open');
    surahMenu.hidden = false;
    filterAndRenderDropdown(surahInput.value);
  }

  function closeDropdown() {
    if (!surahDropdown || !surahMenu) return;
    surahDropdown.classList.remove('open');
    surahMenu.hidden = true;
    highlightedIndex = -1;
  }

  function selectSurah(surahObj) {
    surahInput.value = surahObj.name;
    closeDropdown();
    // Otomatis arahkan fokus ke input nomor ayat agar pengguna nyaman mengetik
    const ayahInput = $('a');
    if (ayahInput) {
      ayahInput.focus();
    }
  }

  function filterAndRenderDropdown(query) {
    if (!surahMenu) return;

    const normQuery = normalizeSurahName(query).trim();
    const rawQuery = String(query || '').trim().toLowerCase();

    if (!normQuery && !rawQuery) {
      currentFilteredList = allSurahsList.slice();
    } else {
      currentFilteredList = allSurahsList.filter(function (s) {
        const numMatch = String(s.num).startsWith(rawQuery);
        const nameMatch = s.name.toLowerCase().includes(rawQuery);
        const keywordMatch = s.keywords.some(k => k.includes(normQuery));
        return numMatch || nameMatch || keywordMatch;
      });
    }

    surahMenu.innerHTML = '';
    highlightedIndex = -1;

    if (currentFilteredList.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'dropdown-empty';
      emptyDiv.textContent = 'Surat tidak ditemukan';
      surahMenu.appendChild(emptyDiv);
      return;
    }

    currentFilteredList.forEach(function (s, index) {
      const itemEl = document.createElement('div');
      itemEl.className = 'dropdown-item';
      itemEl.dataset.index = index;

      const leftEl = document.createElement('div');
      leftEl.className = 'dropdown-item-left';

      const numEl = document.createElement('span');
      numEl.className = 'dropdown-item-num';
      numEl.textContent = s.num;

      const textWrapper = document.createElement('div');
      textWrapper.className = 'dropdown-item-text';

      const nameEl = document.createElement('div');
      nameEl.className = 'dropdown-item-name';
      nameEl.textContent = s.name;

      const metaEl = document.createElement('div');
      metaEl.className = 'dropdown-item-meta';
      metaEl.textContent = s.ayatCount + ' ayat';

      textWrapper.appendChild(nameEl);
      textWrapper.appendChild(metaEl);

      leftEl.appendChild(numEl);
      leftEl.appendChild(textWrapper);

      const arEl = document.createElement('div');
      arEl.className = 'dropdown-item-ar';
      arEl.textContent = s.arabic;

      itemEl.appendChild(leftEl);
      itemEl.appendChild(arEl);

      itemEl.onmousedown = function (e) {
        e.preventDefault(); // Mencegah input kehilangan fokus terlalu dini
        selectSurah(s);
      };

      surahMenu.appendChild(itemEl);
    });
  }

  if (surahInput) {
    surahInput.addEventListener('focus', function () {
      openDropdown();
    });

    surahInput.addEventListener('input', function () {
      openDropdown();
    });

    surahInput.addEventListener('keydown', function (e) {
      if (!isDropdownOpen()) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          openDropdown();
          e.preventDefault();
        }
        return;
      }

      const items = surahMenu.querySelectorAll('.dropdown-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = (highlightedIndex + 1) % items.length;
        updateHighlightedItem(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
        updateHighlightedItem(items);
      } else if (e.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < currentFilteredList.length) {
          e.preventDefault();
          selectSurah(currentFilteredList[highlightedIndex]);
        }
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });
  }

  function updateHighlightedItem(items) {
    items.forEach((el, idx) => {
      el.classList.toggle('active', idx === highlightedIndex);
      if (idx === highlightedIndex) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  if (dropdownToggleBtn) {
    dropdownToggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isDropdownOpen()) {
        closeDropdown();
      } else {
        surahInput.focus();
        openDropdown();
      }
    });
  }

  document.addEventListener('click', function (e) {
    if (surahDropdown && !surahDropdown.contains(e.target)) {
      closeDropdown();
    }
  });

  /* ==========================================================================
     State & Alur Kuis
     ========================================================================== */
  const MIN_QUESTIONS = 20;
  const MAX_QUESTIONS = 50;
  let totalQuestions = 20;

  let quizList = [];
  let currentIndex = 0;
  let currentScore = 0;
  let questionsAnswered = 0;
  let incorrectQuestions = [];
  let isAnswerSubmitted = false;

  function switchView(viewId) {
    stopAudio();
    ['home', 'play', 'res'].forEach(function (id) {
      const el = $(id);
      if (el) el.hidden = (id !== viewId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateQuestionCount(value) {
    totalQuestions = Math.max(MIN_QUESTIONS, Math.min(MAX_QUESTIONS, value));
    $('n').textContent = totalQuestions;

    const chipContainer = $('chips');
    if (chipContainer) {
      Array.from(chipContainer.children).forEach(function (chip) {
        chip.classList.toggle('on', Number(chip.dataset.value) === totalQuestions);
      });
    }
  }

  const chipContainer = $('chips');
  if (chipContainer) {
    chipContainer.innerHTML = '';
    [20, 30, 40, 50].forEach(function (count) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (count === totalQuestions ? ' on' : '');
      btn.textContent = count;
      btn.dataset.value = count;
      btn.onclick = function () { updateQuestionCount(count); };
      chipContainer.appendChild(btn);
    });
  }

  $('minus').onclick = function () { updateQuestionCount(totalQuestions - 1); };
  $('plus').onclick = function () { updateQuestionCount(totalQuestions + 1); };
  updateQuestionCount(20);

  function startQuiz() {
    stopAudio();
    const pool = questionBank.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = pool[i];
      pool[i] = pool[j];
      pool[j] = temp;
    }

    quizList = pool.slice(0, totalQuestions);
    currentIndex = 0;
    currentScore = 0;
    questionsAnswered = 0;
    incorrectQuestions = [];

    switchView('play');
    renderQuestion();
  }

  function renderQuestion() {
    stopAudio();
    closeDropdown();

    const currentItem = quizList[currentIndex];
    $('no').innerHTML = 'Soal <b>' + (currentIndex + 1) + '</b> dari ' + totalQuestions;
    $('sc').innerHTML = 'Skor <b>' + currentScore + '</b>';
    $('bar').style.width = ((currentIndex / totalQuestions) * 100) + '%';
    $('ayat').textContent = currentItem.text;

    ['s', 'a'].forEach(function (fieldId) {
      const field = $(fieldId);
      field.value = '';
      field.readOnly = false;
    });

    $('fb').hidden = true;
    $('next').hidden = true;
    $('cek').hidden = false;
    $('skip').hidden = false;

    isAnswerSubmitted = false;
    $('s').focus();
  }

  function evaluateAnswer(item, inputSurah, inputAyah) {
    let bestResult = null;
    const normInput = normalizeSurahName(inputSurah);
    const cleanRaw = inputSurah.trim();
    const parsedAyah = parseInt(inputAyah, 10);

    const locations = textLocationMap[item.text] || [item];

    locations.forEach(function (loc) {
      const isSurahNumber = /^\d+$/.test(cleanRaw) && Number(cleanRaw) === loc.surah;
      const isSurahName = normInput !== '' && surahInfo[loc.surah].keywords.includes(normInput);
      const isSurahCorrect = isSurahNumber || isSurahName;

      const isAyahCorrect = parsedAyah === loc.ayah;
      const points = (isSurahCorrect ? 1 : 0) + (isAyahCorrect ? 1 : 0);

      if (!bestResult || points > bestResult.points) {
        bestResult = {
          points: points,
          isSurahCorrect: isSurahCorrect,
          isAyahCorrect: isAyahCorrect
        };
      }
    });

    return bestResult;
  }

  function submitAnswer(isRevealed) {
    closeDropdown();
    const currentItem = quizList[currentIndex];
    const surahValue = $('s').value;
    const ayahValue = $('a').value;

    isAnswerSubmitted = true;
    questionsAnswered++;

    let result;
    if (isRevealed) {
      result = { points: 0, isSurahCorrect: false, isAyahCorrect: false };
    } else {
      result = evaluateAnswer(currentItem, surahValue, ayahValue);
      currentScore += result.points;
    }

    const locations = textLocationMap[currentItem.text] || [currentItem];
    const answerString = locations
      .map(loc => 'QS. ' + surahInfo[loc.surah].name + ' ayat ' + loc.ayah)
      .join('  atau  ');

    const feedbackBox = $('fb');
    feedbackBox.innerHTML = '';

    if (!isRevealed) {
      const tagContainer = document.createElement('div');
      tagContainer.className = 'tags';

      [
        [result.isSurahCorrect, 'Surat'],
        [result.isAyahCorrect, 'Ayat']
      ].forEach(function ([isCorrect, label]) {
        const tag = document.createElement('span');
        tag.className = 'tag ' + (isCorrect ? 'ok' : 'no');
        tag.textContent = (isCorrect ? '✓ ' : '✕ ') + label + (isCorrect ? ' benar' : ' belum tepat');
        tagContainer.appendChild(tag);
      });

      feedbackBox.appendChild(tagContainer);
    }

    const answerDiv = document.createElement('div');
    answerDiv.className = 'fb-answer';
    answerDiv.textContent = 'Jawaban: ' + answerString;
    feedbackBox.appendChild(answerDiv);

    feedbackBox.hidden = false;

    if (result.points < 2) {
      incorrectQuestions.push({
        item: currentItem,
        answer: answerString,
        userAnswer: isRevealed
          ? 'Dilewati'
          : ((surahValue.trim() || '—') + ' · ayat ' + (ayahValue.trim() || '—'))
      });
    }

    $('s').readOnly = true;
    $('a').readOnly = true;
    $('sc').innerHTML = 'Skor <b>' + currentScore + '</b>';
    $('bar').style.width = (((currentIndex + 1) / totalQuestions) * 100) + '%';

    $('cek').hidden = true;
    $('skip').hidden = true;
    $('next').hidden = false;
    $('next').textContent = (currentIndex + 1 < totalQuestions) ? 'Soal berikutnya' : 'Lihat hasil';
    $('next').focus();
  }

  function finishQuiz() {
    stopAudio();
    if (questionsAnswered === 0) {
      switchView('home');
      return;
    }

    const maxScore = questionsAnswered * 2;
    const percentage = Math.round((currentScore / maxScore) * 100);

    $('big').textContent = currentScore + ' / ' + maxScore;
    $('pct').textContent = percentage + '% · ' + questionsAnswered + ' soal dijawab';

    let motivation = '';
    if (percentage >= 85) {
      motivation = 'Masya Allah, hafalan dan pengenalan suratmu luar biasa kuat!';
    } else if (percentage >= 60) {
      motivation = 'Alhamdulillah bagus! Terus sering diulang agar makin mutqin.';
    } else {
      motivation = 'Tetap semangat! Perbanyak tilawah dan muroja\'ah agar semakin lancar.';
    }
    $('msg').textContent = motivation;

    // Render daftar review soal yang salah beserta tombol audio per ayat
    const reviewList = $('rl');
    reviewList.innerHTML = '';
    incorrectQuestions.forEach(function (err) {
      const itemRow = document.createElement('div');
      itemRow.className = 'rv';

      const topRow = document.createElement('div');
      topRow.className = 'rv-top';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'mini-audio-btn';
      playBtn.title = 'Dengarkan murottal ayat ini';
      playBtn.setAttribute('aria-label', 'Dengarkan murottal ayat ini');
      playBtn.innerHTML = '🔊';
      playBtn.onclick = function () {
        playAyahAudio(err.item.surah, err.item.ayah, playBtn);
      };

      const arabicDiv = document.createElement('div');
      arabicDiv.className = 'ar';
      arabicDiv.textContent = err.item.text;

      topRow.appendChild(playBtn);
      topRow.appendChild(arabicDiv);

      const ansDiv = document.createElement('div');
      ansDiv.className = 'rv-ans';
      ansDiv.textContent = err.answer;

      const userSmall = document.createElement('small');
      userSmall.textContent = 'Jawaban kamu: ' + err.userAnswer;

      itemRow.appendChild(topRow);
      itemRow.appendChild(ansDiv);
      itemRow.appendChild(userSmall);
      reviewList.appendChild(itemRow);
    });

    const reviewDetails = $('rev');
    reviewDetails.hidden = (incorrectQuestions.length === 0);
    $('revt').textContent = 'Perlu diulang (' + incorrectQuestions.length + ' ayat)';
    reviewDetails.open = false;

    switchView('res');
  }

  // Event Handlers Tombol
  $('start').onclick = startQuiz;
  $('again').onclick = startQuiz;
  $('back').onclick = function () { switchView('home'); };
  $('cek').onclick = function () { if (!isAnswerSubmitted) submitAnswer(false); };
  $('skip').onclick = function () { if (!isAnswerSubmitted) submitAnswer(true); };
  $('stop').onclick = finishQuiz;
  $('next').onclick = function () {
    currentIndex++;
    if (currentIndex >= totalQuestions) {
      finishQuiz();
    } else {
      renderQuestion();
    }
  };

  // Navigasi Keyboard (Enter)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing || e.target.tagName === 'BUTTON') return;

    // Jika dropdown sedang aktif dan ada item yang di-highlight, biarkan dropdown handler menanganinya
    if (isDropdownOpen() && highlightedIndex >= 0) return;

    if (!$('home').hidden) {
      startQuiz();
      return;
    }

    if (!$('play').hidden) {
      if (isAnswerSubmitted) {
        $('next').click();
        return;
      }

      if (e.target.id === 's' && $('s').value.trim() && !$('a').value.trim()) {
        closeDropdown();
        $('a').focus();
        return;
      }

      $('cek').click();
    }
  });

})();
