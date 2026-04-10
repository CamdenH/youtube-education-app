'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { callClaude, parseClaudeJSON } = require('./claude');

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from process.env

// ─── Weights table (D-01, D-02, D-04) ────────────────────────────────────────
// All values are max-point caps. Each row sums to 100.
// beginner:     40+20+15+15+10 = 100
// intermediate: 40+20+20+10+10 = 100
// advanced:     40+20+25+ 5+10 = 100
const WEIGHTS = {
  beginner:     { likeRatio: 40, duration: 20, credibility: 15, recency: 15, description: 10 },
  intermediate: { likeRatio: 40, duration: 20, credibility: 20, recency: 10, description: 10 },
  advanced:     { likeRatio: 40, duration: 20, credibility: 25, recency:  5, description: 10 },
};
WEIGHTS['all levels'] = WEIGHTS.intermediate; // D-04

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Parse an ISO 8601 duration string (e.g. "PT1H30M15S") to total seconds.
 * Returns 0 if the string does not match the expected pattern.
 *
 * @param {string} iso - ISO 8601 duration string
 * @returns {number} Total duration in seconds
 */
function parseDurationSeconds(iso) {
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  if (!match) return 0;
  const hours   = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return (hours * 3600) + (minutes * 60) + seconds;
}

/**
 * Build the combined channel credibility + description quality prompt.
 * Includes D-12 calibration anchors for consistent scoring across batches.
 *
 * @param {Array<{name: string, subscriberCount: ?string}>} channels - Unique channels to rate
 * @param {Array} videos - Video objects with id, snippet.description
 * @returns {string} The prompt string
 */
function buildScoringPrompt(channels, videos) {
  const channelList = channels
    .map(c => `  - "${c.name}"${c.subscriberCount ? ` (${Number(c.subscriberCount).toLocaleString()} subscribers)` : ''}`)
    .join('\n');

  const descriptionList = videos
    .map(v => `  - videoId "${v.id}": ${(v.snippet.description || '').slice(0, 300)}`)
    .join('\n');

  return `You are a YouTube content quality rater for an educational course builder.

## Task 1: Rate Channel Credibility (0–20 per channel)

Rate each channel on a 0–20 scale based on content depth, rigor, and educational value.
The maximum score (20/20) is achievable by ANY channel that demonstrates clear, deep, rigorous educational content — institutional affiliation is one positive signal but is NOT required for a top score.

Calibration anchors (to ensure consistent scoring across batches):
- MIT OpenCourseWare: 20/20 — top-tier institutional educational content, university-level rigor
- 3Blue1Brown: 20/20 — exceptional indie educator, mathematical depth and visual clarity
- typical programming tutorial channel with mid-roll ads and filler: 12/20 — competent but commercial
- gaming/entertainment crossover channel that occasionally covers tech: 3/20 — low educational signal

Channels to rate:
${channelList}

## Task 2: Rate Description Quality (0–10 per video)

Rate each video's description on a 0–10 scale for educational depth: does it outline what the viewer will learn, mention key concepts, or provide structured context? Generic or promotional descriptions score low.

Descriptions to rate:
${descriptionList}

## Output Format

Return ONLY a JSON object with two keys: "channels" and "descriptions". No explanation.

Example:
{
  "channels": { "Channel Name": 18, "Another Channel": 7 },
  "descriptions": { "videoId1": 8, "videoId2": 3 }
}`;
}

/**
 * Score channel credibility and description quality for all videos in one Claude call.
 * This is the sole Claude call in the scoring pipeline (SCOR-04 — exactly one batch call).
 *
 * @param {Array<{name: string, subscriberCount: ?string}>} channels - Unique channels
 * @param {Array} videos - Video objects (for description text)
 * @returns {Promise<{channels: Object, descriptions: Object}>}
 */
async function scoreChannelCredibility(channels, videos) {
  const prompt = buildScoringPrompt(channels, videos);

  const text = await callClaude(async () => {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].text;
  });

  const parsed = parseClaudeJSON(text);

  // Shape validation: guard against missing keys (T-02-03-04)
  return {
    channels:     parsed.channels     && typeof parsed.channels     === 'object' ? parsed.channels     : {},
    descriptions: parsed.descriptions && typeof parsed.descriptions === 'object' ? parsed.descriptions : {},
  };
}

// ─── Exported scoring components ──────────────────────────────────────────────

/**
 * Score the like/view ratio for a video.
 * Educational content typically achieves ~4% like ratio at its best.
 *
 * @param {object} statistics - YouTube statistics object (may have string values, T-02-03-01)
 * @param {number} maxPts - Maximum points available for this component
 * @returns {number} Score in [0, maxPts]
 */
function scoreLikeRatio(statistics, maxPts) {
  if (!statistics || !statistics.viewCount || Number(statistics.viewCount) === 0) return 0;

  const EXCELLENT_RATIO = 0.04; // 4% like ratio = maximum educational quality signal

  const ratio = Number(statistics.likeCount || 0) / Number(statistics.viewCount);
  return Math.round(Math.min(ratio / EXCELLENT_RATIO, 1) * maxPts);
}

/**
 * Score a video's duration based on skill-level-specific ideal ranges (D-05, D-06).
 *
 * Beginner/Intermediate/All levels ideal: 8–45 min
 * Advanced ideal: 8–60 min (tolerates university-length lectures, D-06)
 *
 * Tiers:
 *   Under 3 min or over cap → 0
 *   3–8 min or idealUpper to cap → partial credit (half of maxPts)
 *   8–idealUpper → full credit
 *
 * @param {string} durationStr - ISO 8601 duration (e.g. "PT20M")
 * @param {string} skillLevel - One of 'beginner', 'intermediate', 'advanced', 'all levels'
 * @param {number} maxPts - Maximum points available
 * @returns {number} Score in [0, maxPts]
 */
function scoreDuration(durationStr, skillLevel, maxPts) {
  const seconds = parseDurationSeconds(durationStr);
  const minutes = seconds / 60;

  // D-06: Advanced learners tolerate longer lectures
  const isAdvanced = skillLevel === 'advanced';
  const idealUpper = isAdvanced ? 60 : 45;
  const hardCap    = isAdvanced ? 90 : 60;

  if (minutes < 3 || minutes > hardCap) return 0;
  if (minutes >= 8 && minutes <= idealUpper) return maxPts;
  // Partial credit: 3–8 min (too short) or idealUpper–hardCap (overlong but tolerable)
  return Math.round(maxPts / 2);
}

/**
 * Score a video's recency using linear decay over 36 months.
 * Beginner learners care more about recency; advanced learners less (weight handles this).
 *
 * @param {string} publishedAt - ISO 8601 date string
 * @param {string} skillLevel - Not used in formula (weights encode the preference)
 * @param {number} maxPts - Maximum points available
 * @returns {number} Score in [0, maxPts]
 */
function scoreRecency(publishedAt, skillLevel, maxPts) { // eslint-disable-line no-unused-vars
  const ageMonths = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return Math.round(Math.max(0, 1 - ageMonths / 36) * maxPts);
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Score a list of YouTube videos for a given skill level.
 *
 * Makes exactly one Claude API call (SCOR-04) to rate channel credibility and
 * description quality for the entire candidate set. All other components are
 * deterministic JavaScript calculations.
 *
 * @param {Array} videos - Video objects from fetchVideoStats (YouTube API shape)
 * @param {string} skillLevel - One of 'beginner', 'intermediate', 'advanced', 'all levels'
 * @returns {Promise<Array>} Videos with added `score` (0–100) and `scoreBreakdown` properties,
 *                           sorted descending by score. Original objects are not mutated.
 */
async function scoreVideos(videos, skillLevel) {
  const weights = WEIGHTS[skillLevel] || WEIGHTS.intermediate;

  // Extract unique channels for the batch call (D-13 — no per-channel calls)
  const seen = new Set();
  const uniqueChannels = [];
  for (const v of videos) {
    const name = v.snippet.channelTitle;
    if (!seen.has(name)) {
      seen.add(name);
      uniqueChannels.push({
        name,
        subscriberCount: v.statistics ? (v.statistics.subscriberCount || null) : null,
      });
    }
  }

  // One Claude call for both credibility and description quality (SCOR-04, Option A for SCOR-05)
  const { channels: credMap, descriptions: descMap } = await scoreChannelCredibility(uniqueChannels, videos);

  return videos
    .map(video => {
      // All YouTube stat fields are strings — coerce with Number() before arithmetic (T-02-03-01)
      const likeRatioScore = scoreLikeRatio(video.statistics || {}, weights.likeRatio);
      const durationScore  = scoreDuration(video.contentDetails ? (video.contentDetails.duration || 'PT0S') : 'PT0S', skillLevel, weights.duration);
      const recencyScore   = scoreRecency(video.snippet.publishedAt, skillLevel, weights.recency);

      // Cap Claude-returned scores to their respective weight max (prevents overscore if Claude returns > max)
      const credScore = Math.min(Number(credMap[video.snippet.channelTitle] || 0), weights.credibility);
      const descScore = Math.min(Number(descMap[video.id] || 0), weights.description);

      const score = likeRatioScore + durationScore + recencyScore + credScore + descScore;

      return { ...video, score, scoreBreakdown: { likeRatioScore, durationScore, recencyScore, credScore, descScore } };
    })
    .sort((a, b) => b.score - a.score); // Sort descending by score
}

module.exports = { scoreVideos, scoreDuration, scoreRecency, scoreLikeRatio };
