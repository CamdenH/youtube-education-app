'use strict';

// Canonical implementations — copy these into index.html <script> block

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Pure Logic Functions ─────────────────────────────────────────────────────

/**
 * Slugify a course title for use as a filename.
 * Lowercase, replace non-alphanumeric runs with hyphen, strip leading/trailing hyphens.
 *
 * @param {string} title
 * @returns {string}
 */
function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Format a duration in seconds to H:MM:SS or M:SS.
 *
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Return a hex color string for a score badge based on tier.
 * 80-100: green (#22c55e), 60-79: blue (#3b82f6), 40-59: amber (#f59e0b), 0-39: muted (#a0a0a0)
 *
 * @param {number} score
 * @returns {string}
 */
function scoreBadgeColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#a0a0a0';
}

/**
 * Return a human-readable relative time string for an ISO timestamp.
 *
 * @param {string} isoString
 * @returns {string}
 */
function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Build a markdown course export string from the course object.
 * Format per UI-SPEC: no score values, no hints, outdated flag preserved.
 *
 * @param {object} course  - Full course object from the server
 * @param {string} subject - User-entered subject
 * @param {string} skillLevel - Selected skill level
 * @returns {string}
 */
function buildMarkdown(course, subject, skillLevel) {
  const lines = [];
  lines.push(`# ${course.title}`);
  lines.push('');
  lines.push(`**Subject:** ${subject} | **Level:** ${skillLevel} | **Watch time:** ${course.totalWatchTime}`);
  lines.push('');
  lines.push('## Prerequisites');
  for (const prereq of (course.prerequisites || [])) {
    lines.push(`- ${prereq}`);
  }
  lines.push('');
  lines.push('## Overview');
  lines.push(course.overview);
  lines.push('');
  lines.push('---');

  for (let mi = 0; mi < course.modules.length; mi++) {
    const mod = course.modules[mi];
    lines.push('');
    lines.push(`## Module ${mi + 1}: ${mod.title}`);
    lines.push('');
    lines.push(mod.description);

    for (const video of mod.videos) {
      lines.push('');
      lines.push(`### ${video.title}`);
      lines.push(`- **Channel:** ${video.channelTitle}`);
      lines.push(`- **Duration:** ${formatDuration(video.durationSeconds)}`);
      lines.push(`- **Link:** ${video.url}`);
      lines.push(`- **Why:** ${video.blurb}`);
      if (video.outdated) {
        lines.push('');
        lines.push('> Note: This video may contain outdated information.');
      }
      lines.push('');
      lines.push('**Questions:**');
      video.questions.forEach((q, i) => {
        const label = q.type.charAt(0).toUpperCase() + q.type.slice(1);
        lines.push(`${i + 1}. (${label}) ${q.text}`);
      });
    }

    lines.push('');
    lines.push(`**Module question:** ${mod.connectingQuestion}`);
    lines.push('');
    lines.push('---');
  }

  return lines.join('\n');
}

/**
 * Deduplicate, prepend, and cap recent searches at 5.
 *
 * @param {string[]} searches - Current array of recent searches (most recent first)
 * @param {string} newSubject - Subject to add
 * @returns {string[]} Updated array
 */
function updateRecentSearches(searches, newSubject) {
  const deduped = searches.filter((s) => s !== newSubject);
  deduped.unshift(newSubject);
  return deduped.slice(0, 5);
}

/**
 * Save entries to localStorage with evict-oldest retry on quota overflow.
 *
 * @param {string} key - localStorage key
 * @param {object[]} entries - Array of history entries (each has a `generatedAt` ISO string)
 * @param {number} [maxRetries=1] - How many eviction attempts to make
 * @param {object} [storage=localStorage] - Injectable localStorage-compatible object
 */
function saveWithEviction(key, entries, maxRetries, storage) {
  if (maxRetries === undefined) maxRetries = 1;
  if (storage === undefined) storage = (typeof localStorage !== 'undefined' ? localStorage : null);

  let remaining = [...entries];
  let attempts = 0;

  while (attempts <= maxRetries) {
    try {
      storage.setItem(key, JSON.stringify(remaining));
      return; // success
    } catch (e) {
      const isQuota = e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED';
      if (isQuota && remaining.length > 0 && attempts < maxRetries) {
        // Evict oldest entry by generatedAt
        const sorted = [...remaining].sort((a, b) =>
          new Date(a.generatedAt) - new Date(b.generatedAt)
        );
        sorted.shift();
        remaining = sorted;
        attempts++;
      } else {
        // Silent fail — persistence is best-effort
        return;
      }
    }
  }
}

// ─── Exports (for test file only — not needed in index.html inline script) ────

module.exports = {
  slugify,
  formatDuration,
  scoreBadgeColor,
  relativeTime,
  buildMarkdown,
  updateRecentSearches,
  saveWithEviction,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('converts title to lowercase hyphen-separated slug', () => {
    assert.equal(slugify('Intro to Machine Learning'), 'intro-to-machine-learning');
  });

  it('collapses special characters and runs into a single hyphen', () => {
    assert.equal(slugify('Python 2.7: Legacy (deprecated)'), 'python-2-7-legacy-deprecated');
  });

  it('returns empty string for empty input', () => {
    assert.equal(slugify(''), '');
  });
});

describe('formatDuration', () => {
  it('formats 90 seconds as M:SS', () => {
    assert.equal(formatDuration(90), '1:30');
  });

  it('formats 3661 seconds as H:MM:SS', () => {
    assert.equal(formatDuration(3661), '1:01:01');
  });

  it('formats 0 seconds as 0:00', () => {
    assert.equal(formatDuration(0), '0:00');
  });
});

describe('scoreBadgeColor', () => {
  it('returns green for score 85 (80-100 tier)', () => {
    assert.equal(scoreBadgeColor(85), '#22c55e');
  });

  it('returns blue for score 70 (60-79 tier)', () => {
    assert.equal(scoreBadgeColor(70), '#3b82f6');
  });

  it('returns amber for score 50 (40-59 tier)', () => {
    assert.equal(scoreBadgeColor(50), '#f59e0b');
  });

  it('returns muted gray for score 30 (0-39 tier)', () => {
    assert.equal(scoreBadgeColor(30), '#a0a0a0');
  });
});

describe('relativeTime', () => {
  it('returns "2 hours ago" for a timestamp 2 hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    assert.equal(relativeTime(twoHoursAgo), '2 hours ago');
  });

  it('returns "3 days ago" for a timestamp 3 days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    assert.equal(relativeTime(threeDaysAgo), '3 days ago');
  });

  it('returns "just now" for a timestamp 30 seconds ago', () => {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    assert.equal(relativeTime(thirtySecondsAgo), 'just now');
  });
});

describe('buildMarkdown', () => {
  const mockCourse = {
    title: 'Introduction to Machine Learning',
    totalWatchTime: '2h 30m',
    overview: 'A comprehensive introduction to ML concepts.',
    prerequisites: ['Basic Python', 'Linear Algebra'],
    modules: [
      {
        title: 'Foundations',
        description: 'Core concepts of machine learning.',
        connectingQuestion: 'How does supervised learning differ from unsupervised?',
        videos: [
          {
            title: 'What is Machine Learning?',
            channelTitle: 'MIT OpenCourseWare',
            durationSeconds: 900,
            url: 'https://youtube.com/watch?v=abc123',
            blurb: 'Excellent introduction to ML fundamentals.',
            outdated: false,
            questions: [
              { type: 'recall', text: 'What is supervised learning?' },
              { type: 'conceptual', text: 'How do training sets relate to model accuracy?' },
              { type: 'application', text: 'Describe a real-world ML application.' },
            ],
          },
        ],
      },
    ],
  };

  it('contains the course title heading, subject metadata, prerequisites, overview, and module/video structure', () => {
    const md = buildMarkdown(mockCourse, 'machine learning', 'beginner');
    assert.ok(md.includes('# Introduction to Machine Learning'), 'missing # title');
    assert.ok(md.includes('**Subject:**'), 'missing **Subject:**');
    assert.ok(md.includes('## Prerequisites'), 'missing ## Prerequisites');
    assert.ok(md.includes('## Overview'), 'missing ## Overview');
    assert.ok(md.includes('## Module 1:'), 'missing ## Module 1:');
    assert.ok(md.includes('### What is Machine Learning?'), 'missing ### video title');
    assert.ok(md.includes('**Questions:**'), 'missing **Questions:**');
    assert.ok(md.includes('1. (Recall)'), 'missing recall question');
    assert.ok(md.includes('**Module question:**'), 'missing **Module question:**');
  });

  it('does not contain score or Score values', () => {
    const md = buildMarkdown(mockCourse, 'machine learning', 'beginner');
    assert.ok(!md.includes('score'), 'output must not contain "score"');
    assert.ok(!md.includes('Score'), 'output must not contain "Score"');
  });

  it('includes outdated note for video with outdated: true', () => {
    const courseWithOutdated = JSON.parse(JSON.stringify(mockCourse));
    courseWithOutdated.modules[0].videos[0].outdated = true;
    const md = buildMarkdown(courseWithOutdated, 'machine learning', 'beginner');
    assert.ok(
      md.includes('> Note: This video may contain outdated information.'),
      'missing outdated note'
    );
  });

  it('does not include outdated note for video with outdated: false', () => {
    const md = buildMarkdown(mockCourse, 'machine learning', 'beginner');
    assert.ok(
      !md.includes('> Note: This video may contain outdated information.'),
      'should not have outdated note when outdated is false'
    );
  });
});

describe('updateRecentSearches', () => {
  it('prepends a new subject to the front of the list', () => {
    const result = updateRecentSearches(['python', 'javascript'], 'rust');
    assert.equal(result[0], 'rust');
  });

  it('deduplicates — moves existing subject to front with no duplicate', () => {
    const result = updateRecentSearches(['python', 'javascript', 'rust'], 'javascript');
    assert.equal(result[0], 'javascript');
    assert.equal(result.filter((s) => s === 'javascript').length, 1);
  });

  it('caps list at 5 entries — adding a 6th drops the oldest', () => {
    const existing = ['a', 'b', 'c', 'd', 'e'];
    const result = updateRecentSearches(existing, 'f');
    assert.equal(result.length, 5);
    assert.equal(result[0], 'f');
    assert.ok(!result.includes('e'), 'oldest entry "e" should be dropped');
  });
});

describe('saveWithEviction', () => {
  it('saves entries to localStorage on normal write', () => {
    const store = {};
    const mockStorage = {
      setItem(k, v) { store[k] = v; },
      getItem(k) { return store[k] || null; },
    };

    const entries = [
      { generatedAt: '2026-04-01T00:00:00.000Z', data: 'a' },
    ];

    saveWithEviction('test_key', entries, 1, mockStorage);
    assert.ok('test_key' in store, 'key must be written to storage');
    assert.deepEqual(JSON.parse(store['test_key']), entries);
  });

  it('evicts oldest entry on QuotaExceededError and retries', () => {
    const store = {};
    let callCount = 0;
    const mockStorage = {
      setItem(k, v) {
        callCount++;
        if (callCount === 1) {
          const err = new Error('Quota exceeded');
          err.name = 'QuotaExceededError';
          throw err;
        }
        store[k] = v;
      },
      getItem(k) { return store[k] || null; },
    };

    const entries = [
      { generatedAt: '2026-04-01T00:00:00.000Z', data: 'older' },
      { generatedAt: '2026-04-09T00:00:00.000Z', data: 'newer' },
    ];

    saveWithEviction('test_key', entries, 1, mockStorage);

    assert.ok('test_key' in store, 'key must be written after eviction');
    const saved = JSON.parse(store['test_key']);
    // oldest entry (2026-04-01) should have been evicted
    assert.equal(saved.length, 1);
    assert.equal(saved[0].data, 'newer');
  });
});
