/**
 * HistoryManager - Manages memorization progress, status per surah/verse, and activity log.
 * Data is persisted locally in LocalStorage with JSON Export/Import capabilities.
 */
class HistoryManager {
  constructor() {
    this.metaStorageKey = 'satujuz_profiles_meta_v1';
    this.profileDataPrefix = 'satujuz_profile_data_';
    this.legacyStorageKey = 'hafalan_juz30_progress_v1';

    this.onProfileChange = null;

    this.profilesMeta = this._initProfilesMeta();
    this.activeProfileId = this.profilesMeta.activeProfileId;
    this.state = this._loadStateForProfile(this.activeProfileId);

    // Auto-clean duplicate history inputs across all profiles (including "Asri")
    this.deduplicateAllProfiles();
  }

  _initProfilesMeta() {
    try {
      const saved = localStorage.getItem(this.metaStorageKey);
      if (saved) {
        const meta = JSON.parse(saved);
        if (meta && Array.isArray(meta.profiles) && meta.profiles.length > 0 && meta.activeProfileId) {
          if (!meta.profiles.some(p => p.id === meta.activeProfileId)) {
            meta.activeProfileId = meta.profiles[0].id;
          }
          return meta;
        }
      }
    } catch (e) {
      console.warn('Could not read profiles meta:', e);
    }

    // Default first profile
    const defaultProfileId = 'profile_default';
    const defaultProfile = {
      id: defaultProfileId,
      name: 'Santri 1',
      avatarColor: '#0d9488',
      createdAt: new Date().toISOString()
    };

    // Check if legacy data exists to migrate seamlessly
    let legacyState = null;
    try {
      const legacyRaw = localStorage.getItem(this.legacyStorageKey);
      if (legacyRaw) {
        legacyState = JSON.parse(legacyRaw);
      }
    } catch (e) {
      console.warn('Legacy data read error:', e);
    }

    if (legacyState) {
      try {
        localStorage.setItem(this.profileDataPrefix + defaultProfileId, JSON.stringify(legacyState));
      } catch (e) {
        console.error('Failed to migrate legacy data to default profile:', e);
      }
    }

    const initialMeta = {
      activeProfileId: defaultProfileId,
      profiles: [defaultProfile]
    };

    try {
      localStorage.setItem(this.metaStorageKey, JSON.stringify(initialMeta));
    } catch (e) {
      console.error('Failed to save initial profiles meta:', e);
    }

    return initialMeta;
  }

  _loadStateForProfile(profileId) {
    let st = null;
    try {
      const saved = localStorage.getItem(this.profileDataPrefix + profileId);
      if (saved) {
        st = JSON.parse(saved);
      }
    } catch (e) {
      console.warn(`Could not read state for profile ${profileId}:`, e);
    }

    if (!st || typeof st !== 'object') {
      st = {
        surahProgress: {}, // { [surahId]: { status: 'none'|'memorizing'|'memorized'|'mutqin', masteredVerses: [1,2,3], notes: '', completedAt: null, updatedAt: null } }
        pageProgress: {},  // { [pageNumber]: boolean }
        pageDates: {},     // { [pageNumber]: ISO-string }
        sessionLogs: [],   // Array of { id, date, surahId, surahName, verseRange, countVerses, repeats, mode, grade, notes }
        streak: {
          lastActiveDate: null,
          currentStreak: 0
        }
      };
    } else {
      st.surahProgress = st.surahProgress || {};
      st.pageProgress = st.pageProgress || {};
      st.pageDates = st.pageDates || {};
      st.sessionLogs = st.sessionLogs || [];
      st.streak = st.streak || { lastActiveDate: null, currentStreak: 0 };
    }
    return st;
  }

  save() {
    try {
      localStorage.setItem(this.profileDataPrefix + this.activeProfileId, JSON.stringify(this.state));
    } catch (e) {
      console.error(`Could not save state for profile ${this.activeProfileId}:`, e);
    }
  }

  _saveProfilesMeta() {
    try {
      localStorage.setItem(this.metaStorageKey, JSON.stringify(this.profilesMeta));
    } catch (e) {
      console.error('Could not save profiles meta:', e);
    }
  }

  /* --- Multi-Profile Management Methods --- */
  getProfiles() {
    return this.profilesMeta.profiles || [];
  }

  getActiveProfile() {
    const prof = this.getProfiles().find(p => p.id === this.activeProfileId);
    return prof || this.getProfiles()[0] || { id: 'profile_default', name: 'Santri 1', avatarColor: '#0d9488' };
  }

  switchProfile(profileId) {
    if (!profileId || profileId === this.activeProfileId) return;
    const target = this.getProfiles().find(p => p.id === profileId);
    if (!target) return;

    // Save current active profile state first
    this.save();

    this.activeProfileId = profileId;
    this.profilesMeta.activeProfileId = profileId;
    this._saveProfilesMeta();
    this.state = this._loadStateForProfile(profileId);
    this.deduplicateActiveProfile();

    if (typeof this.onProfileChange === 'function') {
      this.onProfileChange(target);
    }
    return target;
  }

  createProfile(name, avatarColor = '#0d9488') {
    const cleanName = (name || '').trim() || `Santri ${this.getProfiles().length + 1}`;
    const newId = 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const newProfile = {
      id: newId,
      name: cleanName,
      avatarColor: avatarColor,
      createdAt: new Date().toISOString()
    };

    const freshState = {
      surahProgress: {},
      sessionLogs: [],
      streak: { lastActiveDate: null, currentStreak: 0 }
    };

    try {
      localStorage.setItem(this.profileDataPrefix + newId, JSON.stringify(freshState));
    } catch (e) {
      console.error('Failed to initialize new profile data:', e);
    }

    this.profilesMeta.profiles.push(newProfile);
    this._saveProfilesMeta();

    return newProfile;
  }

  updateProfile(profileId, { name, avatarColor }) {
    const prof = this.getProfiles().find(p => p.id === profileId);
    if (!prof) return null;
    if (name && name.trim()) prof.name = name.trim();
    if (avatarColor) prof.avatarColor = avatarColor;
    this._saveProfilesMeta();

    if (profileId === this.activeProfileId && typeof this.onProfileChange === 'function') {
      this.onProfileChange(prof);
    }
    return prof;
  }

  deleteProfile(profileId) {
    if (this.profilesMeta.profiles.length <= 1) {
      return { success: false, message: 'Minimal harus ada 1 profil aktif.' };
    }

    const idx = this.profilesMeta.profiles.findIndex(p => p.id === profileId);
    if (idx === -1) return { success: false, message: 'Profil tidak ditemukan.' };

    const wasActive = (this.activeProfileId === profileId);

    try {
      localStorage.removeItem(this.profileDataPrefix + profileId);
    } catch (e) {
      console.warn('Failed to remove profile data from storage:', e);
    }

    this.profilesMeta.profiles.splice(idx, 1);

    if (wasActive) {
      const nextProfile = this.profilesMeta.profiles[0];
      this.activeProfileId = nextProfile.id;
      this.profilesMeta.activeProfileId = nextProfile.id;
      this.state = this._loadStateForProfile(nextProfile.id);
    }

    this._saveProfilesMeta();

    if (wasActive && typeof this.onProfileChange === 'function') {
      this.onProfileChange(this.getActiveProfile());
    }

    return { success: true };
  }

  /**
   * Get progress info for a specific surah
   */
  getSurahProgress(surahId) {
    if (!this.state.surahProgress[surahId]) {
      this.state.surahProgress[surahId] = {
        status: 'none', // 'none' | 'memorizing' | 'memorized' | 'mutqin'
        masteredVerses: [],
        notes: '',
        completedAt: null
      };
    }
    return this.state.surahProgress[surahId];
  }

  /**
   * Update status of a surah
   */
  setSurahStatus(surahId, status) {
    const prog = this.getSurahProgress(surahId);
    prog.status = status;
    prog.updatedAt = new Date().toISOString();
    if (status === 'memorized' || status === 'mutqin') {
      if (!prog.completedAt) {
        prog.completedAt = new Date().toISOString();
      }
    }
    this._recordActivityDay();
    this.save();
    return prog;
  }

  /**
   * Set specific completion/memorization date for a surah
   */
  setSurahDate(surahId, dateStr) {
    const prog = this.getSurahProgress(surahId);
    if (!dateStr) {
      prog.completedAt = null;
      prog.updatedAt = null;
    } else {
      const d = new Date(dateStr);
      const iso = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      prog.completedAt = iso;
      prog.updatedAt = iso;
    }
    this.save();
    return prog;
  }

  /**
   * Get recorded date for a surah
   */
  getSurahDate(surahId) {
    const prog = this.getSurahProgress(surahId);
    if (prog.completedAt) return prog.completedAt;
    if (prog.updatedAt) return prog.updatedAt;

    // Check latest session log for this surah
    const logs = this.state.sessionLogs || [];
    const log = logs.find(l => l.surahId === parseInt(surahId, 10));
    if (log && log.date) return log.date;

    return null;
  }

  /**
   * Set specific date for a mushaf page
   */
  setPageDate(mushafPage, dateStr) {
    const p = parseInt(mushafPage, 10);
    if (!this.state.pageDates) this.state.pageDates = {};
    if (!dateStr) {
      delete this.state.pageDates[p];
    } else {
      const d = new Date(dateStr);
      const iso = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      this.state.pageDates[p] = iso;
    }
    this.save();
  }

  /**
   * Get recorded date for a mushaf page
   */
  getPageDate(mushafPage) {
    const p = parseInt(mushafPage, 10);
    if (this.state.pageDates && this.state.pageDates[p]) {
      return this.state.pageDates[p];
    }
    return null;
  }

  /**
   * Toggle mastery check for an individual verse
   */
  toggleVerseMastery(surahId, verseNumber, totalVersesCount) {
    const prog = this.getSurahProgress(surahId);
    const num = parseInt(verseNumber, 10);
    const idx = prog.masteredVerses.indexOf(num);

    if (idx > -1) {
      prog.masteredVerses.splice(idx, 1);
    } else {
      prog.masteredVerses.push(num);
      prog.masteredVerses.sort((a, b) => a - b);
    }

    prog.updatedAt = new Date().toISOString();

    // Auto-update status if all verses are checked
    if (totalVersesCount && prog.masteredVerses.length >= totalVersesCount) {
      if (prog.status !== 'mutqin') {
        prog.status = 'memorized';
        prog.completedAt = new Date().toISOString();
      }
    } else if (prog.masteredVerses.length > 0 && prog.status === 'none') {
      prog.status = 'memorizing';
    }

    this._recordActivityDay();
    this.save();
    return prog;
  }

  /**
   * Mark all verses in a surah as mastered
   */
  markAllVersesInSurah(surahId, totalVersesCount, status = 'memorized') {
    const prog = this.getSurahProgress(surahId);
    prog.status = status;
    prog.masteredVerses = Array.from({ length: totalVersesCount }, (_, i) => i + 1);
    prog.completedAt = new Date().toISOString();
    prog.updatedAt = new Date().toISOString();
    this._recordActivityDay();
    this.save();
    return prog;
  }

  /**
   * Reset mastery for a surah
   */
  resetSurah(surahId) {
    this.state.surahProgress[surahId] = {
      status: 'none',
      masteredVerses: [],
      notes: '',
      completedAt: null,
      updatedAt: null
    };
    this.save();
  }

  /**
   * Check if a specific Quran page is mastered
   */
  isPageMastered(pageNum) {
    const p = parseInt(pageNum, 10);
    if (!this.state.pageProgress) this.state.pageProgress = {};
    if (this.state.pageProgress[p]) return true;

    // Check if verses for this page in Juz 30 are all memorized
    if (typeof window !== 'undefined' && typeof window.getPageVerses === 'function') {
      const verses = window.getPageVerses(p);
      if (verses && verses.length > 0) {
        const allDone = verses.every(v => {
          const prog = this.getSurahProgress(v.surahId);
          if (prog.status === 'mutqin' || prog.status === 'memorized') return true;
          return Array.isArray(prog.masteredVerses) && prog.masteredVerses.includes(v.verseNumber);
        });
        if (allDone) return true;
      }
    }
    return false;
  }

  /**
   * Toggle mastery check for an individual page
   */
  togglePageMastery(pageNum) {
    const p = parseInt(pageNum, 10);
    if (!this.state.pageProgress) this.state.pageProgress = {};
    if (!this.state.pageDates) this.state.pageDates = {};
    const currentlyMastered = this.isPageMastered(p);
    this.state.pageProgress[p] = !currentlyMastered;
    this.state.pageDates[p] = new Date().toISOString();
    this._recordActivityDay();
    this.save();
    return this.state.pageProgress[p];
  }

  /**
   * Calculate page memorization stats for a specific Juz
   */
  calculatePageStats(targetJuz = 30) {
    const juzNum = parseInt(targetJuz, 10) || 30;
    const juzInfo = (window.JUZ_INFO && window.JUZ_INFO[juzNum]) || { pageStart: 582, pageEnd: 604, totalPages: 23 };
    const pageStart = juzInfo.pageStart || 1;
    const pageEnd = juzInfo.pageEnd || 20;
    const totalPages = juzInfo.totalPages || (pageEnd - pageStart + 1);

    let masteredPagesCount = 0;
    for (let p = pageStart; p <= pageEnd; p++) {
      if (this.isPageMastered(p)) {
        masteredPagesCount++;
      }
    }

    const percentage = totalPages > 0 ? Math.round((masteredPagesCount / totalPages) * 100) : 0;
    return {
      juz: juzNum,
      pageStart,
      pageEnd,
      totalPages,
      masteredPagesCount,
      percentage
    };
  }

  /**
   * Add a session log (practiced repetition or manual setoran)
   */
  addSessionLog(logData) {
    const { surahId, surahName, verseRange, countVerses, repeats, mode, grade = 'Lancar', notes = '', type = null, duration = null } = logData || {};
    const logType = type || (repeats === 'Setoran' ? 'setoran' : 'latihan');
    const now = new Date();
    
    // Compute fallback duration if none provided
    let finalDuration = duration;
    if (!finalDuration) {
      if (logType === 'setoran') {
        finalDuration = null;
      } else {
        const repNum = parseInt(repeats, 10) || 1;
        const vCount = countVerses || 1;
        finalDuration = `${Math.max(1, Math.round(vCount * repNum * 0.4))}m`;
      }
    }

    const sId = parseInt(surahId, 10);
    const trimmedNotes = (notes || '').trim();

    // Prevent duplicate submission (same surah, range, grade, notes, type on same day or within 6 hours)
    const isDuplicate = this.state.sessionLogs.some(l => {
      if (!l) return false;
      const lType = l.type || (l.repeats === 'Setoran' ? 'setoran' : 'latihan');
      if (lType !== logType || l.surahId !== sId || l.verseRange !== verseRange) return false;

      const lDate = l.date ? new Date(l.date) : null;
      if (!lDate || isNaN(lDate.getTime())) return false;
      const diffHours = Math.abs(now.getTime() - lDate.getTime()) / (1000 * 60 * 60);

      if (logType === 'setoran') {
        const sameDay = lDate.toDateString() === now.toDateString();
        if ((sameDay || diffHours < 6) && l.grade === grade && (l.notes || '').trim() === trimmedNotes) {
          return true;
        }
      } else {
        const diffMins = diffHours * 60;
        if (diffMins < 15 && l.repeats === repeats && l.mode === mode) {
          return true;
        }
      }
      return false;
    });

    if (isDuplicate) {
      console.warn('[HistoryManager] Duplicate session log prevented:', logData);
      return this.state.sessionLogs[0];
    }

    const logEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      date: now.toISOString(),
      surahId: sId,
      surahName: surahName || `Surat ke-${surahId}`,
      verseRange: verseRange || 'Ayat terpilih',
      countVerses: countVerses || 1,
      repeats: repeats || '3x',
      mode: mode || 'per-verse',
      grade: grade, // 'Sangat Lancar (Mumtaz)', 'Lancar (Jayyid)', 'Cukup', 'Perlu Diulang'
      notes: trimmedNotes,
      type: logType,
      duration: finalDuration
    };

    this.state.sessionLogs.unshift(logEntry); // newest first
    // Limit to latest 300 logs
    if (this.state.sessionLogs.length > 300) {
      this.state.sessionLogs = this.state.sessionLogs.slice(0, 300);
    }

    this._recordActivityDay();
    this.save();
    return logEntry;
  }

  deleteSessionLog(logId) {
    this.state.sessionLogs = this.state.sessionLogs.filter(l => l.id !== logId);
    this.save();
  }

  /**
   * Deduplicate an array of session logs
   */
  deduplicateLogs(logs) {
    if (!Array.isArray(logs) || logs.length === 0) return { cleaned: [], removedCount: 0 };

    const cleaned = [];
    let removedCount = 0;

    for (let i = 0; i < logs.length; i++) {
      const current = logs[i];
      if (!current) continue;

      const currentDate = current.date ? new Date(current.date) : null;
      const currentDay = (currentDate && !isNaN(currentDate.getTime()))
        ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
        : '';
      const currentTime = currentDate && !isNaN(currentDate.getTime()) ? currentDate.getTime() : 0;

      const currentSurah = current.surahId || current.surahName || '';
      const currentRange = current.verseRange || '';
      const currentType = current.type || (current.repeats === 'Setoran' ? 'setoran' : 'latihan');
      const currentGrade = current.grade || '';
      const currentRepeats = current.repeats || '';
      const currentMode = current.mode || '';
      const currentNotes = (current.notes || '').trim().toLowerCase();

      let isDuplicate = false;

      for (const accepted of cleaned) {
        const acceptedDate = accepted.date ? new Date(accepted.date) : null;
        const acceptedDay = (acceptedDate && !isNaN(acceptedDate.getTime()))
          ? `${acceptedDate.getFullYear()}-${String(acceptedDate.getMonth() + 1).padStart(2, '0')}-${String(acceptedDate.getDate()).padStart(2, '0')}`
          : '';
        const acceptedTime = acceptedDate && !isNaN(acceptedDate.getTime()) ? acceptedDate.getTime() : 0;

        const acceptedSurah = accepted.surahId || accepted.surahName || '';
        const acceptedRange = accepted.verseRange || '';
        const acceptedType = accepted.type || (accepted.repeats === 'Setoran' ? 'setoran' : 'latihan');
        const acceptedGrade = accepted.grade || '';
        const acceptedRepeats = accepted.repeats || '';
        const acceptedMode = accepted.mode || '';
        const acceptedNotes = (accepted.notes || '').trim().toLowerCase();

        // 1. Same exact ID or exact timestamp
        if (accepted.id && current.id && accepted.id === current.id) {
          isDuplicate = true;
          break;
        }

        // 2. Surah & verse range must match
        if (currentSurah !== acceptedSurah || currentRange !== acceptedRange) {
          continue;
        }

        // 3. For Setoran (manual inputs)
        if (currentType === 'setoran' && acceptedType === 'setoran') {
          const sameDay = currentDay && acceptedDay && currentDay === acceptedDay;
          const timeDiffHours = (currentTime && acceptedTime) ? Math.abs(currentTime - acceptedTime) / (1000 * 60 * 60) : 0;
          if ((sameDay || timeDiffHours < 6) && currentGrade === acceptedGrade && currentNotes === acceptedNotes) {
            isDuplicate = true;
            break;
          }
        }

        // 4. For Latihan (audio repetitions)
        if (currentType === 'latihan' && acceptedType === 'latihan') {
          const timeDiffMins = (currentTime && acceptedTime) ? Math.abs(currentTime - acceptedTime) / (1000 * 60) : 0;
          if (timeDiffMins < 15 && currentRepeats === acceptedRepeats && currentMode === acceptedMode) {
            isDuplicate = true;
            break;
          }
        }

        // 5. Exact match on same day
        if (currentDay && acceptedDay && currentDay === acceptedDay) {
          if (
            currentType === acceptedType &&
            currentGrade === acceptedGrade &&
            currentRepeats === acceptedRepeats &&
            currentMode === acceptedMode &&
            currentNotes === acceptedNotes
          ) {
            isDuplicate = true;
            break;
          }
        }
      }

      if (isDuplicate) {
        removedCount++;
      } else {
        cleaned.push(current);
      }
    }

    return { cleaned, removedCount };
  }

  /**
   * Deduplicate active profile session logs
   */
  deduplicateActiveProfile() {
    if (!this.state || !Array.isArray(this.state.sessionLogs) || this.state.sessionLogs.length === 0) return 0;
    const { cleaned, removedCount } = this.deduplicateLogs(this.state.sessionLogs);
    if (removedCount > 0) {
      this.state.sessionLogs = cleaned;
      this.save();
    }
    return removedCount;
  }

  /**
   * Deduplicate session logs for all profiles (including "Asri")
   */
  deduplicateAllProfiles() {
    let totalRemoved = 0;
    const profiles = this.getProfiles();

    for (const prof of profiles) {
      const storageKey = this.profileDataPrefix + prof.id;
      let state = null;
      const isCurrent = (prof.id === this.activeProfileId);

      if (isCurrent) {
        state = this.state;
      } else {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) state = JSON.parse(raw);
        } catch (e) {
          console.warn(`Could not read profile data for ${prof.id}:`, e);
        }
      }

      if (state && Array.isArray(state.sessionLogs) && state.sessionLogs.length > 1) {
        const { cleaned, removedCount } = this.deduplicateLogs(state.sessionLogs);
        if (removedCount > 0) {
          state.sessionLogs = cleaned;
          totalRemoved += removedCount;
          if (isCurrent) {
            this.state.sessionLogs = cleaned;
            this.save();
          } else {
            try {
              localStorage.setItem(storageKey, JSON.stringify(state));
            } catch (e) {
              console.error(`Failed to save deduplicated data for profile ${prof.id}:`, e);
            }
          }
          console.log(`[HistoryManager] Cleaned ${removedCount} duplicate log(s) for profile "${prof.name}" (${prof.id})`);
        }
      }
    }

    // Also check legacy storage key
    try {
      const legacyRaw = localStorage.getItem(this.legacyStorageKey);
      if (legacyRaw) {
        const legacyState = JSON.parse(legacyRaw);
        if (legacyState && Array.isArray(legacyState.sessionLogs) && legacyState.sessionLogs.length > 1) {
          const { cleaned, removedCount } = this.deduplicateLogs(legacyState.sessionLogs);
          if (removedCount > 0) {
            legacyState.sessionLogs = cleaned;
            localStorage.setItem(this.legacyStorageKey, JSON.stringify(legacyState));
            totalRemoved += removedCount;
          }
        }
      }
    } catch (e) {}

    return totalRemoved;
  }

  getAllLogs() {
    return this.state.sessionLogs;
  }

  getLogsForDate(dateStr) {
    // dateStr format: YYYY-MM-DD
    return this.state.sessionLogs.filter(log => {
      if (!log.date) return false;
      const d = new Date(log.date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}` === dateStr;
    });
  }

  /**
   * Compute memorization statistics for a specific Juz (1 - 30) or surahs list
   */
  calculateStats(target = 30) {
    let juzNum = 30;
    if (typeof target === 'number' || (typeof target === 'string' && !isNaN(parseInt(target, 10)))) {
      juzNum = parseInt(target, 10);
    }

    const juzInfo = (window.JUZ_INFO && window.JUZ_INFO[juzNum]) || null;

    if (juzInfo) {
      const totalSurahs = juzInfo.totalSurahs;
      const totalVerses = juzInfo.totalVerses;
      let memorizedSurahs = 0;
      let mutqinSurahs = 0;
      let memorizingSurahs = 0;
      let masteredVersesCount = 0;

      juzInfo.surahs.forEach(item => {
        const prog = this.state.surahProgress[item.id];
        const surahVerseCountInJuz = item.end - item.start + 1;
        let surahMasteredInJuz = 0;

        if (prog) {
          if (prog.status === 'mutqin') {
            mutqinSurahs++;
            surahMasteredInJuz = surahVerseCountInJuz;
          } else if (prog.status === 'memorized') {
            surahMasteredInJuz = surahVerseCountInJuz;
          } else if (Array.isArray(prog.masteredVerses)) {
            // Count mastered verses within the Juz boundaries [item.start .. item.end]
            for (let v = item.start; v <= item.end; v++) {
              if (prog.masteredVerses.includes(v)) {
                surahMasteredInJuz++;
              }
            }
          }
        }

        masteredVersesCount += surahMasteredInJuz;

        if (surahMasteredInJuz >= surahVerseCountInJuz && surahVerseCountInJuz > 0) {
          memorizedSurahs++;
        } else if (surahMasteredInJuz > 0) {
          memorizingSurahs++;
        }
      });

      const notStartedSurahs = Math.max(0, totalSurahs - (memorizedSurahs + memorizingSurahs));
      const percentageVerses = totalVerses > 0 ? Math.round((masteredVersesCount / totalVerses) * 100) : 0;
      const percentageSurahs = totalSurahs > 0 ? Math.round((memorizedSurahs / totalSurahs) * 100) : 0;

      return {
        juz: juzNum,
        totalSurahs,
        totalVerses,
        memorizedSurahs,
        mutqinSurahs,
        memorizingSurahs,
        notStartedSurahs,
        masteredVersesCount,
        percentageVerses,
        percentageSurahs,
        totalSessions: this.state.sessionLogs.length,
        currentStreak: this.state.streak.currentStreak
      };
    }

    // Fallback if JUZ_INFO not loaded
    const list = Array.isArray(target) ? target : (window.JUZ30_SURAHS || []);
    const totalSurahs = list.length || 37;
    let totalVerses = 0;
    list.forEach(s => totalVerses += (s.verses_count || 0));
    if (totalVerses === 0) totalVerses = 564;

    let memorizedSurahs = 0;
    let mutqinSurahs = 0;
    let memorizingSurahs = 0;
    let masteredVersesCount = 0;

    list.forEach(surah => {
      const prog = this.state.surahProgress[surah.id];
      if (prog) {
        if (prog.status === 'mutqin') {
          mutqinSurahs++;
          memorizedSurahs++;
        } else if (prog.status === 'memorized') {
          memorizedSurahs++;
        } else if (prog.status === 'memorizing') {
          memorizingSurahs++;
        }

        if (Array.isArray(prog.masteredVerses)) {
          masteredVersesCount += Math.min(prog.masteredVerses.length, surah.verses_count);
        }
      }
    });

    const notStartedSurahs = Math.max(0, totalSurahs - (memorizedSurahs + memorizingSurahs));
    const percentageVerses = totalVerses > 0 ? Math.round((masteredVersesCount / totalVerses) * 100) : 0;
    const percentageSurahs = totalSurahs > 0 ? Math.round((memorizedSurahs / totalSurahs) * 100) : 0;

    return {
      juz: juzNum,
      totalSurahs,
      totalVerses,
      memorizedSurahs,
      mutqinSurahs,
      memorizingSurahs,
      notStartedSurahs,
      masteredVersesCount,
      percentageVerses,
      percentageSurahs,
      totalSessions: this.state.sessionLogs.length,
      currentStreak: this.state.streak.currentStreak
    };
  }

  _recordActivityDay() {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = this.state.streak.lastActiveDate;

    if (!lastActive) {
      this.state.streak.currentStreak = 1;
      this.state.streak.lastActiveDate = today;
    } else if (lastActive === today) {
      // already counted today
    } else {
      // check if yesterday
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastActive === yesterday) {
        this.state.streak.currentStreak += 1;
      } else {
        this.state.streak.currentStreak = 1;
      }
      this.state.streak.lastActiveDate = today;
    }
  }

  exportDataJson() {
    const active = this.getActiveProfile();
    const exportPackage = {
      version: '1.0',
      profile: active,
      surahProgress: this.state.surahProgress,
      sessionLogs: this.state.sessionLogs,
      streak: this.state.streak,
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(exportPackage, null, 2);
  }

  importDataJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object') {
        this.state = {
          surahProgress: parsed.surahProgress || {},
          pageProgress: parsed.pageProgress || {},
          sessionLogs: Array.isArray(parsed.sessionLogs) ? parsed.sessionLogs : [],
          streak: parsed.streak || { lastActiveDate: null, currentStreak: 0 }
        };
        this.save();
        return { success: true, countLogs: this.state.sessionLogs.length };
      }
      return { success: false, error: 'Format data tidak sesuai' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  clearAllData() {
    try {
      localStorage.removeItem(this.profileDataPrefix + this.activeProfileId);
    } catch (e) {
      console.warn('Error clearing profile data:', e);
    }
    this.state = {
      surahProgress: {},
      pageProgress: {},
      sessionLogs: [],
      streak: { lastActiveDate: null, currentStreak: 0 }
    };
  }
}

// Global instance
window.historyManager = new HistoryManager();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoryManager;
}
