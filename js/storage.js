/**
 * منصة البيان - وحدة إدارة التخزين المحلي (Storage Engine)
 * مسؤولة عن إدارة حالة الموقع، حفظ التقدم، الثيم، السلسلة اليومية، والتفضيلات
 */

const StorageKeys = {
  THEME: 'alBayan_theme',
  MORNING_PROGRESS: 'alBayan_morning_progress',
  EVENING_PROGRESS: 'alBayan_evening_progress',
  SLEEP_PROGRESS: 'alBayan_sleep_progress',
  LAST_SESSION: 'alBayan_last_session',
  STREAK: 'alBayan_streak',
  COMPLETED_SESSIONS: 'alBayan_completed_sessions',
  SPLASH_DISMISSED: 'alBayan_splash_dismissed'
};

const StorageManager = {
  // --- Safe Helper Methods ---
  _getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`LocalStorage read failed for ${key}:`, e);
      return null;
    }
  },

  _setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`LocalStorage write failed for ${key}:`, e);
    }
  },

  _getJSON(key, defaultValue = null) {
    const raw = this._getItem(key);
    if (!raw) return defaultValue;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`Error parsing JSON for ${key}:`, e);
      return defaultValue;
    }
  },

  _setJSON(key, value) {
    try {
      this._setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Error stringifying JSON for ${key}:`, e);
    }
  },

  // --- Theme Management ---
  saveTheme(theme) {
    this._setItem(StorageKeys.THEME, theme === 'dark' ? 'dark' : 'light');
  },

  loadTheme() {
    const saved = this._getItem(StorageKeys.THEME);
    if (saved) return saved;
    // Default to light as requested by serene palette
    return 'light';
  },

  // --- Progress Management ---
  _getProgressKey(type) {
    const progressKeys = {
      morning: StorageKeys.MORNING_PROGRESS,
      evening: StorageKeys.EVENING_PROGRESS,
      sleep: StorageKeys.SLEEP_PROGRESS
    };
    return progressKeys[type] || null;
  },

  saveProgress(type, data) {
    const key = this._getProgressKey(type);
    if (!key) return;
    this._setJSON(key, {
      currentIndex: data.currentIndex || 0,
      currentCount: data.currentCount || 0,
      completedItems: data.completedItems || [],
      totalItems: data.totalItems || 0,
      progressPercent: data.progressPercent || 0,
      updatedAt: new Date().toISOString()
    });
  },

  loadProgress(type) {
    const key = this._getProgressKey(type);
    if (!key) return null;
    return this._getJSON(key, null);
  },

  clearProgress(type) {
    const key = this._getProgressKey(type);
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to clear progress for ${type}:`, e);
    }
  },

  // --- Last Session Management ---
  saveLastSession(sessionData) {
    this._setJSON(StorageKeys.LAST_SESSION, {
      type: sessionData.type, // 'morning' | 'evening'
      title: sessionData.title,
      currentIndex: sessionData.currentIndex,
      totalItems: sessionData.totalItems,
      progressPercent: sessionData.progressPercent,
      timestamp: new Date().toISOString()
    });
  },

  loadLastSession() {
    return this._getJSON(StorageKeys.LAST_SESSION, null);
  },

  clearLastSession() {
    try {
      localStorage.removeItem(StorageKeys.LAST_SESSION);
    } catch (e) {
      console.warn('Failed to clear last session:', e);
    }
  },

  // --- Streak Management ---
  loadStreak() {
    return this._getJSON(StorageKeys.STREAK, {
      count: 0,
      lastCompletedDate: null
    });
  },

  saveStreak(streakData) {
    this._setJSON(StorageKeys.STREAK, streakData);
  },

  recordSessionCompletion(type) {
    const today = new Date().toISOString().split('T')[0];
    const streak = this.loadStreak();

    if (streak.lastCompletedDate === today) {
      // Already completed today, maintain streak
      return streak;
    }

    if (!streak.lastCompletedDate) {
      // First time
      streak.count = 1;
    } else {
      const lastDate = new Date(streak.lastCompletedDate);
      const currDate = new Date(today);
      const diffTime = Math.abs(currDate - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day
        streak.count = (streak.count || 0) + 1;
      } else if (diffDays > 1) {
        // Streak broken
        streak.count = 1;
      }
    }

    streak.lastCompletedDate = today;
    this.saveStreak(streak);

    // Save into completed sessions history
    const history = this.loadCompletedSessions();
    history.push({
      type,
      date: today,
      timestamp: new Date().toISOString()
    });
    // Keep last 30 sessions
    if (history.length > 30) history.shift();
    this.saveCompletedSessions(history);

    return streak;
  },

  // --- Completed Sessions History ---
  loadCompletedSessions() {
    return this._getJSON(StorageKeys.COMPLETED_SESSIONS, []);
  },

  saveCompletedSessions(list) {
    this._setJSON(StorageKeys.COMPLETED_SESSIONS, list);
  },

  // --- Splash Screen Dismissal ---
  hasSeenSplash() {
    try {
      return sessionStorage.getItem(StorageKeys.SPLASH_DISMISSED) === 'true';
    } catch (e) {
      return false;
    }
  },

  setSeenSplash(seen = true) {
    try {
      sessionStorage.setItem(StorageKeys.SPLASH_DISMISSED, seen ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to set splash state:', e);
    }
  }
};

// Global export for vanilla scripts
window.StorageManager = StorageManager;
