/**
 * App - Main UI and State Controller for Hafalan Al-Qur'an Juz 30
 */
class HafalanApp {
  constructor() {
    this.surahs = [];
    this.filteredSurahs = [];
    this.currentFilter = 'all'; // 'all' | 'memorizing' | 'memorized' | 'mutqin' | 'none'
    this.searchQuery = '';

    // Active Surah & Verses selection for practice
    this.selectedSurah = null;
    this.surahVerses = [];
    this.selectedVerseNumbers = []; // Set of verse numbers, e.g. [1, 2, 3]
    this.blindMode = false;
    this._activeRenderedVerseKey = null;
    this._activeRenderedRepeat = null;

    // Active Juz selection for practice (Juz 1 - 30)
    this.selectedJuz = parseInt(localStorage.getItem('satujuz_selected_juz') || '30', 10);
    this.allSurahs = window.quranApi ? window.quranApi.getAllSurahs() : [];

    this.currentTab = 'player'; // 'player' | 'setoran' | 'progress' | 'history' | 'settings'
    this.currentWeekOffset = 0; // 0 = current week, -1 = last week, +1 = next week
    this.selectedStatsJuz = parseInt(localStorage.getItem('satujuz_stats_juz') || '30', 10);

    this.init();
  }

  async init() {
    this._bindEvents();
    this._setupProfileCallbacks();
    this._updateHeaderProfileUI();
    this._setupAudioCallbacks();
    this.syncRepeatSlider(1);
    window.quranPlayer.setTargetRepeats(1);

    // Populate Player Juz dropdown (Juz 1-30)
    this._populatePlayerJuzSelect();

    // Populate Stats Juz dropdown (Juz 1-30)
    this._populateStatsJuzSelect();

    // Load surahs
    await this.loadSurahs();
    this.renderSurahList();
    this.updateStatsUI();
    this.renderWeeklyGrid();
    this.renderProgressSuratTable();
    this.renderHistoryChecklist();
    this.renderHistoryTimeline();
    this._populateSetoranPage();

    // Default surah dropdown according to selected Juz
    this._populatePlayerSurahSelect(this.selectedJuz);

    // Register service worker if available
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(e => console.log('SW registration note:', e));
    }
  }

  async loadSurahs() {
    this.allSurahs = window.quranApi ? window.quranApi.getAllSurahs() : [];
    this.surahs = await window.quranApi.getJuz30Surahs();
    this.filteredSurahs = [...this.surahs];
    this._populatePlayerSurahSelect(this.selectedJuz);
    this._populateSetoranPage();
  }

  getAllSurahsList() {
    if (this.allSurahs && this.allSurahs.length > 0) return this.allSurahs;
    if (window.quranApi && typeof window.quranApi.getAllSurahs === 'function') {
      const apiSurahs = window.quranApi.getAllSurahs();
      if (apiSurahs && apiSurahs.length > 0) {
        this.allSurahs = apiSurahs;
        return apiSurahs;
      }
    }
    if (window.ALL_SURAHS && Array.isArray(window.ALL_SURAHS) && window.ALL_SURAHS.length > 0) {
      this.allSurahs = window.ALL_SURAHS;
      return window.ALL_SURAHS;
    }
    return this.surahs || [];
  }

  _bindEvents() {
    // Tab Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Device Shell Toggle (Phone Frame vs Full Width)
    const toggleFrameBtn = document.getElementById('btn-toggle-frame');
    if (toggleFrameBtn) {
      toggleFrameBtn.addEventListener('click', () => {
        const viewport = document.getElementById('app-viewport');
        viewport.classList.toggle('full-width');
        const isFull = viewport.classList.contains('full-width');
        toggleFrameBtn.title = isFull ? 'Ganti ke Tampilan Ponsel' : 'Ganti ke Tampilan Lebar';
      });
    }

    // Search Input
    const searchInput = document.getElementById('surah-search');
    const clearBtn = document.getElementById('search-clear');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        if (clearBtn) {
          clearBtn.style.display = this.searchQuery ? 'block' : 'none';
        }
        this.filterAndRenderSurahs();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        clearBtn.style.display = 'none';
        this.filterAndRenderSurahs();
      });
    }

    // Filter Chips (Synchronized across tabs)
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const filterVal = chip.dataset.filter;
        this.currentFilter = filterVal;
        document.querySelectorAll('.filter-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.filter === filterVal);
        });
        this.filterAndRenderSurahs();
      });
    });

    // Surah Card Click to Open Detail Sheet
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.surah-card[data-surah-id]');
      if (card) {
        if (e.target.closest('select') || e.target.closest('button')) return;
        const surahId = parseInt(card.dataset.surahId, 10);
        if (surahId) {
          this.openSurahDetailSheet(surahId);
        }
      }
    });

    // Close Detail Sheet Button
    const closeSheetBtn = document.getElementById('btn-close-sheet');
    if (closeSheetBtn) {
      closeSheetBtn.addEventListener('click', () => {
        document.getElementById('surah-detail-sheet').classList.remove('active');
      });
    }

    // Detail Sheet Start Practice Button
    const startPracticeBtn = document.getElementById('btn-dock-start');
    if (startPracticeBtn) {
      startPracticeBtn.addEventListener('click', () => {
        this.startSessionFromSheet();
      });
    }

    // Blind mode toggle
    const blindToggleBtn = document.getElementById('btn-toggle-blind');
    if (blindToggleBtn) {
      blindToggleBtn.addEventListener('click', () => {
        this.blindMode = !this.blindMode;
        blindToggleBtn.classList.toggle('active', this.blindMode);
        document.querySelectorAll('.arabic-text').forEach(el => {
          el.classList.toggle('blurred', this.blindMode);
        });
        this.showToast(this.blindMode ? 'Mode Uji Ingatan: Teks Arab disembunyikan' : 'Teks Arab ditampilkan kembali');
      });
    }

    // Switch Juz Directly in Player Tab
    const playerJuzSelect = document.getElementById('player-juz-select');
    if (playerJuzSelect) {
      playerJuzSelect.addEventListener('change', async (e) => {
        const juzNum = parseInt(e.target.value, 10);
        await this.onPlayerJuzChanged(juzNum);
      });
    }

    // Switch Surah Directly in Player Tab
    const playerSurahSelect = document.getElementById('player-surah-select');
    if (playerSurahSelect) {
      playerSurahSelect.addEventListener('change', async (e) => {
        const surahId = parseInt(e.target.value, 10);
        await this.switchSurahInPlayer(surahId, false);
      });
    }

    // Open Edit Range Modal from Player Card
    const btnOpenEditRange = document.getElementById('btn-open-edit-range');
    if (btnOpenEditRange) {
      btnOpenEditRange.addEventListener('click', () => {
        this._openEditRangeModal();
      });
    }

    // Close & Cancel Edit Range Modal
    const btnCloseEditRange = document.getElementById('btn-close-edit-range');
    const btnCancelEditRange = document.getElementById('btn-cancel-edit-range');
    const modalEditRange = document.getElementById('modal-edit-range');

    if (btnCloseEditRange) {
      btnCloseEditRange.addEventListener('click', () => {
        if (modalEditRange) modalEditRange.classList.remove('active');
      });
    }
    if (btnCancelEditRange) {
      btnCancelEditRange.addEventListener('click', () => {
        if (modalEditRange) modalEditRange.classList.remove('active');
      });
    }

    // Apply Range Changes Button in Modal
    const btnApplyEditRange = document.getElementById('btn-apply-edit-range');
    if (btnApplyEditRange) {
      btnApplyEditRange.addEventListener('click', () => {
        // Ensure any typed numbers in the textboxes are applied
        this._clampAndApplyModalInputs();

        if (!this.tempSelectedVerseNumbers || this.tempSelectedVerseNumbers.length === 0) {
          alert('Silakan pilih minimal 1 ayat untuk dihafal.');
          return;
        }
        if (modalEditRange) modalEditRange.classList.remove('active');
        this.applyNewVerseRange(this.tempSelectedVerseNumbers);
      });
    }

    // Modal Range Textboxes
    const modalFromInput = document.getElementById('modal-range-from-input');
    const modalToInput = document.getElementById('modal-range-to-input');

    const handleModalInput = () => {
      if (!modalFromInput || !modalToInput || !this.selectedSurah) return;
      const total = this.selectedSurah.verses_count;
      const from = parseInt(modalFromInput.value, 10);
      const to = parseInt(modalToInput.value, 10);
      if (!isNaN(from) && !isNaN(to) && from >= 1 && from <= to && to <= total) {
        const list = [];
        for (let i = from; i <= to; i++) list.push(i);
        this.tempSelectedVerseNumbers = list;
        this._renderModalVerseList();
      }
    };

    if (modalFromInput) {
      modalFromInput.addEventListener('focus', () => modalFromInput.select());
      modalFromInput.addEventListener('input', handleModalInput);
      modalFromInput.addEventListener('change', () => this._clampAndApplyModalInputs());
      modalFromInput.addEventListener('blur', () => this._clampAndApplyModalInputs());
    }

    if (modalToInput) {
      modalToInput.addEventListener('focus', () => modalToInput.select());
      modalToInput.addEventListener('input', handleModalInput);
      modalToInput.addEventListener('change', () => this._clampAndApplyModalInputs());
      modalToInput.addEventListener('blur', () => this._clampAndApplyModalInputs());
    }

    // Player controls
    document.getElementById('btn-play-pause').addEventListener('click', () => {
      if (!this.selectedSurah) {
        this.showToast('Silakan pilih surat terlebih dahulu 📖');
        const sel = document.getElementById('player-surah-select');
        if (sel) sel.focus();
        return;
      }
      if (window.quranPlayer.isPlaying && !window.quranPlayer.isPaused) {
        window.quranPlayer.pause();
      } else {
        window.quranPlayer.play();
      }
    });

    document.getElementById('btn-prev-verse').addEventListener('click', () => {
      if (!this.selectedSurah) return;
      window.quranPlayer.prev();
    });

    document.getElementById('btn-next-verse').addEventListener('click', () => {
      if (!this.selectedSurah) return;
      window.quranPlayer.next();
    });

    document.getElementById('btn-stop-player').addEventListener('click', () => {
      if (!this.selectedSurah) return;
      window.quranPlayer.stop();
    });

    // Slider Pengulangan Ayat (Bebas 1x s.d. 20x dengan Presets 1x, 5x, 10x, 20x)
    const repeatSlider = document.getElementById('player-repeat-slider');
    if (repeatSlider) {
      const handleSliderInput = () => {
        const val = parseInt(repeatSlider.value, 10) || 1;
        this.syncRepeatSlider(val);
        window.quranPlayer.setTargetRepeats(val);
      };

      repeatSlider.addEventListener('input', handleSliderInput);
      repeatSlider.addEventListener('change', handleSliderInput);
    }

    // Slider Quick Preset Ticks (1x, 5x, 10x, 20x)
    document.querySelectorAll('.slider-tick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.val, 10);
        this.syncRepeatSlider(val);
        window.quranPlayer.setTargetRepeats(val);
      });
    });

    // Player Mode dropdown: Per Ayat vs Seluruh Blok
    const playerModeSelect = document.getElementById('player-mode-select');
    if (playerModeSelect) {
      playerModeSelect.addEventListener('change', () => {
        const mode = playerModeSelect.value;
        window.quranPlayer.setMode(mode);
        this.showToast(mode === 'per-verse' ? 'Metode Pengulangan: Per Ayat' : 'Metode Pengulangan: Seluruh Blok');
      });
    }

    // Delay select
    const delaySelect = document.getElementById('delay-select');
    if (delaySelect) {
      delaySelect.addEventListener('change', () => {
        window.quranPlayer.setDelaySeconds(parseFloat(delaySelect.value));
      });
    }

    // Playback Speed
    const speedBtn = document.getElementById('btn-playback-speed');
    if (speedBtn) {
      const speeds = [1.0, 1.25, 0.75, 0.9];
      let speedIdx = 0;
      speedBtn.addEventListener('click', () => {
        speedIdx = (speedIdx + 1) % speeds.length;
        const newSpeed = speeds[speedIdx];
        speedBtn.textContent = `${newSpeed}x`;
        window.quranPlayer.setPlaybackRate(newSpeed);
      });
    }

    // Sticky Mini Player click
    const miniPlayer = document.getElementById('mini-player-bar');
    if (miniPlayer) {
      miniPlayer.addEventListener('click', (e) => {
        if (!e.target.closest('.mini-ctrl-btn')) {
          this.switchTab('player');
        }
      });
    }
    const miniPlayBtn = document.getElementById('mini-play-btn');
    if (miniPlayBtn) {
      miniPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.quranPlayer.isPlaying && !window.quranPlayer.isPaused) {
          window.quranPlayer.pause();
        } else {
          window.quranPlayer.play();
        }
      });
    }


    // Weekly Grid Navigation Events
    const btnWeekPrev = document.getElementById('btn-weekly-prev');
    const btnWeekNext = document.getElementById('btn-weekly-next');

    if (btnWeekPrev) {
      btnWeekPrev.addEventListener('click', () => {
        this.currentWeekOffset--;
        this.renderWeeklyGrid();
      });
    }
    if (btnWeekNext) {
      btnWeekNext.addEventListener('click', () => {
        this.currentWeekOffset++;
        this.renderWeeklyGrid();
      });
    }



    // Record Setoran Modal
    const btnRecordSetoran = document.getElementById('btn-record-setoran');
    const btnProgressRecordSetoran = document.getElementById('btn-progress-record-setoran');
    const modalSetoran = document.getElementById('modal-setoran');
    const btnCloseModal = document.getElementById('btn-close-modal-setoran');
    const formSetoran = document.getElementById('form-setoran');

    const openSetoranModal = () => {
      this._populateSetoranModal();
      modalSetoran.classList.add('active');
    };

    if (btnRecordSetoran) {
      btnRecordSetoran.addEventListener('click', () => {
        this.switchTab('setoran');
      });
    }
    if (btnProgressRecordSetoran) {
      btnProgressRecordSetoran.addEventListener('click', () => {
        this.switchTab('setoran');
      });
    }

    // Setoran Page Form Submission & Reset
    const pageFormSetoran = document.getElementById('page-form-setoran');
    if (pageFormSetoran) {
      pageFormSetoran.addEventListener('submit', (e) => {
        e.preventDefault();
        this._handleSavePageSetoran();
      });
      // Re-enable submit button when any field in setoran form changes
      pageFormSetoran.addEventListener('input', () => {
        this._enablePageSetoranSubmit();
      });
      pageFormSetoran.addEventListener('change', () => {
        this._enablePageSetoranSubmit();
      });
    }
    const btnResetPageSetoran = document.getElementById('page-btn-reset-setoran');
    if (btnResetPageSetoran) {
      btnResetPageSetoran.addEventListener('click', () => {
        const notesEl = document.getElementById('page-setoran-notes');
        if (notesEl) notesEl.value = '';
        this._populateSetoranPage();
        this._enablePageSetoranSubmit();
        this.showToast('Form setoran dibatalkan');
      });
    }

    if (btnCloseModal && modalSetoran) {
      btnCloseModal.addEventListener('click', () => {
        modalSetoran.classList.remove('active');
      });
    }
    if (formSetoran) {
      formSetoran.addEventListener('submit', (e) => {
        e.preventDefault();
        this._handleSaveSetoran();
      });
    }

    // Profile Modal Events
    const btnOpenProfile = document.getElementById('btn-open-profile');
    const modalProfile = document.getElementById('modal-profile');
    const btnCloseModalProfile = document.getElementById('btn-close-modal-profile');
    const btnToggleAddProfile = document.getElementById('btn-toggle-add-profile');
    const formAddProfile = document.getElementById('form-add-profile');
    const btnCancelAddProfile = document.getElementById('btn-cancel-add-profile');
    const formEditProfile = document.getElementById('form-edit-profile');
    const btnCancelEditProfile = document.getElementById('btn-cancel-edit-profile');
    const colorPicker = document.getElementById('profile-color-picker');

    if (btnOpenProfile) {
      btnOpenProfile.addEventListener('click', () => {
        this._openProfileModal();
      });
    }
    if (btnCloseModalProfile && modalProfile) {
      btnCloseModalProfile.addEventListener('click', () => {
        modalProfile.classList.remove('active');
      });
    }
    if (btnToggleAddProfile && formAddProfile) {
      btnToggleAddProfile.addEventListener('click', () => {
        const isHidden = formAddProfile.style.display === 'none';
        formAddProfile.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          const input = document.getElementById('input-new-profile-name');
          if (input) { input.value = ''; input.focus(); }
          const editSec = document.getElementById('edit-profile-section');
          if (editSec) editSec.style.display = 'none';
        }
      });
    }
    if (btnCancelAddProfile && formAddProfile) {
      btnCancelAddProfile.addEventListener('click', () => {
        formAddProfile.style.display = 'none';
      });
    }
    if (colorPicker) {
      colorPicker.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          colorPicker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
        });
      });
    }
    if (formAddProfile) {
      formAddProfile.addEventListener('submit', (e) => {
        e.preventDefault();
        this._handleCreateProfile();
      });
    }
    if (formEditProfile) {
      formEditProfile.addEventListener('submit', (e) => {
        e.preventDefault();
        this._handleUpdateProfile();
      });
    }
    if (btnCancelEditProfile) {
      btnCancelEditProfile.addEventListener('click', () => {
        const editSec = document.getElementById('edit-profile-section');
        if (editSec) editSec.style.display = 'none';
      });
    }

    // Export & Import Data
    const btnExport = document.getElementById('btn-export-data');
    const fileImport = document.getElementById('file-import-data');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const json = window.historyManager.exportDataJson();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `satujuz_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Data hafalan berhasil diekspor!');
      });
    }
    if (fileImport) {
      fileImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const res = window.historyManager.importDataJson(event.target.result);
          if (res.success) {
            this.showToast(`Berhasil memulihkan ${res.countLogs} riwayat latihan!`);
            this.renderSurahList();
            this.updateStatsUI();
            this.renderHistoryTimeline();
            this.renderHistoryChecklist();
          } else {
            alert('Gagal impor: ' + res.error);
          }
        };
        reader.readAsText(file);
      });
    }

    // Reset All Data
    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin mengatur ulang semua progres hafalan dan riwayat?')) {
          window.historyManager.clearAllData();
          this.renderSurahList();
          this.updateStatsUI();
          this.renderHistoryTimeline();
          this.renderHistoryChecklist();
          this.showToast('Semua progres telah direset');
        }
      });
    }

    // Reciter Selection in Settings
    const reciterSelect = document.getElementById('setting-reciter-select');
    if (reciterSelect) {
      // populate reciters
      const reciters = window.quranApi.getReciters();
      const savedReciterId = parseInt(localStorage.getItem('hafalan_qori_id') || '7', 10);
      reciterSelect.innerHTML = reciters.map(r => `
        <option value="${r.id}" ${r.id === savedReciterId ? 'selected' : ''}>
          ${r.name}
        </option>
      `).join('');

      reciterSelect.addEventListener('change', () => {
        const id = parseInt(reciterSelect.value, 10);
        localStorage.setItem('hafalan_qori_id', id);
        window.quranPlayer.setReciter(id);
        this.showToast('Qari berhasil diubah');
      });
    }

    // Dark Mode Toggle
    const darkToggle = document.getElementById('setting-dark-mode');
    if (darkToggle) {
      darkToggle.addEventListener('change', () => {
        document.documentElement.setAttribute('data-theme', darkToggle.checked ? 'dark' : 'light');
      });
    }
  }

  getTargetRepeats() {
    const slider = document.getElementById('player-repeat-slider');
    if (!slider) return 1;
    return Math.min(20, Math.max(1, parseInt(slider.value, 10) || 1));
  }

  syncRepeatSlider(val) {
    const slider = document.getElementById('player-repeat-slider');
    const badge = document.getElementById('player-slider-val-badge');
    if (!slider || !badge) return;

    if (val === 'loop' || val === Infinity || val === 'infinite') {
      badge.textContent = '∞ Loop';
      document.querySelectorAll('.slider-tick-btn').forEach(b => b.classList.remove('active'));
      return;
    }

    const min = 1;
    const max = 20;
    const num = Math.min(max, Math.max(min, parseInt(val, 10) || 1));
    slider.min = "1";
    slider.max = "20";
    slider.step = "1";
    slider.value = num;
    badge.textContent = `${num}x`;

    const pct = Math.min(100, Math.max(0, ((num - min) / (max - min)) * 100));
    slider.style.background = `linear-gradient(to right, #0d9488 0%, #0d9488 ${pct}%, #cbf3ea ${pct}%, #cbf3ea 100%)`;

    document.querySelectorAll('.slider-tick-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.val === String(num));
    });
  }

  _setupAudioCallbacks() {
    window.quranPlayer.onStateChange = (state) => {
      this._updatePlayerUI(state);
    };

    window.quranPlayer.onVerseChange = (verse, idx) => {
      this._highlightActiveVerse(verse);
    };

    window.quranPlayer.onSessionComplete = (session) => {
      this._handleSessionCompleted(session);
    };

    window.quranPlayer.onError = (msg) => {
      this.showToast(msg);
    };
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

    const targetView = document.getElementById(`view-${tabName}`);
    const targetNav = document.querySelector(`.nav-item[data-tab="${tabName}"]`);

    if (targetView) targetView.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    // Scroll to top of content
    document.querySelector('.app-content').scrollTop = 0;
    if (targetView) targetView.scrollTop = 0;

    if (tabName === 'history') {
      this.renderWeeklyGrid();
    } else if (tabName === 'progress') {
      const juz = this.selectedStatsJuz || 30;
      this.updateStatsUI(juz);
      this.renderProgressSuratTable(juz);
    } else if (tabName === 'setoran') {
      this._populateSetoranPage();
    }
  }

  /* --- Surah List & Filtering --- */
  filterAndRenderSurahs() {
    this.filteredSurahs = this.surahs.filter(surah => {
      // 1. Text Search
      const matchSearch = !this.searchQuery ||
        surah.name_simple.toLowerCase().includes(this.searchQuery) ||
        (surah.translated_name && surah.translated_name.name.toLowerCase().includes(this.searchQuery)) ||
        surah.name_arabic.includes(this.searchQuery) ||
        String(surah.id).includes(this.searchQuery);

      if (!matchSearch) return false;

      // 2. Status Filter
      if (this.currentFilter === 'all') return true;
      const prog = window.historyManager.getSurahProgress(surah.id);
      return prog.status === this.currentFilter;
    });

    this.renderSurahList();
  }

  renderSurahList() {
    const containers = [
      document.getElementById('surah-list-container'),
      document.getElementById('progress-surah-list-container')
    ].filter(Boolean);

    if (containers.length === 0) return;

    if (this.filteredSurahs.length === 0) {
      const emptyHtml = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">Tidak ada surat ditemukan</div>
          <div class="empty-desc">Coba gunakan kata kunci pencarian yang lain atau ubah filter status.</div>
        </div>
      `;
      containers.forEach(c => c.innerHTML = emptyHtml);
      return;
    }

    const htmlContent = this.filteredSurahs.map(surah => {
      const prog = window.historyManager.getSurahProgress(surah.id);
      const masteredCount = (prog.masteredVerses || []).length;
      const percent = surah.verses_count > 0 ? Math.round((masteredCount / surah.verses_count) * 100) : 0;
      
      const statusLabels = {
        none: 'Belum Mulai',
        memorizing: 'Sedang Dihafal',
        memorized: 'Sudah Hafal',
        mutqin: 'Mutqin ⭐'
      };

      return `
        <div class="surah-card" data-surah-id="${surah.id}">
          <div class="card-left">
            <div class="surah-number-badge">${surah.id}</div>
            <div class="surah-info">
              <div class="surah-title-latin">
                ${surah.name_simple}
                <span class="surah-meta">(${surah.revelation_place === 'makkah' ? 'Makkiyah' : 'Madaniyah'})</span>
              </div>
              <div class="surah-meta">
                ${surah.translated_name ? surah.translated_name.name : ''} • ${surah.verses_count} Ayat
              </div>
              <div class="surah-progress-mini">
                <div class="progress-mini-bar">
                  <div class="progress-mini-fill" style="width: ${percent}%;"></div>
                </div>
                <span class="progress-mini-text">${masteredCount}/${surah.verses_count} Ayat (${percent}%)</span>
              </div>
            </div>
          </div>
          <div class="card-right">
            <div class="surah-arabic-name">${surah.name_arabic}</div>
            <span class="status-text ${prog.status}">${statusLabels[prog.status] || 'Belum Mulai'}</span>
          </div>
        </div>
      `;
    }).join('');

    containers.forEach(c => c.innerHTML = htmlContent);
  }

  /* --- Surah Detail & Verse Selection Sheet --- */
  async openSurahDetailSheet(surahId, initialFrom, initialTo) {
    const surah = (this.surahs || []).find(s => s.id === surahId) ||
      ((window.ALL_SURAHS || []).find(s => s.id === surahId));
    if (!surah) return;
    this.selectedSurah = surah;

    const sheet = document.getElementById('surah-detail-sheet');
    sheet.classList.add('active');

    // Populate Hero Header
    document.getElementById('sheet-surah-title').textContent = `${surah.id}. ${surah.name_simple}`;
    document.getElementById('sheet-surah-subtitle').textContent = `${surah.verses_count} Ayat • ${surah.revelation_place === 'makkah' ? 'Makkiyah' : 'Madaniyah'}`;
    document.getElementById('sheet-hero-arabic').textContent = surah.name_arabic || '';
    document.getElementById('sheet-hero-latin').textContent = `${surah.name_simple} (${surah.translated_name ? surah.translated_name.name : ''})`;
    document.getElementById('sheet-hero-meaning').textContent = `Urutan Wahyu ke-${surah.revelation_order || '-'}`;

    // Surah Status Select
    const prog = window.historyManager.getSurahProgress(surah.id);
    const statusSelect = document.getElementById('sheet-status-select');
    if (statusSelect) {
      statusSelect.value = prog.status;
      statusSelect.onchange = () => {
        window.historyManager.setSurahStatus(surah.id, statusSelect.value);
        this.renderSurahList();
        const juz = this.selectedStatsJuz || 30;
        this.updateStatsUI(juz);
        this.renderProgressSuratTable(juz);
        this.showToast(`Status ${surah.name_simple} diubah`);
      };
    }

    // Load Verses
    document.getElementById('sheet-verses-container').innerHTML = `
      <div style="text-align: center; padding: 30px; color: var(--text-muted);">
        <div style="font-size: 24px; margin-bottom: 8px;">📖</div>
        Memuat ayat-ayat ${surah.name_simple}...
      </div>
    `;

    this.surahVerses = await window.quranApi.getSurahVerses(surah.id);

    // Initial range selection: use custom initialFrom/initialTo if passed, else first 5
    let from = 1;
    let to = Math.min(surah.verses_count, 5);
    if (initialFrom && initialFrom >= 1 && initialFrom <= surah.verses_count) {
      from = initialFrom;
      to = (initialTo && initialTo >= from && initialTo <= surah.verses_count) ? initialTo : from;
    }
    this._setVerseRange(from, to);
    this._renderSheetVersesList();
    this._setupRangeControls(surah.verses_count);
  }

  _setupRangeControls(totalVerses) {
    // Quick Range Pills
    const pillsContainer = document.getElementById('quick-range-pills');
    if (pillsContainer) {
      let html = `<button class="range-pill-btn active" data-from="1" data-to="${totalVerses}">Semua (1-${totalVerses})</button>`;
      if (totalVerses >= 3) {
        html += `<button class="range-pill-btn" data-from="1" data-to="3">Ayat 1-3</button>`;
      }
      if (totalVerses >= 5) {
        html += `<button class="range-pill-btn" data-from="1" data-to="5">Ayat 1-5</button>`;
      }
      if (totalVerses >= 10) {
        html += `<button class="range-pill-btn" data-from="6" data-to="10">Ayat 6-10</button>`;
      }
      if (totalVerses > 10) {
        html += `<button class="range-pill-btn" data-from="${totalVerses - 4}" data-to="${totalVerses}">5 Terakhir</button>`;
      }
      pillsContainer.innerHTML = html;

      pillsContainer.querySelectorAll('.range-pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          pillsContainer.querySelectorAll('.range-pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const from = parseInt(btn.dataset.from, 10);
          const to = parseInt(btn.dataset.to, 10);
          this._setVerseRange(from, to);
          this._syncRangeSteppers();
          this._renderSheetVersesList();
        });
      });
    }

    // Sheet Range Textboxes
    const sheetFromInput = document.getElementById('range-from-input');
    const sheetToInput = document.getElementById('range-to-input');

    if (sheetFromInput) {
      sheetFromInput.min = 1;
      sheetFromInput.max = totalVerses;
      sheetFromInput.onfocus = () => sheetFromInput.select();
      sheetFromInput.oninput = () => {
        const from = parseInt(sheetFromInput.value, 10);
        const to = parseInt(sheetToInput ? sheetToInput.value : '1', 10);
        if (!isNaN(from) && !isNaN(to) && from >= 1 && from <= to && to <= totalVerses) {
          this._setVerseRange(from, to);
          this._renderSheetVersesList();
        }
      };
      sheetFromInput.onchange = () => this._clampAndApplyRangeInputs();
      sheetFromInput.onblur = () => this._clampAndApplyRangeInputs();
    }

    if (sheetToInput) {
      sheetToInput.min = 1;
      sheetToInput.max = totalVerses;
      sheetToInput.onfocus = () => sheetToInput.select();
      sheetToInput.oninput = () => {
        const from = parseInt(sheetFromInput ? sheetFromInput.value : '1', 10);
        const to = parseInt(sheetToInput.value, 10);
        if (!isNaN(from) && !isNaN(to) && from >= 1 && from <= to && to <= totalVerses) {
          this._setVerseRange(from, to);
          this._renderSheetVersesList();
        }
      };
      sheetToInput.onchange = () => this._clampAndApplyRangeInputs();
      sheetToInput.onblur = () => this._clampAndApplyRangeInputs();
    }

    this._syncRangeSteppers();
  }

  _clampAndApplyRangeInputs() {
    const fromInput = document.getElementById('range-from-input');
    const toInput = document.getElementById('range-to-input');
    if (!fromInput || !toInput || !this.selectedSurah) return;
    const total = this.selectedSurah.verses_count;

    let from = parseInt(fromInput.value, 10);
    let to = parseInt(toInput.value, 10);

    if (isNaN(from) || from < 1) from = 1;
    if (from > total) from = total;
    if (isNaN(to) || to < from) to = from;
    if (to > total) to = total;

    fromInput.value = from;
    toInput.value = to;

    this._setVerseRange(from, to);
    this._renderSheetVersesList();
  }

  _setVerseRange(from, to) {
    const list = [];
    for (let i = from; i <= to; i++) {
      list.push(i);
    }
    this.selectedVerseNumbers = list;
    this._syncRangeSteppers();
    this._updateSelectionSummary();
  }

  _syncRangeSteppers() {
    const from = Math.min(...this.selectedVerseNumbers) || 1;
    const to = Math.max(...this.selectedVerseNumbers) || 1;
    const fromInput = document.getElementById('range-from-input');
    const toInput = document.getElementById('range-to-input');
    if (fromInput && document.activeElement !== fromInput) fromInput.value = from;
    if (toInput && document.activeElement !== toInput) toInput.value = to;

    const fromValEl = document.getElementById('range-from-val');
    const toValEl = document.getElementById('range-to-val');
    if (fromValEl) fromValEl.textContent = from;
    if (toValEl) toValEl.textContent = to;

    this._updateSelectionSummary();
  }

  _updateSelectionSummary() {
    const count = this.selectedVerseNumbers.length;
    const summaryText = count === 1
      ? `1 Ayat Terpilih (Ayat ${this.selectedVerseNumbers[0]})`
      : `${count} Ayat Terpilih (Ayat ${Math.min(...this.selectedVerseNumbers)} - ${Math.max(...this.selectedVerseNumbers)})`;

    document.getElementById('selection-summary-text').textContent = summaryText;
    document.getElementById('dock-selected-text').textContent = summaryText;
    document.getElementById('dock-subtext').textContent = `${this.selectedSurah.name_simple} • Siap Dihafal`;
  }

  _renderSheetVersesList() {
    const container = document.getElementById('sheet-verses-container');
    if (!container) return;

    const prog = window.historyManager.getSurahProgress(this.selectedSurah.id);
    const masteredSet = new Set(prog.masteredVerses || []);

    container.innerHTML = this.surahVerses.map(verse => {
      const isSelected = this.selectedVerseNumbers.includes(verse.verse_number);
      const isMastered = masteredSet.has(verse.verse_number);
      const rawTrans = (verse.translations && verse.translations[0]) ? verse.translations[0].text : '';
      const translation = this.cleanTranslation(rawTrans);

      return `
        <div class="verse-item-card ${isSelected ? 'selected' : ''}" data-verse-num="${verse.verse_number}" id="sheet-verse-${verse.verse_number}">
          <div class="verse-header">
            <label class="verse-select-check">
              <input type="checkbox" class="verse-checkbox" data-verse-num="${verse.verse_number}" ${isSelected ? 'checked' : ''}>
              Ayat ${verse.verse_number}
            </label>
            <div class="verse-header-actions">
              <button class="verse-action-btn ${isMastered ? 'mastered' : ''}" data-toggle-mastery="${verse.verse_number}">
                ${isMastered ? '✓ Sudah Hafal' : '○ Tandai Hafal'}
              </button>
              <button class="verse-action-btn" data-play-single="${verse.verse_number}" title="Pilih & Ulangi Ayat Ini Saja">
                ▶ 1 Ayat
              </button>
            </div>
          </div>
          
          <div class="arabic-text-container">
            <p class="arabic-text ${this.blindMode ? 'blurred' : ''}" data-peek="${verse.verse_number}">
              ${verse.text_uthmani}
              <span class="verse-end-symbol">${verse.verse_number}</span>
            </p>
            <div class="blur-peek-hint" data-peek="${verse.verse_number}">Sentuh untuk Mengintip Ayat 👁️</div>
          </div>

          <div class="verse-translation">
            ${translation}
          </div>
        </div>
      `;
    }).join('');

    // Checkbox selection listener
    container.querySelectorAll('.verse-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const num = parseInt(e.target.dataset.verseNum, 10);
        if (e.target.checked) {
          if (!this.selectedVerseNumbers.includes(num)) {
            this.selectedVerseNumbers.push(num);
            this.selectedVerseNumbers.sort((a, b) => a - b);
          }
        } else {
          this.selectedVerseNumbers = this.selectedVerseNumbers.filter(n => n !== num);
        }
        this._syncRangeSteppers();
        const card = document.getElementById(`sheet-verse-${num}`);
        if (card) card.classList.toggle('selected', e.target.checked);
      });
    });

    // Mastery check listener
    container.querySelectorAll('[data-toggle-mastery]').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.toggleMastery, 10);
        const updated = window.historyManager.toggleVerseMastery(this.selectedSurah.id, num, this.selectedSurah.verses_count);
        this._renderSheetVersesList();
        this.renderSurahList();
        const juz = this.selectedStatsJuz || 30;
        this.updateStatsUI(juz);
        this.renderProgressSuratTable(juz);
        this.showToast(`Ayat ${num} diperbarui`);
      });
    });

    // Play single verse listener
    container.querySelectorAll('[data-play-single]').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.playSingle, 10);
        this.selectedVerseNumbers = [num];
        this._syncRangeSteppers();
        this.startSessionFromSheet();
      });
    });

    // Tap to peek blurred text
    container.querySelectorAll('[data-peek]').forEach(el => {
      el.addEventListener('click', () => {
        const num = el.dataset.peek;
        const textEl = container.querySelector(`.arabic-text[data-peek="${num}"]`);
        if (textEl) {
          textEl.classList.toggle('blurred');
        }
      });
    });
  }

  /* --- Start Memorization Session in Audio Player --- */
  async startSessionFromSheet() {
    if (this.selectedVerseNumbers.length === 0) {
      alert('Silakan pilih minimal 1 ayat untuk mulai menghafal.');
      return;
    }

    // Close sheet
    document.getElementById('surah-detail-sheet').classList.remove('active');

    // Filter verse objects
    const chosenVerses = this.surahVerses.filter(v => this.selectedVerseNumbers.includes(v.verse_number));

    // Get current repetition setting from slider
    const targetRepeats = this.getTargetRepeats();

    // Get current mode setting
    const playerModeSelect = document.getElementById('player-mode-select');
    const mode = playerModeSelect ? playerModeSelect.value : 'per-verse';

    // Get reciter setting
    const reciterSelect = document.getElementById('setting-reciter-select');
    const reciterId = reciterSelect && reciterSelect.value ? parseInt(reciterSelect.value, 10) : parseInt(localStorage.getItem('hafalan_qori_id') || '7', 10);

    await window.quranPlayer.loadSession({
      surahId: this.selectedSurah.id,
      surahName: this.selectedSurah.name_simple,
      selectedVerses: chosenVerses,
      targetRepeats: targetRepeats,
      mode: mode,
      reciterId: reciterId
    });

    // Determine and synchronize Juz if needed
    this._syncJuzForSurah(this.selectedSurah.id);

    // Switch to Player tab
    this.switchTab('player');

    const sel = document.getElementById('player-surah-select');
    if (sel && this.selectedSurah) {
      sel.value = String(this.selectedSurah.id);
    }

    const latinEl = document.getElementById('player-latin-name');
    if (latinEl && this.selectedSurah) {
      latinEl.textContent = this.selectedSurah.name_simple;
    }

    // Auto start playing
    window.quranPlayer.play();
  }

  async prepareSurahForPractice(surahId, autoPlay = false) {
    const all = (this.allSurahs && this.allSurahs.length > 0) ? this.allSurahs : (window.quranApi ? window.quranApi.getAllSurahs() : []);
    const surah = all.find(s => s.id === surahId) || (this.surahs && this.surahs.find(s => s.id === surahId));
    if (!surah) return;
    this.selectedSurah = surah;

    // Determine and synchronize Juz if needed
    this._syncJuzForSurah(surahId);

    this.surahVerses = await window.quranApi.getSurahVerses(surahId);
    this.selectedVerseNumbers = Array.from({ length: surah.verses_count }, (_, i) => i + 1);

    const sel = document.getElementById('player-surah-select');
    if (sel && this.selectedSurah) {
      sel.value = String(this.selectedSurah.id);
    }
    const latinEl = document.getElementById('player-latin-name');
    if (latinEl) latinEl.textContent = surah.name_simple;

    const reciterSelect = document.getElementById('setting-reciter-select');
    const reciterId = reciterSelect && reciterSelect.value ? parseInt(reciterSelect.value, 10) : parseInt(localStorage.getItem('hafalan_qori_id') || '7', 10);

    await window.quranPlayer.loadSession({
      surahId: surah.id,
      surahName: surah.name_simple,
      selectedVerses: this.surahVerses,
      targetRepeats: this.getTargetRepeats(),
      mode: 'per-verse',
      reciterId: reciterId
    });

    if (autoPlay) {
      window.quranPlayer.play();
    }
  }

  /* --- Synchronize Juz Dropdown for a Given Surah --- */
  _syncJuzForSurah(surahId) {
    if (!window.JUZ_SURAH_MAP || !surahId) return;

    // If currently selected juz already contains this surah, preserve current juz!
    const currentJuzList = window.JUZ_SURAH_MAP[this.selectedJuz];
    if (currentJuzList && currentJuzList.includes(surahId)) {
      return;
    }

    // Otherwise, search for the juz containing this surah
    for (let j = 1; j <= 30; j++) {
      if (window.JUZ_SURAH_MAP[j] && window.JUZ_SURAH_MAP[j].includes(surahId)) {
        if (this.selectedJuz !== j) {
          this.selectedJuz = j;
          localStorage.setItem('satujuz_selected_juz', String(j));
          const juzSel = document.getElementById('player-juz-select');
          if (juzSel) juzSel.value = String(j);
          const juzName = document.getElementById('player-juz-name');
          if (juzName) juzName.textContent = `Juz ${j}`;
          this._populatePlayerSurahSelect(j);
        }
        break;
      }
    }
  }

  /* --- Populate Juz Selector in Player Tab --- */
  _populatePlayerJuzSelect() {
    const sel = document.getElementById('player-juz-select');
    const nameEl = document.getElementById('player-juz-name');
    if (!sel) return;

    let optionsHtml = '';
    for (let j = 1; j <= 30; j++) {
      optionsHtml += `<option value="${j}" ${j === this.selectedJuz ? 'selected' : ''}>Juz ${j}</option>`;
    }
    sel.innerHTML = optionsHtml;
    sel.value = String(this.selectedJuz);

    if (nameEl) {
      nameEl.textContent = `Juz ${this.selectedJuz}`;
    }
  }

  /* --- Handler when User Changes Juz in Player Tab --- */
  async onPlayerJuzChanged(juzNum) {
    if (!juzNum || juzNum < 1 || juzNum > 30) return;
    this.selectedJuz = juzNum;
    localStorage.setItem('satujuz_selected_juz', String(juzNum));

    // Stop previous audio playback immediately
    if (window.quranPlayer) {
      window.quranPlayer.stop();
    }

    const nameEl = document.getElementById('player-juz-name');
    if (nameEl) {
      nameEl.textContent = `Juz ${juzNum}`;
    }

    const sel = document.getElementById('player-juz-select');
    if (sel && sel.value !== String(juzNum)) {
      sel.value = String(juzNum);
    }

    // Update Surah dropdown with surahs belonging to this Juz
    this._populatePlayerSurahSelect(juzNum);

    // Auto-select first surah of the selected Juz without playing audio immediately and without toast
    const surahsInJuz = window.quranApi.getSurahsByJuz(juzNum);
    if (surahsInJuz && surahsInJuz.length > 0) {
      await this.switchSurahInPlayer(surahsInJuz[0].id, false, false);
    }
  }

  /* --- Populate Surah Selector in Player Tab Filtered by Juz --- */
  _populatePlayerSurahSelect(juzNum) {
    const sel = document.getElementById('player-surah-select');
    if (!sel) return;

    const targetJuz = juzNum || this.selectedJuz || 30;
    const surahs = window.quranApi ? window.quranApi.getSurahsByJuz(targetJuz) : (this.surahs || []);

    let optionsHtml = `<option value="" disabled ${!this.selectedSurah ? 'selected' : ''}>Pilih Surat</option>`;
    optionsHtml += surahs.map(s => `
      <option value="${s.id}" ${this.selectedSurah && this.selectedSurah.id === s.id ? 'selected' : ''}>
        ${s.id}. ${s.name_simple} (${s.verses_count} Ayat) - ${s.name_arabic}
      </option>
    `).join('');
    sel.innerHTML = optionsHtml;

    if (this.selectedSurah && surahs.some(s => s.id === this.selectedSurah.id)) {
      sel.value = String(this.selectedSurah.id);
    } else {
      sel.value = "";
    }
  }

  /* --- Switch Surah Directly in Player Tab --- */
  async switchSurahInPlayer(surahId, autoPlay = true, showToast = true) {
    const all = (this.allSurahs && this.allSurahs.length > 0) ? this.allSurahs : (window.quranApi ? window.quranApi.getAllSurahs() : []);
    const surah = all.find(s => s.id === surahId) || (this.surahs && this.surahs.find(s => s.id === surahId));
    if (!surah) return;
    this.selectedSurah = surah;
    this._activeRenderedVerseKey = null;
    this._activeRenderedRepeat = null;

    // Detect and synchronize Juz dropdown if surah belongs to another Juz
    this._syncJuzForSurah(surahId);

    // Load verses of the newly chosen surah from Quran.com API / cache
    this.surahVerses = await window.quranApi.getSurahVerses(surahId);

    // Automatically adapt selected verses to match this new surah!
    const totalVerses = surah.verses_count;
    this.selectedVerseNumbers = Array.from({ length: totalVerses }, (_, i) => i + 1);

    // Sync dropdown select value
    const sel = document.getElementById('player-surah-select');
    if (sel) {
      sel.value = String(surah.id);
    }

    // Update Player card labels (Surah number and verse range)
    const arabicNameEl = document.getElementById('player-arabic-name');
    if (arabicNameEl) {
      arabicNameEl.textContent = surah.name_arabic;
    }
    const latinEl = document.getElementById('player-latin-name');
    if (latinEl) latinEl.textContent = surah.name_simple;

    const rangeTextEl = document.getElementById('player-range-text');
    if (rangeTextEl) {
      const txt = totalVerses === 1 ? '1' : `1-${totalVerses}`;
      rangeTextEl.textContent = txt;
      rangeTextEl.classList.toggle('range-text-compact', txt.length >= 6);
    }
    const selWrap = document.querySelector('.player-surah-selector-wrap');
    if (selWrap) {
      selWrap.title = `${surah.id}. ${surah.name_simple} (${totalVerses} Ayat)`;
    }
    const rangeBtn = document.getElementById('btn-open-edit-range');
    if (rangeBtn) {
      rangeBtn.title = totalVerses === 1 ? `Ayat 1 (1 Ayat Terpilih)` : `Ayat 1 - ${totalVerses} (${totalVerses} Ayat Terpilih)`;
    }

    // Sync steppers and sheet
    this._syncRangeSteppers();

    // Load audio session for new surah
    const targetRepeats = this.getTargetRepeats();
    this.syncRepeatSlider(targetRepeats);
    const playerModeSelect = document.getElementById('player-mode-select');
    const mode = playerModeSelect ? playerModeSelect.value : 'per-verse';
    const reciterSelect = document.getElementById('setting-reciter-select');
    const reciterId = reciterSelect && reciterSelect.value ? parseInt(reciterSelect.value, 10) : parseInt(localStorage.getItem('hafalan_qori_id') || '7', 10);

    await window.quranPlayer.loadSession({
      surahId: surah.id,
      surahName: surah.name_simple,
      selectedVerses: this.surahVerses,
      targetRepeats: targetRepeats,
      mode: mode,
      reciterId: reciterId
    });

    if (autoPlay) {
      window.quranPlayer.play();
    }

    if (showToast) {
      this.showToast(`Surat diganti ke ${surah.id}. ${surah.name_simple} (Ayat 1 - ${totalVerses}) 📖`);
    }
  }

  /* --- Open Range Edit Modal from Player --- */
  _openEditRangeModal() {
    if (!this.selectedSurah) {
      this.showToast('Silakan pilih surat terlebih dahulu 📖');
      return;
    }
    const modal = document.getElementById('modal-edit-range');
    if (!modal) return;

    this.tempSelectedVerseNumbers = [...this.selectedVerseNumbers];
    const total = this.selectedSurah.verses_count;

    document.getElementById('edit-range-modal-title').textContent = `Ubah Ayat: ${this.selectedSurah.id}. ${this.selectedSurah.name_simple}`;
    document.getElementById('edit-range-modal-subtitle').textContent = `Total ${total} Ayat • Atur rentang ayat yang ingin diulang`;

    // Populate quick presets inside modal
    const pillsContainer = document.getElementById('modal-quick-range-pills');
    if (pillsContainer) {
      const presets = [];
      presets.push({ label: `Semua (1-${total})`, from: 1, to: total });
      if (total >= 3) presets.push({ label: 'Ayat 1-3', from: 1, to: 3 });
      if (total >= 5) presets.push({ label: 'Ayat 1-5', from: 1, to: 5 });
      if (total >= 10) presets.push({ label: 'Ayat 6-10', from: 6, to: 10 });
      if (total > 5) presets.push({ label: '5 Terakhir', from: total - 4, to: total });

      pillsContainer.innerHTML = presets.map(p => `
        <button type="button" class="range-pill-btn" data-from="${p.from}" data-to="${p.to}">
          ${p.label}
        </button>
      `).join('');

      pillsContainer.querySelectorAll('.range-pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          pillsContainer.querySelectorAll('.range-pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const from = parseInt(btn.dataset.from, 10);
          const to = parseInt(btn.dataset.to, 10);
          this._setModalRange(from, to);
        });
      });
    }

    const modalFromInput = document.getElementById('modal-range-from-input');
    const modalToInput = document.getElementById('modal-range-to-input');
    if (modalFromInput) {
      modalFromInput.min = 1;
      modalFromInput.max = total;
    }
    if (modalToInput) {
      modalToInput.min = 1;
      modalToInput.max = total;
    }

    this._syncModalSteppers();
    this._renderModalVerseList();

    modal.classList.add('active');
  }

  _setModalRange(from, to) {
    const list = [];
    for (let i = from; i <= to; i++) {
      list.push(i);
    }
    this.tempSelectedVerseNumbers = list;
    this._syncModalSteppers();
    this._renderModalVerseList();
  }

  _syncModalSteppers() {
    const from = Math.min(...(this.tempSelectedVerseNumbers || [1])) || 1;
    const to = Math.max(...(this.tempSelectedVerseNumbers || [1])) || 1;
    const fromInput = document.getElementById('modal-range-from-input');
    const toInput = document.getElementById('modal-range-to-input');
    if (fromInput && document.activeElement !== fromInput) fromInput.value = from;
    if (toInput && document.activeElement !== toInput) toInput.value = to;

    const fromEl = document.getElementById('modal-range-from-val');
    const toEl = document.getElementById('modal-range-to-val');
    if (fromEl) fromEl.textContent = from;
    if (toEl) toEl.textContent = to;
  }

  _clampAndApplyModalInputs() {
    const fromInput = document.getElementById('modal-range-from-input');
    const toInput = document.getElementById('modal-range-to-input');
    if (!fromInput || !toInput || !this.selectedSurah) return;
    const total = this.selectedSurah.verses_count;

    let from = parseInt(fromInput.value, 10);
    let to = parseInt(toInput.value, 10);

    if (isNaN(from) || from < 1) from = 1;
    if (from > total) from = total;
    if (isNaN(to) || to < from) to = from;
    if (to > total) to = total;

    fromInput.value = from;
    toInput.value = to;

    this._setModalRange(from, to);
  }

  _renderModalVerseList() {
    const container = document.getElementById('modal-verse-checkbox-list');
    if (!container) return;

    container.innerHTML = this.surahVerses.map(v => {
      const isSelected = this.tempSelectedVerseNumbers.includes(v.verse_number);
      const rawTrans = (v.translations && v.translations[0]) ? v.translations[0].text : '';
      const trans = this.cleanTranslation(rawTrans);
      return `
        <div class="modal-verse-item ${isSelected ? 'selected' : ''}" data-modal-verse="${v.verse_number}">
          <label class="modal-verse-left">
            <input type="checkbox" class="modal-verse-cb" data-num="${v.verse_number}" ${isSelected ? 'checked' : ''}>
            <span>Ayat ${v.verse_number}</span>
          </label>
          <div class="modal-verse-arabic-snippet" title="${trans}">
            ${v.text_uthmani}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.modal-verse-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const num = parseInt(cb.dataset.num, 10);
        if (cb.checked) {
          if (!this.tempSelectedVerseNumbers.includes(num)) {
            this.tempSelectedVerseNumbers.push(num);
            this.tempSelectedVerseNumbers.sort((a, b) => a - b);
          }
        } else {
          this.tempSelectedVerseNumbers = this.tempSelectedVerseNumbers.filter(n => n !== num);
        }
        this._syncModalSteppers();
        const parentItem = container.querySelector(`.modal-verse-item[data-modal-verse="${num}"]`);
        if (parentItem) parentItem.classList.toggle('selected', cb.checked);
      });
    });
  }

  /* --- Apply New Verse Range to Player Session --- */
  async applyNewVerseRange(newVerseList) {
    if (!newVerseList || newVerseList.length === 0) return;

    this.selectedVerseNumbers = [...newVerseList].sort((a, b) => a - b);
    this._activeRenderedVerseKey = null;
    this._activeRenderedRepeat = null;
    const chosenVerses = this.surahVerses.filter(v => this.selectedVerseNumbers.includes(v.verse_number));

    const targetRepeats = this.getTargetRepeats();

    const playerModeSelect = document.getElementById('player-mode-select');
    const mode = playerModeSelect ? playerModeSelect.value : 'per-verse';

    const reciterSelect = document.getElementById('setting-reciter-select');
    const reciterId = reciterSelect && reciterSelect.value ? parseInt(reciterSelect.value, 10) : parseInt(localStorage.getItem('hafalan_qori_id') || '7', 10);

    await window.quranPlayer.loadSession({
      surahId: this.selectedSurah.id,
      surahName: this.selectedSurah.name_simple,
      selectedVerses: chosenVerses,
      targetRepeats: targetRepeats,
      mode: mode,
      reciterId: reciterId
    });

    const count = this.selectedVerseNumbers.length;
    const minV = Math.min(...this.selectedVerseNumbers);
    const maxV = Math.max(...this.selectedVerseNumbers);
    const rangeText = count === 1 
      ? `Ayat ${minV}` 
      : `Ayat ${minV} - ${maxV}`;

    const rangeTextShort = count === 1 ? String(minV) : `${minV}-${maxV}`;
    const badgeTextEl = document.getElementById('player-range-text');
    if (badgeTextEl) {
      badgeTextEl.textContent = rangeTextShort;
      badgeTextEl.classList.toggle('range-text-compact', rangeTextShort.length >= 6);
    }
    const rangeBtn = document.getElementById('btn-open-edit-range');
    if (rangeBtn) {
      rangeBtn.title = count === 1 ? `Ayat ${minV} (1 Ayat Terpilih)` : `Ayat ${minV} - ${maxV} (${count} Ayat Terpilih)`;
    }

    this._syncRangeSteppers();

    // Start playing new selection
    window.quranPlayer.play();

    this.showToast(`Pilihan ayat diubah menjadi ${rangeText} 🔁`);
  }

  /* --- Player UI Updates & Callbacks --- */
  _updatePlayerUI(state) {
    // Play/Pause button icons
    const playBtn = document.getElementById('btn-play-pause');
    const miniPlayBtn = document.getElementById('mini-play-btn');
    if (playBtn) {
      playBtn.innerHTML = state.isPlaying && !state.isPaused ? '⏸' : '▶';
    }
    if (miniPlayBtn) {
      miniPlayBtn.innerHTML = state.isPlaying && !state.isPaused ? '⏸' : '▶';
    }

    // Mini Player bar visibility
    const miniBar = document.getElementById('mini-player-bar');
    if (miniBar) {
      if (state.isPlaying && this.currentTab !== 'player') {
        miniBar.classList.add('active');
        document.getElementById('mini-surah-title').textContent = `${this.selectedSurah ? this.selectedSurah.name_simple : ''} (Ayat ${state.currentVerse ? state.currentVerse.verse_number : ''})`;
        document.getElementById('mini-repeat-info').textContent = `Putaran ${state.currentRepeat} / ${state.targetRepeats === Infinity ? '∞' : state.targetRepeats}`;
      } else {
        miniBar.classList.remove('active');
      }
    }

    // Header info in Player Tab
    if (this.selectedSurah) {
      const arabicNameEl = document.getElementById('player-arabic-name');
      if (arabicNameEl) {
        arabicNameEl.textContent = this.selectedSurah.name_arabic;
      }
      const latinEl = document.getElementById('player-latin-name');
      if (latinEl) latinEl.textContent = this.selectedSurah.name_simple;
      const selWrap = document.querySelector('.player-surah-selector-wrap');
      if (selWrap) {
        selWrap.title = `${this.selectedSurah.id}. ${this.selectedSurah.name_simple} (${this.selectedSurah.verses_count} Ayat)`;
      }
      
      const sel = document.getElementById('player-surah-select');
      if (sel && sel.value !== String(this.selectedSurah.id)) {
        sel.value = String(this.selectedSurah.id);
      }

      // Also ensure Juz selector and label reflect active selectedJuz
      const juzNameEl = document.getElementById('player-juz-name');
      if (juzNameEl && this.selectedJuz) {
        juzNameEl.textContent = `Juz ${this.selectedJuz}`;
      }
      const juzSel = document.getElementById('player-juz-select');
      if (juzSel && juzSel.value !== String(this.selectedJuz)) {
        juzSel.value = String(this.selectedJuz);
      }

      const count = this.selectedVerseNumbers.length;
      const minV = Math.min(...this.selectedVerseNumbers) || 1;
      const maxV = Math.max(...this.selectedVerseNumbers) || 1;
      const rangeTextShort = count === 1 ? String(minV) : `${minV}-${maxV}`;
      const rangeTextEl = document.getElementById('player-range-text');
      if (rangeTextEl) {
        rangeTextEl.textContent = rangeTextShort;
        rangeTextEl.classList.toggle('range-text-compact', rangeTextShort.length >= 6);
      }
      const rangeBtn = document.getElementById('btn-open-edit-range');
      if (rangeBtn) {
        rangeBtn.title = count === 1 ? `Ayat ${minV} (1 Ayat Terpilih)` : `Ayat ${minV} - ${maxV} (${count} Ayat Terpilih)`;
      }
    } else {
      const latinEl = document.getElementById('player-latin-name');
      if (latinEl) latinEl.textContent = 'Pilih Surat';
      const rangeTextEl = document.getElementById('player-range-text');
      if (rangeTextEl) {
        rangeTextEl.textContent = 'Ayat';
        rangeTextEl.classList.remove('range-text-compact');
      }
      const sel = document.getElementById('player-surah-select');
      if (sel) sel.value = "";
      const juzNameEl = document.getElementById('player-juz-name');
      if (juzNameEl) juzNameEl.textContent = `Juz ${this.selectedJuz || 30}`;
      const juzSel = document.getElementById('player-juz-select');
      if (juzSel) juzSel.value = String(this.selectedJuz || 30);
    }

    // Sync player mode dropdown if state provides mode
    if (state.mode) {
      const modeSelect = document.getElementById('player-mode-select');
      if (modeSelect && modeSelect.value !== state.mode) {
        modeSelect.value = state.mode;
      }
    }

    // Counter Display
    document.getElementById('counter-current-num').textContent = state.currentRepeat;
    document.getElementById('counter-total-num').textContent = state.targetRepeats === Infinity ? '∞' : `/ ${state.targetRepeats}`;
    
    // Repetition Progress Fill
    const fillEl = document.getElementById('counter-progress-fill');
    if (fillEl && state.targetRepeats !== Infinity) {
      const pct = Math.min(100, Math.round((state.currentRepeat / state.targetRepeats) * 100));
      fillEl.style.width = `${pct}%`;
    }

    // Active Verse Presentation (Only re-render and reset scroll when verse or repeat cycle changes)
    if (state.currentVerse) {
      const currentSurahId = this.selectedSurah ? this.selectedSurah.id : (state.currentVerse.surah_id || 0);
      const verseKey = `${currentSurahId}:${state.currentVerse.verse_number}`;
      const isNewVerse = (this._activeRenderedVerseKey !== verseKey);
      const isNewRepeat = (this._activeRenderedRepeat !== state.currentRepeat);

      if (isNewVerse) {
        this._activeRenderedVerseKey = verseKey;
        this._activeRenderedRepeat = state.currentRepeat;

        const surahPrefix = this.selectedSurah ? `${this.selectedSurah.name_simple} • ` : '';
        const verseNumEl = document.getElementById('stage-verse-num');
        if (verseNumEl) {
          verseNumEl.textContent = `${surahPrefix}Ayat ${state.currentVerse.verse_number}`;
        }

        const versePosEl = document.getElementById('stage-verse-pos');
        if (versePosEl) {
          versePosEl.textContent = `(${state.currentVerseIndex + 1} dari ${state.totalSelected} ayat)`;
        }

        const arabicEl = document.getElementById('stage-arabic-text');
        if (arabicEl) {
          arabicEl.innerHTML = `
            ${state.currentVerse.text_uthmani}
            <span class="verse-end-symbol">${state.currentVerse.verse_number}</span>
          `;
          const textLen = (state.currentVerse.text_uthmani || '').length;
          arabicEl.classList.toggle('arabic-text-long', textLen > 200);
        }

        // Reset scroll position to top ONLY when a new verse is displayed
        const textContainer = document.querySelector('.active-verse-stage .arabic-text-container');
        if (textContainer) {
          textContainer.scrollTop = 0;
        }

        const transEl = document.getElementById('stage-translation-text');
        if (transEl) {
          const rawTrans = (state.currentVerse.translations && state.currentVerse.translations[0]) ? state.currentVerse.translations[0].text : '';
          transEl.textContent = this.cleanTranslation(rawTrans);
        }
      } else if (isNewRepeat) {
        this._activeRenderedRepeat = state.currentRepeat;
        // When a repeat cycle restarts from beginning, reset scroll smoothly to top
        const textContainer = document.querySelector('.active-verse-stage .arabic-text-container');
        if (textContainer) {
          textContainer.scrollTop = 0;
        }
      }
    }
  }

  _highlightActiveVerse(verse) {
    // Also highlight inside detail sheet if open
    document.querySelectorAll('.verse-item-card').forEach(c => c.classList.remove('active-playing'));
    const activeCard = document.getElementById(`sheet-verse-${verse.verse_number}`);
    if (activeCard) {
      activeCard.classList.add('active-playing');
      activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  _handleSessionCompleted(session) {
    const all = (this.allSurahs && this.allSurahs.length > 0) ? this.allSurahs : (window.quranApi ? window.quranApi.getAllSurahs() : []);
    const surah = all.find(s => s.id === session.surahId) || this.surahs.find(s => s.id === session.surahId) || this.selectedSurah;
    const vCount = session.verses.length;
    const minV = Math.min(...session.verses.map(v => v.verse_number));
    const maxV = Math.max(...session.verses.map(v => v.verse_number));
    const rangeStr = vCount === 1 ? `${minV}` : `${minV} - ${maxV}`;

    // Auto-record session in history
    window.historyManager.addSessionLog({
      surahId: session.surahId,
      surahName: surah.name_simple,
      verseRange: rangeStr,
      countVerses: vCount,
      repeats: `${session.targetRepeats}x`,
      mode: session.mode === 'per-verse' ? 'Talaqqi (Per-Ayat)' : 'Murajaah (Blok)',
      grade: null,
      notes: 'Latihan pengulangan audio selesai',
      type: 'latihan',
      duration: session.duration || `${session.durationMinutes || 1}m`
    });

    this.showToast(`🎉 Alhamdulillah! Selesai mengulang ${rangeStr} sebanyak ${session.targetRepeats}x!`);
    this.updateStatsUI();
    this.renderHistoryTimeline();
  }

  _populateStatsJuzSelect() {
    const selects = [
      document.getElementById('history-juz-select'),
      document.getElementById('progress-juz-select')
    ].filter(Boolean);

    let optionsHtml = '';
    for (let j = 1; j <= 30; j++) {
      optionsHtml += `<option value="${j}">Juz ${j}</option>`;
    }

    selects.forEach(sel => {
      sel.innerHTML = optionsHtml;
      sel.value = String(this.selectedStatsJuz || 30);
      sel.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10) || 30;
        this.selectedStatsJuz = val;
        localStorage.setItem('satujuz_stats_juz', val);
        this.updateStatsUI(val);
        this.renderHistoryChecklist();
        this.renderProgressSuratTable(val);
      });
    });
  }

  /* --- History & Progress UI --- */
  updateStatsUI(targetJuz) {
    if (targetJuz) {
      this.selectedStatsJuz = parseInt(targetJuz, 10);
      localStorage.setItem('satujuz_stats_juz', this.selectedStatsJuz);
    }
    const currentJuz = this.selectedStatsJuz || 30;
    const stats = window.historyManager.calculateStats(currentJuz);

    // Sync dropdown values
    ['history-juz-select', 'progress-juz-select'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value !== String(currentJuz)) {
        el.value = String(currentJuz);
      }
    });

    // Update Progress Bars
    ['dashboard-progress-fill', 'progress-dashboard-progress-fill'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.width = `${stats.percentageVerses}%`;
    });

    // Update Percentage Texts
    ['dashboard-percentage-text', 'progress-dashboard-percentage-text'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${stats.percentageVerses}% Selesai`;
    });

    // Update Surah Counts: e.g. "0 / 37" for Juz 30, "0 / 2" for Juz 1
    ['stat-surahs-count', 'progress-stat-surahs-count'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${stats.memorizedSurahs} / ${stats.totalSurahs}`;
    });

    // Update Verse Counts: e.g. "0 / 564" for Juz 30, "0 / 148" for Juz 1
    ['stat-verses-count', 'progress-stat-verses-count'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${stats.masteredVersesCount} / ${stats.totalVerses}`;
    });

    // Update Streak Counts
    ['stat-streak-count', 'progress-stat-streak-count'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${stats.currentStreak} Hari`;
    });

    // Update Session Counts
    ['stat-sessions-count', 'progress-stat-sessions-count'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${stats.totalSessions} Sesi`;
    });
  }

  _renderLogsToContainer(container, logList, emptyTitle, emptyDesc, emptyIcon = '📝') {
    if (!container) return;

    if (logList.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${emptyIcon}</div>
          <div class="empty-title">${emptyTitle}</div>
          <div class="empty-desc">${emptyDesc}</div>
        </div>
      `;
      return;
    }

    container.innerHTML = logList.map(log => {
      const dateObj = new Date(log.date);
      const dateStr = dateObj.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const isSetoran = (log.type === 'setoran' || log.repeats === 'Setoran' || log.mode === 'Talaqqi / Uji');
      const cleanVerseRange = (log.verseRange || '')
        .replace(/\s*\(\d+\s*ayat\)/gi, '')
        .replace(/^ayat\s*/gi, '')
        .trim();
      let gradeBadgeHtml = '';
      if (isSetoran && log.grade && log.grade !== 'Lancar (Mumtaz)') {
        let gradeClass = 'grade-jayyid';
        if (log.grade.includes('Mumtaz')) gradeClass = 'grade-mumtaz';
        if (log.grade.includes('Ulang')) gradeClass = 'grade-ulang';
        gradeBadgeHtml = `<span class="timeline-badge ${gradeClass}">${log.grade}</span>`;
      }

      return `
        <div class="timeline-card" data-log-id="${log.id}">
          <div class="timeline-top">
            <span class="timeline-surah-title">${log.surahName}${cleanVerseRange ? ` • ${cleanVerseRange}` : ''}</span>
            <span class="timeline-date">${dateStr}</span>
          </div>
          <div class="timeline-meta-row">
            ${gradeBadgeHtml}
            <span class="timeline-badge" style="background: var(--bg-subtle); color: var(--text-muted);">${log.repeats}</span>
            ${!isSetoran ? `<span class="timeline-badge" style="background: var(--bg-subtle); color: var(--text-muted);">${log.mode}</span>` : ''}
          </div>
          ${log.notes ? `<div class="timeline-notes">"${log.notes}"</div>` : ''}
          <button class="timeline-delete-btn" data-delete-log="${log.id}">Hapus</button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-delete-log]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.deleteLog;
        if (confirm('Hapus catatan riwayat ini?')) {
          window.historyManager.deleteSessionLog(id);
          this.renderHistoryTimeline();
          this.updateStatsUI();
        }
      });
    });
  }

  renderWeeklyGrid() {
    const gridContainer = document.getElementById('history-weekly-grid');
    const titleEl = document.getElementById('weekly-nav-title');
    const metaEl = document.getElementById('weekly-nav-meta');
    if (!gridContainer) return;

    // 1. Calculate Sunday of current target week
    const now = new Date();
    // Midnight base date
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Day of week: 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const dayOfWeek = today.getDay();
    // Sunday of current week (offset = 0)
    const baseSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek);
    
    // Target Sunday with week offset
    const targetSunday = new Date(baseSunday.getFullYear(), baseSunday.getMonth(), baseSunday.getDate() + (this.currentWeekOffset * 7));

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayNamesShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    // 2. Generate 7 days (Sunday = index 0 through Saturday = index 6)
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(targetSunday.getFullYear(), targetSunday.getMonth(), targetSunday.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const isToday = (d.getTime() === today.getTime());

      weekDays.push({
        index: i,
        date: d,
        dateKey: dateKey,
        dayNum: d.getDate(),
        dayName: dayNames[i],
        dayNameShort: dayNamesShort[i],
        monthNameShort: monthNamesShort[d.getMonth()],
        year: d.getFullYear(),
        isToday: isToday,
        logs: []
      });
    }

    // 3. Update Navigation Header
    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    let navTitle = `${firstDay.dayName}, ${firstDay.dayNum} ${firstDay.monthNameShort} – ${lastDay.dayName}, ${lastDay.dayNum} ${lastDay.monthNameShort} ${lastDay.year}`;
    if (firstDay.year !== lastDay.year) {
      navTitle = `${firstDay.dayName}, ${firstDay.dayNum} ${firstDay.monthNameShort} ${firstDay.year} – ${lastDay.dayName}, ${lastDay.dayNum} ${lastDay.monthNameShort} ${lastDay.year}`;
    }
    if (titleEl) titleEl.textContent = navTitle;

    // 4. Fetch and distribute logs
    const allLogs = window.historyManager.getAllLogs();
    let totalWeekSessions = 0;
    let totalWeekMinutes = 0;

    allLogs.forEach(log => {
      if (!log.date) return;
      const logDate = new Date(log.date);
      const logKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
      const targetDay = weekDays.find(d => d.dateKey === logKey);
      if (targetDay) {
        targetDay.logs.push(log);
        totalWeekSessions++;
        const isSetoran = (log.type === 'setoran' || log.repeats === 'Setoran' || log.mode === 'Talaqqi / Uji');
        if (!isSetoran) {
          let mins = 0;
          if (log.duration) {
            const parsed = parseInt(log.duration, 10);
            if (!isNaN(parsed) && parsed > 0) mins = parsed;
          } else {
            const reps = parseInt(log.repeats, 10) || 1;
            const verses = log.countVerses || 1;
            mins = Math.max(1, Math.round(verses * reps * 0.4));
          }
          totalWeekMinutes += mins;
        }
      }
    });

    // Format week summary meta
    let durationFormatted = `${totalWeekMinutes}m`;
    if (totalWeekMinutes >= 60) {
      const hours = Math.floor(totalWeekMinutes / 60);
      const remMins = totalWeekMinutes % 60;
      durationFormatted = remMins > 0 ? `${hours}j ${remMins}m` : `${hours} jam`;
    }
    if (metaEl) {
      const durText = totalWeekMinutes > 0 ? ` • ${durationFormatted}` : '';
      metaEl.textContent = `Total: ${totalWeekSessions} sesi${durText}`;
    }

    // Sort logs within each day chronologically (earliest to latest: ascending time)
    weekDays.forEach(day => {
      day.logs.sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeA - timeB;
      });
    });

    // 5. Render 7 day cards into grid
    gridContainer.innerHTML = weekDays.map((day, idx) => {
      // Calculate day total duration (excluding setoran)
      let dayMins = 0;
      day.logs.forEach(l => {
        const isSetoran = (l.type === 'setoran' || l.repeats === 'Setoran' || l.mode === 'Talaqqi / Uji');
        if (isSetoran) return;
        let m = 0;
        if (l.duration) {
          const p = parseInt(l.duration, 10);
          if (!isNaN(p) && p > 0) m = p;
        } else {
          const r = parseInt(l.repeats, 10) || 1;
          const v = l.countVerses || 1;
          m = Math.max(1, Math.round(v * r * 0.4));
        }
        dayMins += m;
      });

      // Render day sessions (1 baris persesi: waktu, surat & ayat, pengulangan, total waktu)
      let sessionsHtml = '';
      if (day.logs.length === 0) {
        sessionsHtml = `
          <div class="day-empty-row">
            <span class="day-empty-dash">-</span>
            <span class="day-empty-text">Belum ada catatan hafalan</span>
          </div>
        `;
      } else {
        sessionsHtml = day.logs.map(log => {
          const isSetoran = (log.type === 'setoran' || log.repeats === 'Setoran' || log.mode === 'Talaqqi / Uji');
          const repeatText = log.repeats || (isSetoran ? 'Setoran' : '1x');
          const durationText = log.duration || '5m';
          const badgeRepeatClass = isSetoran ? 'strip-badge-setoran' : 'strip-badge-repeat';

          // Extract time (jam berapa)
          let timeStr = '--:--';
          if (log.date) {
            const d = new Date(log.date);
            if (!isNaN(d.getTime())) {
              const hh = String(d.getHours()).padStart(2, '0');
              const mm = String(d.getMinutes()).padStart(2, '0');
              timeStr = `${hh}:${mm}`;
            }
          }

          // Clean verse range: remove (N ayat) suffix and remove leading "Ayat"
          const cleanVerseRange = (log.verseRange || '')
            .replace(/\s*\(\d+\s*ayat\)/gi, '')
            .replace(/^ayat\s*/gi, '')
            .trim();

          return `
            <div class="day-session-strip ${isSetoran ? 'is-setoran' : ''}" ${log.notes ? `title="Catatan: ${log.notes}"` : ''}>
              <div class="strip-time-col" title="Pukul ${timeStr}">
                <span class="strip-time-text">${timeStr}</span>
              </div>
              <div class="strip-surah-col strip-left-content">
                <span class="strip-surah-title">${log.surahName}</span>
                ${cleanVerseRange ? `<span class="strip-verse-range">• ${cleanVerseRange}</span>` : ''}
              </div>
              <div class="strip-meta-col strip-right-content">
                <span class="strip-badge ${badgeRepeatClass}">${repeatText}</span>
                ${!isSetoran ? `<span class="strip-badge strip-badge-time">⏱️ ${durationText}</span>` : ''}
              </div>
            </div>
          `;
        }).join('');
      }

      // Header summary for the day
      let daySummaryHtml = '';
      if (day.logs.length > 0) {
        const durText = dayMins > 0 ? ` • ${dayMins}m` : '';
        daySummaryHtml = `
          <div class="day-header-right">
            <span class="day-summary-pill">${day.logs.length} sesi${durText}</span>
          </div>
        `;
      }

      return `
        <div class="day-block-card ${day.isToday ? 'is-today' : ''}" data-date="${day.dateKey}">
          <div class="day-card-header">
            <div class="day-header-left">
              <span class="day-date-number">${day.dayNum}</span>
              <span class="day-name-tag">${day.dayName}</span>
              <span class="day-full-date-label">${day.dayNum} ${day.monthNameShort} ${day.year}</span>
              ${day.isToday ? '<span class="day-today-indicator">Hari Ini</span>' : ''}
            </div>
            ${daySummaryHtml}
          </div>
          <div class="day-card-body">
            ${sessionsHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  renderHistoryTimeline() {
    this.renderWeeklyGrid();
    const logs = window.historyManager.getAllLogs();
    const latihanLogs = logs.filter(l => l.type === 'latihan' || (l.repeats !== 'Setoran' && l.mode !== 'Talaqqi / Uji'));
    const setoranLogs = logs.filter(l => l.type === 'setoran' || l.repeats === 'Setoran' || l.mode === 'Talaqqi / Uji');

    // 1. Jurnal Latihan (Riwayat Pengulangan Audio)
    const latihanContainer = document.getElementById('history-latihan-list');
    if (latihanContainer) {
      this._renderLogsToContainer(
        latihanContainer,
        latihanLogs,
        'Belum ada riwayat latihan audio',
        'Selesaikan putaran pengulangan ayat di halaman Latihan untuk melihat riwayat latihan audio di sini.',
        '🎧'
      );
    }

    // 2. Jurnal Setoran (Khusus Halaman Setoran)
    const setoranContainer = document.getElementById('history-setoran-list');
    if (setoranContainer) {
      this._renderLogsToContainer(
        setoranContainer,
        setoranLogs,
        'Belum ada catatan setoran',
        'Simpan catatan hafalan di halaman Setoran untuk mendokumentasikan hasil setoran di sini.',
        '📝'
      );
    }

    // Fallback/Legacy containers if any
    const legacyContainer = document.getElementById('history-timeline-list');
    if (legacyContainer) {
      this._renderLogsToContainer(
        legacyContainer,
        setoranLogs,
        'Belum ada catatan setoran',
        'Simpan catatan hafalan di halaman Setoran untuk mendokumentasikan hasil setoran di sini.',
        '📝'
      );
    }
  }

  renderHistoryChecklist() {
    const containers = [
      document.getElementById('history-checklist-list'),
      document.getElementById('progress-checklist-list')
    ].filter(Boolean);

    if (containers.length === 0) return;

    const currentJuz = parseInt(this.selectedStatsJuz || 30, 10);
    const juzInfo = window.JUZ_INFO && window.JUZ_INFO[currentJuz];
    const allSurahsList = this.getAllSurahsList();
    const surahMap = {};
    (allSurahsList || []).forEach(s => { surahMap[s.id] = s; });

    let surahsToRender = [];
    if (juzInfo && Array.isArray(juzInfo.surahs) && juzInfo.surahs.length > 0) {
      surahsToRender = juzInfo.surahs.map(item => {
        const fullSurah = surahMap[item.id] || { id: item.id, name_simple: item.name, verses_count: item.count };
        return {
          id: item.id,
          name_simple: fullSurah.name_simple || item.name,
          name_arabic: fullSurah.name_arabic || '',
          startVerse: item.start,
          endVerse: item.end,
          countInJuz: item.count,
          totalSurahVerses: fullSurah.verses_count || item.count,
          isPartial: (item.start > 1 || item.end < (fullSurah.verses_count || item.count))
        };
      });
    } else {
      // Fallback to Juz 30 surahs (78 - 114)
      surahsToRender = (this.surahs || []).map(s => ({
        id: s.id,
        name_simple: s.name_simple,
        name_arabic: s.name_arabic || '',
        startVerse: 1,
        endVerse: s.verses_count,
        countInJuz: s.verses_count,
        totalSurahVerses: s.verses_count,
        isPartial: false
      }));
    }

    const htmlContent = surahsToRender.map(surahItem => {
      const prog = window.historyManager.getSurahProgress(surahItem.id);
      let masteredCountInJuz = 0;

      if (prog.status === 'mutqin' || prog.status === 'memorized') {
        masteredCountInJuz = surahItem.countInJuz;
      } else if (Array.isArray(prog.masteredVerses)) {
        for (let v = surahItem.startVerse; v <= surahItem.endVerse; v++) {
          if (prog.masteredVerses.includes(v)) {
            masteredCountInJuz++;
          }
        }
      }

      const pct = surahItem.countInJuz > 0 ? Math.round((masteredCountInJuz / surahItem.countInJuz) * 100) : 0;
      const metaText = surahItem.isPartial
        ? `Ayat ${surahItem.startVerse} - ${surahItem.endVerse} (${surahItem.countInJuz} Ayat)`
        : `${surahItem.countInJuz} Ayat`;

      return `
        <div class="surah-card" data-surah-id="${surahItem.id}" style="margin-bottom: 8px; cursor: pointer;">
          <div class="card-left">
            <div class="surah-number-badge">${surahItem.id}</div>
            <div class="surah-info">
              <div class="surah-title-latin">${surahItem.name_simple}</div>
              <div class="surah-meta">${metaText}</div>
              <div class="surah-progress-mini">
                <div class="progress-mini-bar">
                  <div class="progress-mini-fill" style="width: ${pct}%;"></div>
                </div>
                <span class="progress-mini-text">${masteredCountInJuz}/${surahItem.countInJuz} (${pct}%)</span>
              </div>
            </div>
          </div>
          <div class="card-right">
            <select class="status-dropdown" data-checklist-surah="${surahItem.id}">
              <option value="none" ${prog.status === 'none' ? 'selected' : ''}>Belum Mulai</option>
              <option value="memorizing" ${prog.status === 'memorizing' ? 'selected' : ''}>Sedang Dihafal</option>
              <option value="memorized" ${prog.status === 'memorized' ? 'selected' : ''}>Sudah Hafal</option>
              <option value="mutqin" ${prog.status === 'mutqin' ? 'selected' : ''}>⭐ Mutqin</option>
            </select>
          </div>
        </div>
      `;
    }).join('');

    containers.forEach(container => {
      container.innerHTML = htmlContent;
      container.querySelectorAll('[data-checklist-surah]').forEach(sel => {
        sel.addEventListener('change', () => {
          const sId = parseInt(sel.dataset.checklistSurah, 10);
          window.historyManager.setSurahStatus(sId, sel.value);
          this.renderSurahList();
          this.renderHistoryChecklist();
          this.renderProgressSuratTable();
          this.updateStatsUI();
          this.showToast('Status surat diperbarui');
        });
      });
    });
  }

  /* --- Progress Page: Surat Table & Halaman Grid (Sesuai Sketsa Gambar 1 & 2) --- */
  _formatVerseRanges(numbers) {
    if (!numbers || !numbers.length) return '-';
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let prev = start;

    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      if (cur === prev + 1) {
        prev = cur;
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = cur;
        prev = cur;
      }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return ranges.join(', ');
  }

  renderProgressSuratTable(targetJuz) {
    const tbody = document.getElementById('progress-surat-tbody');
    if (!tbody) return;

    const currentJuz = parseInt(targetJuz || this.selectedStatsJuz || 30, 10);
    const cleanHyphenBreaks = str => !str ? str : String(str).replace(/([A-Za-z]+)-/g, '$1\u2011').replace(/(\d+)-(\d+)/g, '$1\u2011$2');

    const formatTableDate = (isoStr) => {
      if (!isoStr) return { text: '-', inputVal: '' };
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return { text: '-', inputVal: '' };
      const day = String(d.getDate()).padStart(2, '0');
      const mon = String(d.getMonth() + 1).padStart(2, '0');
      const yrFull = d.getFullYear();
      const yr2 = String(yrFull).slice(-2);
      const inputVal = `${yrFull}-${mon}-${day}`;
      return { text: `${day}/${mon}/${yr2}`, inputVal };
    };

    const getProgressStatus = (pct, isoStr) => {
      if (!pct || pct === 0) return 'belum';
      if (!isoStr) return 'lancar';
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return 'lancar';
      const now = new Date();
      const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.floor((nowDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 7 ? 'murojaah' : 'lancar';
    };

    // --- JUZ 1 - 29: PECAH SURAT MENJADI AYAT-AYAT DI HALAMAN (Sesuai Permintaan Pengguna) ---
    if (currentJuz >= 1 && currentJuz <= 29 && typeof window.getJuzPagesInfo === 'function') {
      const pages = window.getJuzPagesInfo(currentJuz);
      const rowsHtml = pages.map(pg => {
        let totalPageVerses = 0;
        let totalMasteredInPage = 0;
        const hafalanParts = [];
        const isPageMastered = window.historyManager.isPageMastered(pg.mushafPage);

        pg.parts.forEach(part => {
          totalPageVerses += part.count;
          let masteredInPart = [];
          if (isPageMastered) {
            for (let v = part.start; v <= part.end; v++) masteredInPart.push(v);
          } else {
            const prog = window.historyManager.getSurahProgress(part.surahId);
            if (prog.status === 'mutqin' || prog.status === 'memorized') {
              for (let v = part.start; v <= part.end; v++) masteredInPart.push(v);
            } else if (Array.isArray(prog.masteredVerses)) {
              masteredInPart = prog.masteredVerses.filter(v => v >= part.start && v <= part.end);
            }
          }
          totalMasteredInPage += masteredInPart.length;
          if (masteredInPart.length > 0) {
            const rangeFormatted = this._formatVerseRanges(masteredInPart);
            if (pg.parts.length > 1) {
              hafalanParts.push(`${part.surahName} ${rangeFormatted}`);
            } else {
              hafalanParts.push(rangeFormatted);
            }
          }
        });

        const pct = totalPageVerses > 0 ? Math.round((totalMasteredInPage / totalPageVerses) * 100) : 0;
        const hafalanText = hafalanParts.length > 0 ? hafalanParts.join('; ') : '-';
        const primaryPart = pg.parts[0] || { surahId: 1, start: 1, end: 1 };

        let rawDate = null;
        if (totalMasteredInPage > 0 || isPageMastered) {
          rawDate = window.historyManager.getPageDate(pg.mushafPage);
          if (!rawDate) {
            for (const part of pg.parts) {
              const d = window.historyManager.getSurahDate(part.surahId);
              if (d && (!rawDate || new Date(d) > new Date(rawDate))) {
                rawDate = d;
              }
            }
          }
        }
        const dateInfo = formatTableDate(rawDate);
        const progressStatus = getProgressStatus(pct, rawDate);
        const progressTitle = progressStatus === 'murojaah'
          ? 'Perlu Murojaah (> 7 hari tidak diupdate)'
          : progressStatus === 'lancar'
            ? 'Lancar (diupdate dalam 7 hari)'
            : 'Belum Dihafal';

        return `
          <tr data-page-mushaf="${pg.mushafPage}" data-surah-id="${primaryPart.surahId}" data-start-verse="${primaryPart.start}" data-end-verse="${primaryPart.end}" title="Klik untuk latihan & hafalan ${pg.surahText}">
            <td class="col-surat">
              <div class="surat-title-cell">${cleanHyphenBreaks(pg.surahText)}</div>
              <span class="surat-range-badge">Mushaf Hal. ${pg.mushafPage}</span>
            </td>
            <td class="col-hafalan ${totalMasteredInPage === 0 ? 'cell-empty' : ''}">
              <span class="hafalan-range-cell ${totalMasteredInPage === 0 ? 'empty' : ''}">${cleanHyphenBreaks(hafalanText)}</span>
            </td>
            <td class="col-persen">
              <div class="table-progress-cell" title="${progressTitle}">
                <div class="table-progress-track ${progressStatus === 'belum' ? 'track-belum' : ''}">
                  <div class="table-progress-fill fill-${progressStatus}" style="width: ${pct}%;"></div>
                </div>
                <span class="table-progress-text ${progressStatus === 'belum' ? 'text-belum' : ''}">${pct}%</span>
              </div>
            </td>
            <td class="col-tanggal" title="${dateInfo.text !== '-' ? 'Tanggal Hafalan: ' + dateInfo.text : 'Klik untuk atur tanggal'}">
              <div class="date-cell-wrapper">
                <span class="table-date-cell ${dateInfo.text !== '-' ? 'has-date' : 'empty'}">${dateInfo.text}</span>
                <input type="date" class="table-date-picker" value="${dateInfo.inputVal}" title="Ubah tanggal">
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rowsHtml;

      tbody.querySelectorAll('.table-date-picker').forEach(picker => {
        picker.addEventListener('change', (e) => {
          e.stopPropagation();
          const val = e.target.value;
          const row = e.target.closest('tr');
          if (!row) return;
          const pageNum = parseInt(row.dataset.pageMushaf, 10);
          window.historyManager.setPageDate(pageNum, val);
          this.renderProgressSuratTable(currentJuz);
        });
      });

      tbody.querySelectorAll('tr[data-surah-id]').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input') || e.target.closest('.col-tanggal')) return;
          const sId = parseInt(row.dataset.surahId, 10);
          const fromV = parseInt(row.dataset.startVerse, 10);
          const toV = parseInt(row.dataset.endVerse, 10);
          if (sId) this.openSurahDetailSheet(sId, fromV, toV);
        });
      });
      return;
    }

    // --- JUZ 30: RENDER PER-SURAT (Sesuai Sketsa Gambar 1: An-Nas 114 s/d An-Naba 78) ---
    const juzInfo = window.JUZ_INFO && window.JUZ_INFO[currentJuz];
    const allSurahsList = this.getAllSurahsList();
    const surahMap = {};
    (allSurahsList || []).forEach(s => { surahMap[s.id] = s; });

    let surahsInJuz = [];
    if (juzInfo && Array.isArray(juzInfo.surahs) && juzInfo.surahs.length > 0) {
      surahsInJuz = [...juzInfo.surahs];
    } else {
      surahsInJuz = (this.surahs || []).map(s => ({
        id: s.id,
        name: s.name_simple,
        start: 1,
        end: s.verses_count,
        count: s.verses_count
      }));
    }

    // In Juz 30, sort descending (An-Nas down to An-Naba)
    surahsInJuz.sort((a, b) => b.id - a.id);

    const rowsHtml = surahsInJuz.map(item => {
      const fullSurah = surahMap[item.id] || { id: item.id, name_simple: item.name, verses_count: item.count };
      const surahName = fullSurah.name_simple || item.name;
      const surahVerseRange = `${item.start}-${item.end}`;

      const prog = window.historyManager.getSurahProgress(item.id);
      let masteredVersesInJuz = [];

      if (prog.status === 'mutqin' || prog.status === 'memorized') {
        for (let v = item.start; v <= item.end; v++) {
          masteredVersesInJuz.push(v);
        }
      } else if (Array.isArray(prog.masteredVerses)) {
        masteredVersesInJuz = prog.masteredVerses.filter(v => v >= item.start && v <= item.end);
      }

      const countMastered = masteredVersesInJuz.length;
      const pct = item.count > 0 ? Math.round((countMastered / item.count) * 100) : 0;
      const hafalanText = countMastered > 0 ? this._formatVerseRanges(masteredVersesInJuz) : '-';

      let rawDate = null;
      if (countMastered > 0 || prog.status === 'memorized' || prog.status === 'mutqin') {
        rawDate = window.historyManager.getSurahDate(item.id);
      }
      const dateInfo = formatTableDate(rawDate);
      const progressStatus = getProgressStatus(pct, rawDate);
      const progressTitle = progressStatus === 'murojaah'
        ? 'Perlu Murojaah (> 7 hari tidak diupdate)'
        : progressStatus === 'lancar'
          ? 'Lancar (diupdate dalam 7 hari)'
          : 'Belum Dihafal';

      return `
        <tr data-surah-id="${item.id}" title="Klik untuk lihat detail ${surahName}">
          <td class="col-surat">
            <div class="surat-title-cell">${cleanHyphenBreaks(surahName + ' ' + surahVerseRange)}</div>
          </td>
          <td class="col-hafalan ${countMastered === 0 ? 'cell-empty' : ''}">
            <span class="hafalan-range-cell ${countMastered === 0 ? 'empty' : ''}">${cleanHyphenBreaks(hafalanText)}</span>
          </td>
          <td class="col-persen">
            <div class="table-progress-cell" title="${progressTitle}">
              <div class="table-progress-track ${progressStatus === 'belum' ? 'track-belum' : ''}">
                <div class="table-progress-fill fill-${progressStatus}" style="width: ${pct}%;"></div>
              </div>
              <span class="table-progress-text ${progressStatus === 'belum' ? 'text-belum' : ''}">${pct}%</span>
            </div>
          </td>
          <td class="col-tanggal" title="${dateInfo.text !== '-' ? 'Tanggal Hafalan: ' + dateInfo.text : 'Klik untuk atur tanggal'}">
            <div class="date-cell-wrapper">
              <span class="table-date-cell ${dateInfo.text !== '-' ? 'has-date' : 'empty'}">${dateInfo.text}</span>
              <input type="date" class="table-date-picker" value="${dateInfo.inputVal}" title="Ubah tanggal">
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;

    tbody.querySelectorAll('.table-date-picker').forEach(picker => {
      picker.addEventListener('change', (e) => {
        e.stopPropagation();
        const val = e.target.value;
        const row = e.target.closest('tr');
        if (!row) return;
        const surahId = parseInt(row.dataset.surahId, 10);
        window.historyManager.setSurahDate(surahId, val);
        this.renderProgressSuratTable(currentJuz);
      });
    });

    tbody.querySelectorAll('tr[data-surah-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input') || e.target.closest('.col-tanggal')) return;
        const sId = parseInt(row.dataset.surahId, 10);
        if (sId) this.openSurahDetailSheet(sId);
      });
    });
  }

  renderProgressHalamanGrid(targetJuz) {
    const gridEl = document.getElementById('progress-halaman-grid');
    const summaryEl = document.getElementById('halaman-summary-text');
    if (!gridEl) return;

    const currentJuz = parseInt(targetJuz || this.selectedStatsJuz || 30, 10);
    const pageStats = window.historyManager.calculatePageStats(currentJuz);

    if (summaryEl) {
      summaryEl.textContent = `${pageStats.masteredPagesCount} / ${pageStats.totalPages} Halaman Hafal (${pageStats.percentage}%)`;
    }

    let boxesHtml = '';
    for (let p = pageStats.pageStart; p <= pageStats.pageEnd; p++) {
      const isDone = window.historyManager.isPageMastered(p);
      boxesHtml += `
        <div class="halaman-box ${isDone ? 'is-mastered' : ''}" data-page="${p}" title="Halaman ${p}: ${isDone ? 'Sudah Hafal' : 'Klik untuk tandai hafal'}">
          <span class="halaman-box-num">${p}</span>
        </div>
      `;
    }
    gridEl.innerHTML = boxesHtml;

    // Attach click listeners to toggle page mastery
    gridEl.querySelectorAll('.halaman-box').forEach(box => {
      box.addEventListener('click', () => {
        const pageNum = parseInt(box.dataset.page, 10);
        const newState = window.historyManager.togglePageMastery(pageNum);
        this.renderProgressHalamanGrid(currentJuz);
        this.updateStatsUI(currentJuz);
        this.showToast(newState ? `Halaman ${pageNum} ditandai hafal ⭐` : `Halaman ${pageNum} diatur ulang`);
      });
    });
  }

  _populateSetoranModal() {
    const selSurah = document.getElementById('setoran-surah-select');
    if (!selSurah) return;
    const allSurahs = this.getAllSurahsList();
    if (!allSurahs || !allSurahs.length) return;

    const targetSurahId = this.selectedSurah ? this.selectedSurah.id : (allSurahs[0] ? allSurahs[0].id : 1);

    selSurah.innerHTML = allSurahs.map(s => `
      <option value="${s.id}" ${s.id === targetSurahId ? 'selected' : ''}>
        ${s.id}. ${s.name_simple} (${s.verses_count} Ayat) - ${s.name_arabic || ''}
      </option>
    `).join('');

    const defaultSurah = allSurahs.find(s => s.id === targetSurahId) || allSurahs[0];
    const fromInput = document.getElementById('setoran-from');
    const toInput = document.getElementById('setoran-to');
    if (fromInput) fromInput.value = 1;
    if (toInput && defaultSurah) toInput.value = defaultSurah.verses_count;

    selSurah.onchange = () => {
      const s = allSurahs.find(item => item.id === parseInt(selSurah.value, 10));
      if (s) {
        if (fromInput) fromInput.value = 1;
        if (toInput) toInput.value = s.verses_count;
      }
    };
  }

  _handleSaveSetoran() {
    const modal = document.getElementById('modal-setoran');
    const submitBtn = modal ? modal.querySelector('button[type="submit"]') : null;
    if (submitBtn && submitBtn.disabled) return;
    if (submitBtn) submitBtn.disabled = true;

    const selSurah = document.getElementById('setoran-surah-select');
    if (!selSurah) {
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    const surahId = parseInt(selSurah.value, 10);
    const allSurahs = this.getAllSurahsList();
    const surah = allSurahs.find(s => s.id === surahId);
    if (!surah) {
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    const fromInput = document.getElementById('setoran-from');
    const toInput = document.getElementById('setoran-to');
    const from = parseInt(fromInput ? fromInput.value : '1', 10) || 1;
    const to = parseInt(toInput ? toInput.value : '1', 10) || 1;
    const gradeEl = document.getElementById('setoran-grade');
    const grade = gradeEl ? gradeEl.value : 'Lancar (Jayyid)';
    const notesEl = document.getElementById('setoran-notes');
    const notes = notesEl ? notesEl.value : '';

    const count = Math.max(1, to - from + 1);
    const rangeStr = from === to ? `${from}` : `${from} - ${to}`;

    // Auto mark verses in history if Mumtaz or Jayyid
    if (grade.includes('Mumtaz') || grade.includes('Jayyid')) {
      for (let i = from; i <= to; i++) {
        const prog = window.historyManager.getSurahProgress(surahId);
        if (!prog.masteredVerses.includes(i)) {
          window.historyManager.toggleVerseMastery(surahId, i, surah.verses_count);
        }
      }
    }

    window.historyManager.addSessionLog({
      surahId: surah.id,
      surahName: surah.name_simple,
      verseRange: rangeStr,
      countVerses: count,
      repeats: 'Setoran',
      mode: 'Talaqqi / Uji',
      grade: grade,
      notes: notes,
      type: 'setoran',
      duration: null
    });

    if (modal) modal.classList.remove('active');
    if (submitBtn) submitBtn.disabled = false;
    this.showToast('Catatan setoran hafalan berhasil disimpan!');
    this.renderSurahList();
    this.updateStatsUI();
    this.renderHistoryTimeline();
    this.renderHistoryChecklist();
  }

  /* --- Setoran Page Functions --- */
  _populateSetoranPage() {
    const selSurah = document.getElementById('page-setoran-surah-select');
    const allSurahs = this.getAllSurahsList();
    if (!selSurah || !allSurahs || !allSurahs.length) return;

    let targetSurahId;
    if (this.selectedSurah && this._lastSyncedSetoranSurahId !== this.selectedSurah.id) {
      targetSurahId = this.selectedSurah.id;
      this._lastSyncedSetoranSurahId = this.selectedSurah.id;
    } else {
      const curVal = selSurah.value ? parseInt(selSurah.value, 10) : null;
      targetSurahId = curVal || (this.selectedSurah ? this.selectedSurah.id : 1);
    }

    if (selSurah.children.length !== allSurahs.length) {
      selSurah.innerHTML = allSurahs.map(s => `
        <option value="${s.id}">
          ${s.id}. ${s.name_simple} (${s.verses_count} Ayat) - ${s.name_arabic || ''}
        </option>
      `).join('');
    }

    selSurah.value = String(targetSurahId);

    const currentSurah = allSurahs.find(s => s.id === targetSurahId) || allSurahs[0];
    const fromInput = document.getElementById('page-setoran-from');
    const toInput = document.getElementById('page-setoran-to');
    if (fromInput) fromInput.value = 1;
    if (toInput && currentSurah) toInput.value = currentSurah.verses_count;

    selSurah.onchange = () => {
      const s = allSurahs.find(item => item.id === parseInt(selSurah.value, 10));
      if (s) {
        this._lastSyncedSetoranSurahId = s.id;
        if (fromInput) fromInput.value = 1;
        if (toInput) toInput.value = s.verses_count;
        this._enablePageSetoranSubmit();
      }
    };
  }

  _disablePageSetoranSubmit() {
    const submitBtn = document.getElementById('page-btn-submit-setoran');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Tersimpan ✓';
    }
  }

  _enablePageSetoranSubmit() {
    const submitBtn = document.getElementById('page-btn-submit-setoran');
    if (submitBtn && submitBtn.disabled) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Simpan Catatan';
    }
  }

  _handleSavePageSetoran() {
    const submitBtn = document.getElementById('page-btn-submit-setoran');
    if (submitBtn && submitBtn.disabled) return;

    const selSurah = document.getElementById('page-setoran-surah-select');
    if (!selSurah) return;
    const surahId = parseInt(selSurah.value, 10);
    const allSurahs = this.getAllSurahsList();
    const surah = allSurahs.find(s => s.id === surahId);
    if (!surah) return;

    const fromInput = document.getElementById('page-setoran-from');
    const toInput = document.getElementById('page-setoran-to');
    const from = parseInt(fromInput ? fromInput.value : '1', 10) || 1;
    const to = parseInt(toInput ? toInput.value : '1', 10) || 1;
    const gradeEl = document.getElementById('page-setoran-grade');
    const grade = gradeEl ? gradeEl.value : 'Lancar (Jayyid)';
    const notesEl = document.getElementById('page-setoran-notes');
    const notes = notesEl ? notesEl.value : '';

    const count = Math.max(1, to - from + 1);
    const rangeStr = from === to ? `${from}` : `${from} - ${to}`;

    // Auto mark verses in history if Mumtaz or Jayyid
    if (grade.includes('Mumtaz') || grade.includes('Jayyid')) {
      for (let i = from; i <= to; i++) {
        const prog = window.historyManager.getSurahProgress(surahId);
        if (!prog.masteredVerses.includes(i)) {
          window.historyManager.toggleVerseMastery(surahId, i, surah.verses_count);
        }
      }
    }

    window.historyManager.addSessionLog({
      surahId: surah.id,
      surahName: surah.name_simple,
      verseRange: rangeStr,
      countVerses: count,
      repeats: 'Setoran',
      mode: 'Talaqqi / Uji',
      grade: grade,
      notes: notes,
      type: 'setoran',
      duration: null
    });

    if (notesEl) notesEl.value = '';
    this.showToast('Catatan setoran hafalan berhasil disimpan!');
    this.renderSurahList();
    this.updateStatsUI();
    this.renderHistoryTimeline();
    this.renderHistoryChecklist();

    // Disable submit button until user modifies the form
    this._disablePageSetoranSubmit();
  }

  /* --- Profile Management UI Methods --- */
  _setupProfileCallbacks() {
    window.historyManager.onProfileChange = (profile) => {
      this._updateHeaderProfileUI();
      this.renderSurahList();
      const juz = this.selectedStatsJuz || 30;
      this.updateStatsUI(juz);
      this.renderProgressSuratTable(juz);
      this.renderWeeklyGrid();
      this.renderHistoryTimeline();
      this.renderHistoryChecklist();
      if (this.currentTab === 'setoran') {
        this._populateSetoranPage();
      }
    };
  }

  _updateHeaderProfileUI() {
    const active = window.historyManager.getActiveProfile();
    const nameEl = document.getElementById('header-profile-name');
    const badgeEl = document.getElementById('header-avatar-badge');
    if (nameEl) {
      nameEl.textContent = active.name || 'Santri';
    }
    if (badgeEl) {
      const initial = (active.name || 'S').trim().substring(0, 2).toUpperCase();
      badgeEl.textContent = initial;
      badgeEl.style.background = active.avatarColor || '#0d9488';
    }
  }

  _openProfileModal() {
    const modal = document.getElementById('modal-profile');
    if (!modal) return;
    this._renderProfileList();
    const formAdd = document.getElementById('form-add-profile');
    if (formAdd) formAdd.style.display = 'none';
    const editSec = document.getElementById('edit-profile-section');
    if (editSec) editSec.style.display = 'none';
    modal.classList.add('active');
  }

  _renderProfileList() {
    const container = document.getElementById('profile-cards-container');
    if (!container) return;

    const profiles = window.historyManager.getProfiles();
    const activeProfile = window.historyManager.getActiveProfile();

    let html = '';
    profiles.forEach(p => {
      const isActive = (p.id === activeProfile.id);
      const initial = (p.name || 'S').trim().substring(0, 2).toUpperCase();
      const color = p.avatarColor || '#0d9488';

      // Load state for quick stats
      const state = window.historyManager._loadStateForProfile(p.id);
      let masteredCount = 0;
      if (state && state.surahProgress) {
        Object.values(state.surahProgress).forEach(sp => {
          if (sp.status === 'memorized' || sp.status === 'mutqin') masteredCount++;
        });
      }
      const logsCount = (state && Array.isArray(state.sessionLogs)) ? state.sessionLogs.length : 0;
      const statsText = `${masteredCount} Surat Hafal • ${logsCount} Catatan`;

      html += `
        <div class="profile-card-item ${isActive ? 'active' : ''}" data-profile-id="${p.id}">
          <div class="profile-card-left" onclick="window.app._handleSwitchProfile('${p.id}')">
            <div class="profile-avatar-medium" style="background:${color};">
              ${initial}
            </div>
            <div class="profile-info">
              <div class="profile-name-row">
                <span class="profile-card-name">${p.name}</span>
                ${isActive ? '<span class="profile-active-tag">Aktif</span>' : ''}
              </div>
              <div class="profile-card-stats">${statsText}</div>
            </div>
          </div>
          <div class="profile-card-actions">
            <button type="button" class="btn-profile-action" title="Ubah Nama" onclick="window.app._handleStartEditProfile('${p.id}')">✏️</button>
            ${profiles.length > 1 ? `<button type="button" class="btn-profile-action" title="Hapus Profil" onclick="window.app._handleDeleteProfile('${p.id}')">🗑️</button>` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  _handleSwitchProfile(profileId) {
    const target = window.historyManager.switchProfile(profileId);
    const modal = document.getElementById('modal-profile');
    if (modal) modal.classList.remove('active');
    if (target) {
      this.showToast(`Beralih ke profil: ${target.name} 👤`);
    }
  }

  _handleCreateProfile() {
    const input = document.getElementById('input-new-profile-name');
    const name = input ? input.value.trim() : '';
    if (!name) {
      this.showToast('Silakan masukkan nama profil terlebih dahulu');
      return;
    }

    const activeDot = document.querySelector('#profile-color-picker .color-dot.active');
    const color = activeDot ? activeDot.dataset.color : '#0d9488';

    const newProfile = window.historyManager.createProfile(name, color);
    window.historyManager.switchProfile(newProfile.id);

    const modal = document.getElementById('modal-profile');
    if (modal) modal.classList.remove('active');
    this.showToast(`Profil ${newProfile.name} berhasil dibuat & aktif! 🎉`);
  }

  _handleStartEditProfile(profileId) {
    const prof = window.historyManager.getProfiles().find(p => p.id === profileId);
    if (!prof) return;

    const editSec = document.getElementById('edit-profile-section');
    const formAdd = document.getElementById('form-add-profile');
    if (formAdd) formAdd.style.display = 'none';

    if (editSec) {
      editSec.style.display = 'block';
      const nameInput = document.getElementById('input-edit-profile-name');
      const idInput = document.getElementById('input-edit-profile-id');
      if (nameInput) {
        nameInput.value = prof.name;
        nameInput.focus();
      }
      if (idInput) idInput.value = prof.id;
    }
  }

  _handleUpdateProfile() {
    const nameInput = document.getElementById('input-edit-profile-name');
    const idInput = document.getElementById('input-edit-profile-id');
    const newName = nameInput ? nameInput.value.trim() : '';
    const profId = idInput ? idInput.value : '';

    if (!newName) {
      this.showToast('Nama profil tidak boleh kosong');
      return;
    }

    window.historyManager.updateProfile(profId, { name: newName });
    const editSec = document.getElementById('edit-profile-section');
    if (editSec) editSec.style.display = 'none';

    this._renderProfileList();
    this._updateHeaderProfileUI();
    this.showToast('Nama profil berhasil diperbarui ✓');
  }

  _handleDeleteProfile(profileId) {
    const prof = window.historyManager.getProfiles().find(p => p.id === profileId);
    if (!prof) return;

    if (confirm(`Hapus profil "${prof.name}" beserta seluruh catatan dan progres hafalannya?`)) {
      const res = window.historyManager.deleteProfile(profileId);
      if (res.success) {
        this._renderProfileList();
        this._updateHeaderProfileUI();
        this.showToast(`Profil ${prof.name} telah dihapus.`);
      } else {
        this.showToast(res.message || 'Gagal menghapus profil.');
      }
    }
  }

  /* --- Helper to Clean Footnotes and HTML Tags from Translation Text --- */
  cleanTranslation(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+([,.;?!:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /* --- Feedback Toast Helper --- */
  showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.getElementById('app-viewport').appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }
}

// Instantiate on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new HafalanApp();
});
