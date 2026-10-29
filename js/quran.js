/*
 * منصة البيان — قارئ المصحف المحلي
 * مصدر النص: Tanzil Uthmani Text. تُقرأ الآيات كما هي من data/quran-uthmani.txt.
 */
(() => {
  'use strict';

  const QURAN_TEXT_URL = 'data/quran-uthmani.txt';
  const QURAN_METADATA_URL = 'data/quran-metadata.xml';
  const EXPECTED_VERSE_COUNT = 6236;
  const EXPECTED_SURA_COUNT = 114;
  const DAILY_SURAH_IDS = [36, 56, 55, 44, 67, 2, 18, 62, 76, 53];
  const BOOKMARK_KEY = 'bayan_quran_manual_bookmark_v2';

  const state = {
    verses: [],
    suras: [],
    selectedSura: 1,
    requestedAyah: null,
    hasExplicitLocation: false
  };

  const elements = {};

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function arabicNumber(value) {
    return Number(value).toLocaleString('ar-EG');
  }

  function getSura(id) {
    return state.suras.find((sura) => sura.id === id);
  }

  function parseRequestedLocation() {
    const params = new URLSearchParams(window.location.search);
    const surah = Number(params.get('surah'));
    const ayah = Number(params.get('ayah'));
    if (Number.isInteger(surah) && surah >= 1 && surah <= EXPECTED_SURA_COUNT) {
      state.selectedSura = surah;
      state.hasExplicitLocation = true;
      if (Number.isInteger(ayah) && ayah > 0) state.requestedAyah = ayah;
    }
  }

  function parseQuranText(rawText) {
    const verses = rawText.split(/\r?\n/).reduce((all, line) => {
      if (!/^\d+\|\d+\|/.test(line)) return all;
      const firstSeparator = line.indexOf('|');
      const secondSeparator = line.indexOf('|', firstSeparator + 1);
      const surah = Number(line.slice(0, firstSeparator));
      const ayah = Number(line.slice(firstSeparator + 1, secondSeparator));
      const text = line.slice(secondSeparator + 1);
      if (!Number.isInteger(surah) || !Number.isInteger(ayah) || !text) return all;
      all.push({ surah, ayah, text });
      return all;
    }, []);

    if (verses.length !== EXPECTED_VERSE_COUNT) {
      throw new Error(`فشل التحقق من عدد الآيات: وُجد ${verses.length} بدلًا من ${EXPECTED_VERSE_COUNT}.`);
    }
    return verses;
  }

  function parseMetadata(xmlText) {
    const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('تعذر قراءة بيانات السور المحلية.');
    const suras = [...xml.querySelectorAll('sura[index]')].map((node) => ({
      id: Number(node.getAttribute('index')),
      name: node.getAttribute('name'),
      ayas: Number(node.getAttribute('ayas')),
      type: node.getAttribute('type')
    }));

    if (suras.length !== EXPECTED_SURA_COUNT || suras.some((sura) => !sura.name || !sura.ayas)) {
      throw new Error('فشل التحقق من بيانات السور المحلية.');
    }
    return suras;
  }

  function setStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle('error', isError);
  }

  function readBookmark() {
    try {
      const bookmark = JSON.parse(localStorage.getItem(BOOKMARK_KEY));
      const sura = bookmark && getSura(Number(bookmark.surah));
      const ayah = Number(bookmark && bookmark.ayah);
      if (!sura || !Number.isInteger(ayah) || ayah < 1 || ayah > sura.ayas) return null;
      return { surah: sura.id, ayah };
    } catch (_) {
      return null;
    }
  }

  function writeBookmark(surah, ayah) {
    const sura = getSura(surah);
    if (!sura || !Number.isInteger(ayah) || ayah < 1 || ayah > sura.ayas) return null;
    const bookmark = { surah, ayah, savedAt: Date.now() };
    try {
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark));
      return bookmark;
    } catch (_) {
      return null;
    }
  }

  function describeBookmark(bookmark) {
    const sura = bookmark && getSura(bookmark.surah);
    return sura ? `سورة ${sura.name} — الآية ${arabicNumber(bookmark.ayah)}` : '';
  }

  function renderBookmarkPanel(message) {
    const bookmark = readBookmark();
    if (!bookmark) {
      elements.bookmarkMessage.textContent = message || 'ضعي علامة عند الآية التي توقفتِ عندها، لتعودي إليها عند فتح المصحف.';
      elements.resumeButton.hidden = true;
      return;
    }
    const description = describeBookmark(bookmark);
    elements.bookmarkMessage.textContent = message || `علامتك المحفوظة: ${description}`;
    elements.resumeButton.hidden = false;
    elements.resumeButton.textContent = `العودة إلى ${description}`;
  }

  function setSelectedSura(id, { scroll = true } = {}) {
    if (!getSura(id)) return;
    state.selectedSura = id;
    state.requestedAyah = null;
    elements.select.value = String(id);
    renderReader();
    if (scroll) document.getElementById('quran-reader').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resumeBookmark() {
    const bookmark = readBookmark();
    if (!bookmark) return;
    state.selectedSura = bookmark.surah;
    state.requestedAyah = bookmark.ayah;
    elements.select.value = String(bookmark.surah);
    renderReader();
  }

  function saveBookmarkAt(surah, ayah) {
    const bookmark = writeBookmark(surah, ayah);
    if (!bookmark) return;

    document.querySelectorAll('.quran-ayah.is-bookmarked').forEach((node) => node.classList.remove('is-bookmarked'));
    document.querySelectorAll('.quran-ayah-bookmark.is-active').forEach((node) => {
      node.classList.remove('is-active');
      node.setAttribute('aria-pressed', 'false');
      node.title = node.dataset.defaultTitle || 'وضع علامة مرجعية عند هذه الآية';
    });

    const target = document.getElementById(`ayah-${surah}-${ayah}`);
    if (target) {
      target.classList.add('is-bookmarked');
      const button = target.querySelector('.quran-ayah-bookmark');
      if (button) {
        button.classList.add('is-active');
        button.setAttribute('aria-pressed', 'true');
        button.title = 'هذه هي علامتك المرجعية';
      }
    }
    renderBookmarkPanel(`تم وضع علامة مرجعية عند ${describeBookmark(bookmark)}.`);
  }

  function populateSuraSelect() {
    elements.select.replaceChildren();
    state.suras.forEach((sura) => {
      const option = document.createElement('option');
      option.value = String(sura.id);
      option.textContent = `${arabicNumber(sura.id)} — سورة ${sura.name} (${arabicNumber(sura.ayas)} آية)`;
      elements.select.appendChild(option);
    });
    elements.select.value = String(state.selectedSura);
  }

  function renderDailyShortcuts() {
    elements.shortcuts.replaceChildren();
    DAILY_SURAH_IDS.forEach((id) => {
      const sura = getSura(id);
      if (!sura) return;
      const button = element('button', 'quran-shortcut', `سورة ${sura.name}`);
      button.type = 'button';
      button.addEventListener('click', () => setSelectedSura(id));
      elements.shortcuts.appendChild(button);
    });
  }

  function renderSearchResults(query) {
    elements.searchResults.replaceChildren();
    const normalized = query.trim();
    if (!normalized) return;
    const matches = state.suras.filter((sura) => sura.name.includes(normalized)).slice(0, 12);

    if (!matches.length) {
      elements.searchResults.appendChild(element('p', 'quran-no-results', 'لم تُعثر سورة بهذا الاسم.'));
      return;
    }

    matches.forEach((sura) => {
      const button = element('button', 'quran-search-result', `${arabicNumber(sura.id)} — سورة ${sura.name}`);
      button.type = 'button';
      button.addEventListener('click', () => {
        elements.search.value = '';
        elements.searchResults.replaceChildren();
        setSelectedSura(sura.id);
      });
      elements.searchResults.appendChild(button);
    });
  }

  function scrollToRequestedAyah() {
    if (!state.requestedAyah) return;
    const target = document.getElementById(`ayah-${state.selectedSura}-${state.requestedAyah}`);
    if (target) window.setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  function renderReader() {
    const sura = getSura(state.selectedSura);
    const verses = state.verses.filter((verse) => verse.surah === state.selectedSura);
    const activeBookmark = readBookmark();
    elements.reader.replaceChildren();

    if (!sura || verses.length !== sura.ayas) {
      setStatus('تعذر فتح السورة؛ لم يكتمل التحقق من الملف المحلي.', true);
      return;
    }

    const card = element('article', 'quran-reading-card');
    const heading = element('header', 'quran-reading-header');
    heading.appendChild(element('span', 'quran-sura-index', `السورة ${arabicNumber(sura.id)}`));
    heading.appendChild(element('h2', '', `سورة ${sura.name}`));
    heading.appendChild(element('p', '', `${arabicNumber(sura.ayas)} آية — ${sura.type === 'Medinan' ? 'مدنية' : 'مكية'}`));
    heading.appendChild(element('p', 'quran-bookmark-hint', 'اضغطي على 🔖 بجانب الآية التي تريدين العودة إليها.'));
    card.appendChild(heading);

    const versesWrap = element('div', 'quran-verses');
    verses.forEach((verse) => {
      const isBookmarked = activeBookmark && activeBookmark.surah === verse.surah && activeBookmark.ayah === verse.ayah;
      const ayah = element('p', `quran-ayah${isBookmarked ? ' is-bookmarked' : ''}`);
      ayah.id = `ayah-${verse.surah}-${verse.ayah}`;
      if (state.requestedAyah === verse.ayah) ayah.classList.add('quran-ayah-target');

      const text = element('span', 'quran-ayah-text', verse.text);
      const number = element('span', 'quran-ayah-number', `﴿${arabicNumber(verse.ayah)}﴾`);
      const bookmarkButton = element('button', `quran-ayah-bookmark${isBookmarked ? ' is-active' : ''}`, '🔖');
      const bookmarkLabel = isBookmarked ? 'هذه هي علامتك المرجعية' : `وضع علامة مرجعية عند الآية ${arabicNumber(verse.ayah)}`;
      bookmarkButton.type = 'button';
      bookmarkButton.dataset.defaultTitle = `وضع علامة مرجعية عند هذه الآية`;
      bookmarkButton.title = bookmarkLabel;
      bookmarkButton.setAttribute('aria-label', bookmarkLabel);
      bookmarkButton.setAttribute('aria-pressed', String(Boolean(isBookmarked)));
      bookmarkButton.addEventListener('click', () => saveBookmarkAt(verse.surah, verse.ayah));
      ayah.append(text, number, bookmarkButton);
      versesWrap.appendChild(ayah);
    });
    card.appendChild(versesWrap);

    const source = element('p', 'quran-reader-source');
    source.textContent = 'النص العثماني كما ورد في ملف Tanzil المحلي، دون توليد أو تعديل.';
    card.appendChild(source);
    elements.reader.appendChild(card);
    scrollToRequestedAyah();
    setStatus(`تم التحقق من ${arabicNumber(EXPECTED_VERSE_COUNT)} آية و${arabicNumber(EXPECTED_SURA_COUNT)} سورة محليًا.`);
  }

  async function initializeReader() {
    try {
      const [textResponse, metadataResponse] = await Promise.all([
        fetch(QURAN_TEXT_URL, { cache: 'no-store' }),
        fetch(QURAN_METADATA_URL, { cache: 'no-store' })
      ]);
      if (!textResponse.ok || !metadataResponse.ok) throw new Error('تعذر فتح ملف المصحف المحلي.');
      const [rawText, metadataText] = await Promise.all([textResponse.text(), metadataResponse.text()]);
      state.verses = parseQuranText(rawText);
      state.suras = parseMetadata(metadataText);

      if (!state.hasExplicitLocation) {
        const bookmark = readBookmark();
        if (bookmark) {
          state.selectedSura = bookmark.surah;
          state.requestedAyah = bookmark.ayah;
        }
      }

      populateSuraSelect();
      renderDailyShortcuts();
      renderBookmarkPanel();
      renderReader();
    } catch (error) {
      console.error('Quran reader error:', error);
      setStatus('تعذر تحميل المصحف المحلي. تأكدي من فتح التطبيق مرة واحدة مع الإنترنت حتى تُحفظ كل الملفات.', true);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    elements.select = document.getElementById('quran-sura-select');
    elements.search = document.getElementById('quran-sura-search');
    elements.searchResults = document.getElementById('quran-search-results');
    elements.shortcuts = document.getElementById('quran-daily-shortcuts');
    elements.status = document.getElementById('quran-reader-status');
    elements.reader = document.getElementById('quran-reader');
    elements.bookmarkMessage = document.getElementById('quran-bookmark-message');
    elements.resumeButton = document.getElementById('quran-resume-button');
    parseRequestedLocation();

    elements.select.addEventListener('change', () => setSelectedSura(Number(elements.select.value), { scroll: false }));
    elements.search.addEventListener('input', () => renderSearchResults(elements.search.value));
    elements.resumeButton.addEventListener('click', resumeBookmark);
    initializeReader();
  });
})();
