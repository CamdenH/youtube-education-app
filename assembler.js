'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { callClaude, parseClaudeJSON } = require('./claude');

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from process.env

/**
 * Parse an ISO 8601 duration string (e.g. "PT1H30M15S") to total seconds.
 * Identical to the implementation in scorer.js — copied here to avoid a
 * cross-module dependency on a private function.
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
 * Build the single Claude prompt that sends all transcripts and instructs Claude
 * to return a complete course JSON object.
 *
 * @param {Array} videos - Scored video objects (top 12, filtered to those with transcripts)
 * @param {Object} transcripts - Plain object keyed by videoId: { [videoId]: { source, text } }
 * @param {string} subject - The learning subject
 * @param {string} skillLevel - One of 'beginner', 'intermediate', 'advanced', 'all levels'
 * @returns {string} The prompt string
 */
function buildAssemblyPrompt(videos, transcripts, subject, skillLevel) {
  const videoSections = videos.map(v => {
    const transcript = transcripts[v.id] || { source: 'none', text: '' };
    const durationSecs = parseDurationSeconds(v.contentDetails ? v.contentDetails.duration : '');
    return `--- VIDEO: ${v.id} ---
Title: ${v.snippet.title}
Channel: ${v.snippet.channelTitle}
Duration: ${durationSecs} seconds
Score: ${v.score}/100

Transcript (${transcript.source}):
${transcript.text}`;
  }).join('\n\n');

  return `You are a course curator building a structured learning course from YouTube videos.

Subject: ${subject}
Skill Level: ${skillLevel}

Below are the videos available for this course. Each entry includes its title, channel, duration, quality score, and transcript content.

${videoSections}

## Assembly Instructions

Organize the videos above into exactly 3 or 4 thematic modules ordered by learning progression.

Rules:
- Each video must appear in exactly one module — do not omit any video, do not invent new ones.
- For each module: provide a title, a 2-3 sentence description, and a connecting question tying all module videos together.
- For each video: write a 1-2 sentence "why this video" blurb; set outdated: true if the transcript or description contains concrete evidence of staleness (deprecated APIs, old version numbers, superseded tools, "as of [old year]" language); otherwise outdated: false.
- Generate exactly 3 comprehension questions per video: one recall, one conceptual, one application — grounded in the transcript content.
- For the overall course: write a 3-4 sentence overview for a ${skillLevel} learner; estimate total watch time by summing durationSeconds and formatting as "Xh Ym"; list prerequisite knowledge as an array of short strings; derive the course title from the subject.

Return ONLY a JSON object with this exact structure. No explanation, no code fences.

{
  "title": "string — course title derived from subject",
  "overview": "string — 3-4 sentence overview for a ${skillLevel} learner",
  "totalWatchTime": "string — formatted as 'Xh Ym' (sum the durationSeconds from above)",
  "prerequisites": ["string", "..."],
  "modules": [
    {
      "title": "string — module title",
      "description": "string — 2-3 sentence module description",
      "connectingQuestion": "string — question tying all module videos together",
      "videos": [
        {
          "videoId": "string — MUST match one of the provided video IDs exactly",
          "blurb": "string — 1-2 sentence why-this-video rationale",
          "outdated": boolean,
          "questions": [
            { "type": "recall",      "text": "string" },
            { "type": "conceptual",  "text": "string" },
            { "type": "application", "text": "string" }
          ]
        }
      ]
    }
  ]
}`;
}

/**
 * Merge Claude's course JSON output with scored video metadata.
 *
 * Claude returns: module grouping, blurb, outdated, questions, connectingQuestion,
 * module title/description, course title/overview/totalWatchTime/prerequisites.
 *
 * This function adds to each video: title, channelTitle, thumbnail, url,
 * durationSeconds, score — derived from the scored video object, NOT from Claude.
 *
 * Thumbnail pattern: https://i.ytimg.com/vi/{videoId}/mqdefault.jpg
 * URL pattern:       https://www.youtube.com/watch?v={videoId}
 *
 * @param {Object} claudeCourse - Parsed JSON object returned by Claude
 * @param {Array} videos - Scored video objects (same set sent to Claude)
 * @returns {Object} Complete course object matching the locked JSON contract
 */
function mergeClaudeOutput(claudeCourse, videos) {
  // Build a lookup map from videoId to scored video object
  const videoMap = {};
  for (const v of videos) {
    videoMap[v.id] = v;
  }

  const mergedModules = (claudeCourse.modules || []).map(module => ({
    ...module,
    videos: (module.videos || []).map(claudeVideo => {
      const scored = videoMap[claudeVideo.videoId];
      if (!scored) return claudeVideo; // safety: if Claude invented a videoId, pass through as-is

      return {
        videoId:         claudeVideo.videoId,
        title:           scored.snippet.title,
        channelTitle:    scored.snippet.channelTitle,
        thumbnail:       `https://i.ytimg.com/vi/${claudeVideo.videoId}/mqdefault.jpg`,
        url:             `https://www.youtube.com/watch?v=${claudeVideo.videoId}`,
        durationSeconds: parseDurationSeconds(scored.contentDetails ? scored.contentDetails.duration : ''),
        score:           scored.score,
        blurb:           claudeVideo.blurb,
        outdated:        claudeVideo.outdated,
        questions:       claudeVideo.questions,
      };
    }),
  }));

  return {
    title:          claudeCourse.title,
    overview:       claudeCourse.overview,
    totalWatchTime: claudeCourse.totalWatchTime,
    prerequisites:  claudeCourse.prerequisites || [],
    modules:        mergedModules,
  };
}

/**
 * Assemble a structured course from scored videos and their transcripts.
 *
 * Pipeline:
 *   1. TOO_FEW_VIDEOS gate: if videos.length < 5, return error shape immediately
 *   2. Build the assembly prompt (buildAssemblyPrompt)
 *   3. Call Claude via callClaude with max_tokens: 8192 (large response for full course JSON)
 *   4. Parse Claude's JSON response (parseClaudeJSON)
 *   5. Merge Claude output with scored video metadata (mergeClaudeOutput)
 *   6. Return the complete course object
 *
 * Error shape (TOO_FEW_VIDEOS):
 * {
 *   step: 5, total: 5,
 *   error: 'TOO_FEW_VIDEOS',
 *   message: 'Only N videos passed quality review. Try a broader or different search term.'
 * }
 *
 * @param {Array} videos - Scored video objects with transcripts available (filtered by sse.js)
 * @param {Object} transcripts - Plain object keyed by videoId: { [videoId]: { source, text } }
 * @param {string} subject - The learning subject
 * @param {string} skillLevel - One of 'beginner', 'intermediate', 'advanced', 'all levels'
 * @returns {Promise<Object>} Complete course object or TOO_FEW_VIDEOS error shape
 */
async function assembleCourse(videos, transcripts, subject, skillLevel) {
  // D-03: TOO_FEW_VIDEOS gate — fewer than 5 videos with usable content
  if (videos.length < 5) {
    return {
      step: 5,
      total: 5,
      error: 'TOO_FEW_VIDEOS',
      message: `Only ${videos.length} videos passed quality review. Try a broader or different search term.`,
    };
  }

  const prompt = buildAssemblyPrompt(videos, transcripts, subject, skillLevel);

  const text = await callClaude(async () => {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,   // D-01: large budget for full course JSON (12 videos, 36 questions, module descriptions)
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content && response.content[0];
    if (!block || !block.text) {
      throw new Error('Claude returned an empty response — no content blocks');
    }
    return block.text;
  });

  const claudeCourse = parseClaudeJSON(text);
  return mergeClaudeOutput(claudeCourse, videos);
}

module.exports = { assembleCourse };
