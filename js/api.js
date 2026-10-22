/**
 * QuranApi - Client for Quran.com API (v4)
 * Supports live dynamic fetching with automatic offline fallback to bundled Juz 30 dataset.
 */
class QuranApi {
  constructor() {
    this.baseUrl = 'https://api.quran.com/api/v4';
    this.cdnVersesAudioUrl = 'https://verses.quran.com/';
    
    // Popular reciters from Quran.com API v4
    this.reciters = [
      {
        id: 7,
        name: 'Mishari Rashid al-`Afasy',
        style: 'Murattal Merdu & Jelas'
      },
      {
        id: 12,
        name: 'Mahmoud Khalil Al-Husary (Muallim)',
        style: 'Guru / Tempo Pelan (Tartil & Makhraj Sangat Jelas)'
      },
      {
        id: 3,
        name: 'Abdur-Rahman as-Sudais',
        style: 'Imam Masjidil Haram Makkah',
        recommended: false
      },
      {
        id: 9,
        name: 'Mohamed Siddiq al-Minshawi',
        style: 'Murattal Tajwid Khusyuk',
        recommended: false
      },
      {
        id: 4,
        name: 'Abu Bakr al-Shatri',
        style: 'Tartil Halus',
        recommended: false
      },
      {
        id: 2,
        name: 'AbdulBaset AbdulSamad',
        style: 'Murattal Klasik',
        recommended: false
      }
    ];

    // Local in-memory cache for fetched data
    this.cache = {
      surahs: null,
      verses: {},
      audio: {}
    };
  }

  /**
   * Get all 114 surahs in the Quran
   */
  getAllSurahs() {
    if (window.ALL_SURAHS && Array.isArray(window.ALL_SURAHS) && window.ALL_SURAHS.length > 0) {
      return window.ALL_SURAHS;
    }
    if (window.JUZ30_SURAHS && Array.isArray(window.JUZ30_SURAHS)) {
      return window.JUZ30_SURAHS;
    }
    return [];
  }

  /**
   * Get list of surahs that belong to a specific Juz (1 - 30)
   * @param {number} juzNum - 1 to 30
   */
  getSurahsByJuz(juzNum = 30) {
    const all = this.getAllSurahs();
    const map = window.JUZ_SURAH_MAP || {};
    const surahIds = map[juzNum];

    if (Array.isArray(surahIds) && surahIds.length > 0) {
      return all.filter(s => surahIds.includes(s.id));
    }

    // Default fallback to Juz 30
    return all.filter(s => s.id >= 78 && s.id <= 114);
  }

  /**
   * Get list of all 37 surahs in Juz 30 (Surah 78 - 114)
   */
  async getJuz30Surahs() {
    return this.getSurahsByJuz(30);
  }

  /**
   * Clean translation text by removing footnote tags (e.g. <sup foot_note=...>) and extra HTML markup
   * @param {string} text
   * @returns {string}
   */
  cleanTranslationText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+([,.;?!:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  _cleanVerseTranslations(verses) {
    if (!verses || !Array.isArray(verses)) return verses;
    verses.forEach(v => {
      if (v && v.translations && Array.isArray(v.translations)) {
        v.translations.forEach(t => {
          if (t && typeof t.text === 'string') {
            t.text = this.cleanTranslationText(t.text);
          }
        });
      }
    });
    return verses;
  }

  /**
   * Get verses for a specific surah with Indonesian translation (Kemenag RI translation id: 33)
   * Supports all 114 surahs with automatic multi-page fetching for long surahs
   * @param {number} surahId - 1 to 114
   */
  async getSurahVerses(surahId) {
    if (this.cache.verses[surahId]) {
      return this.cache.verses[surahId];
    }

    // 1. Check window.JUZ30_VERSES (instant offline cache for Juz 30)
    if (window.JUZ30_VERSES && window.JUZ30_VERSES[surahId]) {
      const cleaned = this._cleanVerseTranslations(window.JUZ30_VERSES[surahId]);
      this.cache.verses[surahId] = cleaned;
      return cleaned;
    }

    // 2. Determine verse count to handle pagination if needed
    const surahInfo = this.getAllSurahs().find(s => s.id === surahId);
    const versesCount = surahInfo ? surahInfo.verses_count : 50;

    // 3. Fetch live from Quran.com API v4
    try {
      if (versesCount <= 50) {
        const url = `${this.baseUrl}/verses/by_chapter/${surahId}?language=id&words=false&translations=33&fields=text_uthmani,chapter_id,verse_number,verse_key&per_page=50`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const cleaned = this._cleanVerseTranslations(data.verses);
          this.cache.verses[surahId] = cleaned;
          return cleaned;
        }
      } else {
        // Multi-page fetch for longer surahs (e.g. Al-Baqarah, Ali Imran, etc.)
        const totalPages = Math.ceil(versesCount / 50);
        const fetchPromises = [];
        for (let page = 1; page <= totalPages; page++) {
          const pageUrl = `${this.baseUrl}/verses/by_chapter/${surahId}?language=id&words=false&translations=33&fields=text_uthmani,chapter_id,verse_number,verse_key&per_page=50&page=${page}`;
          fetchPromises.push(
            fetch(pageUrl).then(res => res.ok ? res.json() : Promise.reject(new Error(`Page ${page} failed`)))
          );
        }
        const results = await Promise.all(fetchPromises);
        let allVerses = [];
        results.forEach(res => {
          if (res && res.verses) {
            allVerses = allVerses.concat(res.verses);
          }
        });
        if (allVerses.length > 0) {
          const cleaned = this._cleanVerseTranslations(allVerses);
          this.cache.verses[surahId] = cleaned;
          return cleaned;
        }
      }
    } catch (err) {
      console.warn(`Network fetch failed for surah ${surahId} verses:`, err);
    }

    // 4. Fallback to verses_juz30.json if in Juz 30 range
    if (surahId >= 78 && surahId <= 114) {
      try {
        const response = await fetch('./data/verses_juz30.json');
        const allVerses = await response.json();
        if (allVerses && allVerses[surahId]) {
          const cleaned = this._cleanVerseTranslations(allVerses[surahId]);
          this.cache.verses[surahId] = cleaned;
          return cleaned;
        }
      } catch (e) {
        console.error(`Failed to load verses for surah ${surahId}:`, e);
      }
    }

    return [];
  }

  /**
   * Get audio URLs for all verses of a surah by reciter ID
   * Supports all 114 surahs and all popular reciters with EveryAyah / QuranCDN universal fallback
   * @param {number} surahId
   * @param {number} reciterId
   */
  async getSurahAudio(surahId, reciterId = 7) {
    const cacheKey = `${surahId}_${reciterId}`;
    if (this.cache.audio[cacheKey]) {
      return this.cache.audio[cacheKey];
    }

    try {
      const url = `${this.baseUrl}/recitations/${reciterId}/by_chapter/${surahId}?per_page=300`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const audioMap = {};
        if (data.audio_files && data.audio_files.length > 0) {
          data.audio_files.forEach(item => {
            let fullUrl = item.url;
            if (fullUrl.startsWith('//')) {
              fullUrl = 'https:' + fullUrl;
            } else if (!fullUrl.startsWith('http')) {
              fullUrl = this.cdnVersesAudioUrl + fullUrl;
            }
            audioMap[item.verse_key] = fullUrl;
          });
          this.cache.audio[cacheKey] = audioMap;
          return audioMap;
        }
      }
    } catch (err) {
      console.warn(`Quran.com audio fetch failed for surah ${surahId} reciter ${reciterId}:`, err);
    }

    // Fallback: Generate universal EveryAyah / QuranCDN audio URL for any surah (1 to 114)
    const audioMap = {};
    const surahStr = String(surahId).padStart(3, '0');
    const surahData = this.getAllSurahs().find(s => s.id === surahId) || (window.JUZ30_SURAHS || []).find(s => s.id === surahId);
    const count = surahData ? surahData.verses_count : 40;

    for (let v = 1; v <= count; v++) {
      const ayahStr = String(v).padStart(3, '0');
      const verseKey = `${surahId}:${v}`;
      if (reciterId === 12) {
        audioMap[verseKey] = `https://mirrors.quranicaudio.com/everyayah/Husary_Muallim_128kbps/${surahStr}${ayahStr}.mp3`;
      } else if (reciterId === 7) {
        audioMap[verseKey] = `https://verses.quran.com/Alafasy/mp3/${surahStr}${ayahStr}.mp3`;
      } else if (reciterId === 3) {
        audioMap[verseKey] = `https://mirrors.quranicaudio.com/everyayah/Abdurrahmaan_As-Sudais_192kbps/${surahStr}${ayahStr}.mp3`;
      } else if (reciterId === 9) {
        audioMap[verseKey] = `https://mirrors.quranicaudio.com/everyayah/Minshawy_Murattal_128kbps/${surahStr}${ayahStr}.mp3`;
      } else if (reciterId === 4) {
        audioMap[verseKey] = `https://mirrors.quranicaudio.com/everyayah/Abu_Bakr_Ash-Shaatree_128kbps/${surahStr}${ayahStr}.mp3`;
      } else if (reciterId === 2) {
        audioMap[verseKey] = `https://mirrors.quranicaudio.com/everyayah/Abdul_Basit_Murattal_192kbps/${surahStr}${ayahStr}.mp3`;
      } else {
        audioMap[verseKey] = `https://verses.quran.com/Alafasy/mp3/${surahStr}${ayahStr}.mp3`;
      }
    }

    this.cache.audio[cacheKey] = audioMap;
    return audioMap;
  }

  /**
   * Get available reciters
   */
  getReciters() {
    return this.reciters;
  }
}

// Global instance
window.quranApi = new QuranApi();
