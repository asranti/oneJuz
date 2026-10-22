/**
 * QuranAudioPlayer - Dedicated audio engine for Quran repetition & memorization (Tikrar)
 * Features:
 * - Single verse or multi-verse playback
 * - Repetition counts: 1x, 3x, 5x, 7x, 10x, 20x, 40x, or Custom / Loop
 * - Two modes:
 *     1) 'per-verse' (Talaqqi: repeats current verse N times before moving to next)
 *     2) 'block' (Muraja'ah: plays all selected verses in sequence, then repeats the block N times)
 * - Echo delay between repeats for user recitation
 * - Speed controller (0.75x - 1.25x)
 */
class QuranAudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    // State
    this.surahId = null;
    this.surahName = '';
    this.selectedVerses = []; // Array of verse objects: [{ id, verse_number, verse_key, text_uthmani, translation }]
    this.audioUrlMap = {};    // { '112:1': 'https://...' }
    
    this.mode = 'per-verse';  // 'per-verse' | 'block'
    this.targetRepeats = 3;   // e.g. 3, 5, 7, 40, or Infinity
    this.currentRepeat = 1;
    this.currentVerseIndex = 0;
    this.playbackRate = 1.0;
    this.reciterId = 7;       // Default: Mishari Rashid al-`Afasy
    
    this.delaySeconds = 1.5;   // Silence gap between repeats to let user recite
    this.delayTimer = null;
    this.isDelaying = false;
    this.delayRemaining = 0;
    this.delayInterval = null;

    this.isPlaying = false;
    this.isPaused = false;
    this.sessionStartTime = null;
    
    // Callbacks
    this.onStateChange = null;
    this.onVerseChange = null;
    this.onSessionComplete = null;
    this.onError = null;

    this._setupAudioListeners();
  }

  _setupAudioListeners() {
    this.audio.addEventListener('ended', () => {
      this._handleVerseEnded();
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('Audio playback error:', e);
      if (this.onError) {
        this.onError('Gagal memuat audio untuk ayat ini. Memeriksa koneksi...');
      }
      // If error occurs, advance after a short pause
      setTimeout(() => {
        if (this.isPlaying) {
          this._handleVerseEnded();
        }
      }, 1500);
    });

    this.audio.addEventListener('timeupdate', () => {
      this._notifyState();
    });
  }

  /**
   * Load a session for memorization
   */
  async loadSession({ surahId, surahName, selectedVerses, targetRepeats = 3, mode = 'per-verse', reciterId = 7 }) {
    this.stop();
    this.surahId = surahId;
    this.surahName = surahName || `Surat ke-${surahId}`;
    this.selectedVerses = selectedVerses || [];
    this.targetRepeats = targetRepeats === 'infinite' ? Infinity : parseInt(targetRepeats, 10);
    this.mode = mode;
    this.reciterId = reciterId;
    this.currentVerseIndex = 0;
    this.currentRepeat = 1;

    // Load audio URLs from API
    try {
      this.audioUrlMap = await window.quranApi.getSurahAudio(surahId, reciterId);
    } catch (e) {
      console.error('Failed to load audio for surah:', e);
    }

    this._notifyState();
  }

  setTargetRepeats(count) {
    this.targetRepeats = count === 'infinite' ? Infinity : Math.max(1, parseInt(count, 10));
    this._notifyState();
  }

  setMode(mode) {
    if (mode === 'per-verse' || mode === 'block') {
      this.mode = mode;
      this._notifyState();
    }
  }

  setDelaySeconds(seconds) {
    this.delaySeconds = Math.max(0, parseFloat(seconds));
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
    this.audio.playbackRate = rate;
    this._notifyState();
  }

  async setReciter(reciterId) {
    this.reciterId = reciterId;
    if (this.surahId) {
      const wasPlaying = this.isPlaying && !this.isPaused;
      this.audioUrlMap = await window.quranApi.getSurahAudio(this.surahId, reciterId);
      if (wasPlaying) {
        this._playCurrentVerse();
      }
    }
  }

  /**
   * Play or resume
   */
  play() {
    if (this.selectedVerses.length === 0) return;

    if (!this.sessionStartTime) {
      this.sessionStartTime = Date.now();
    }

    if (this.isPaused && this.audio.src) {
      this.isPaused = false;
      this.isPlaying = true;
      this.audio.play().catch(e => console.warn('Play error:', e));
      this._notifyState();
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this._playCurrentVerse();
  }

  pause() {
    this._clearDelay();
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
    this.isPaused = true;
    this._notifyState();
  }

  stop() {
    this._clearDelay();
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.currentVerseIndex = 0;
    this.currentRepeat = 1;
    this.sessionStartTime = null;
    this._notifyState();
  }

  next() {
    this._clearDelay();
    if (this.currentVerseIndex < this.selectedVerses.length - 1) {
      this.currentVerseIndex++;
      this.currentRepeat = 1;
      if (this.isPlaying) {
        this._playCurrentVerse();
      } else {
        this._notifyState();
      }
    }
  }

  prev() {
    this._clearDelay();
    if (this.currentVerseIndex > 0) {
      this.currentVerseIndex--;
      this.currentRepeat = 1;
      if (this.isPlaying) {
        this._playCurrentVerse();
      } else {
        this._notifyState();
      }
    }
  }

  jumpToVerseIndex(index) {
    if (index >= 0 && index < this.selectedVerses.length) {
      this._clearDelay();
      this.currentVerseIndex = index;
      this.currentRepeat = 1;
      if (this.isPlaying) {
        this._playCurrentVerse();
      } else {
        this._notifyState();
      }
    }
  }

  _getCurrentVerse() {
    return this.selectedVerses[this.currentVerseIndex] || null;
  }

  _playCurrentVerse() {
    const verse = this._getCurrentVerse();
    if (!verse) {
      this.stop();
      return;
    }

    const audioUrl = this.audioUrlMap[verse.verse_key];
    if (!audioUrl) {
      console.warn('Audio URL missing for verse:', verse.verse_key);
      this._handleVerseEnded();
      return;
    }

    if (this.audio.src !== audioUrl) {
      this.audio.src = audioUrl;
    }
    this.audio.playbackRate = this.playbackRate;
    this.audio.currentTime = 0;

    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.warn('Playback error or browser autoplay policy:', error);
      });
    }

    if (this.onVerseChange) {
      this.onVerseChange(verse, this.currentVerseIndex);
    }
    this._notifyState();
  }

  _handleVerseEnded() {
    if (!this.isPlaying) return;

    // Apply delay between repeats if configured (Echo/recitation time)
    const delay = this.delaySeconds > 0 ? this.delaySeconds * 1000 : 0;

    if (delay > 0) {
      this.isDelaying = true;
      this.delayRemaining = Math.ceil(this.delaySeconds);
      this._notifyState();

      this.delayInterval = setInterval(() => {
        this.delayRemaining--;
        if (this.delayRemaining <= 0) {
          clearInterval(this.delayInterval);
          this.delayInterval = null;
        }
        this._notifyState();
      }, 1000);

      this.delayTimer = setTimeout(() => {
        this.isDelaying = false;
        this._proceedAfterDelay();
      }, delay);
    } else {
      this._proceedAfterDelay();
    }
  }

  _proceedAfterDelay() {
    this._clearDelay();

    if (this.mode === 'per-verse') {
      // Talaqqi Mode: Repeat current verse N times before moving to next verse
      if (this.currentRepeat < this.targetRepeats) {
        this.currentRepeat++;
        this._playCurrentVerse();
      } else {
        // Target repeat for this verse reached!
        if (this.currentVerseIndex < this.selectedVerses.length - 1) {
          // Move to next verse
          this.currentVerseIndex++;
          this.currentRepeat = 1;
          this._playCurrentVerse();
        } else {
          // Finished all selected verses with their full repeats!
          this._handleSessionFinished();
        }
      }
    } else {
      // Block Mode: Play all selected verses in sequence (1 -> 2 -> 3), then repeat entire block N times
      if (this.currentVerseIndex < this.selectedVerses.length - 1) {
        // Move to next verse in the block
        this.currentVerseIndex++;
        this._playCurrentVerse();
      } else {
        // Reached end of block! Check block repeat counter
        if (this.currentRepeat < this.targetRepeats) {
          this.currentRepeat++;
          this.currentVerseIndex = 0; // restart block
          this._playCurrentVerse();
        } else {
          // Finished all block repeats!
          this._handleSessionFinished();
        }
      }
    }
  }

  _clearDelay() {
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.delayInterval) {
      clearInterval(this.delayInterval);
      this.delayInterval = null;
    }
    this.isDelaying = false;
    this.delayRemaining = 0;
  }

  _handleSessionFinished() {
    const elapsedMs = this.sessionStartTime ? (Date.now() - this.sessionStartTime) : 0;
    const elapsedMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    const durationStr = `${elapsedMinutes}m`;

    this.stop();
    if (this.onSessionComplete) {
      this.onSessionComplete({
        surahId: this.surahId,
        surahName: this.surahName,
        verses: this.selectedVerses,
        targetRepeats: this.targetRepeats === Infinity ? 'Loop' : this.targetRepeats,
        mode: this.mode,
        duration: durationStr,
        durationMinutes: elapsedMinutes,
        completedAt: new Date().toISOString()
      });
    }
  }

  _notifyState() {
    if (typeof this.onStateChange === 'function') {
      const currentVerse = this._getCurrentVerse();
      this.onStateChange({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        isDelaying: this.isDelaying,
        delayRemaining: this.delayRemaining,
        currentVerse,
        currentVerseIndex: this.currentVerseIndex,
        totalSelected: this.selectedVerses.length,
        currentRepeat: this.currentRepeat,
        targetRepeats: this.targetRepeats,
        mode: this.mode,
        currentTime: this.audio.currentTime || 0,
        duration: this.audio.duration || 0,
        playbackRate: this.playbackRate,
        reciterId: this.reciterId
      });
    }
  }
}

// Global instance
window.quranPlayer = new QuranAudioPlayer();
