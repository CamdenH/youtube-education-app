'use strict';

/**
 * sse.js — SSE helpers and course stream handler
 *
 * Exports: sendEvent, sendHeartbeat, startHeartbeat, courseStreamHandler
 */

const { generateQueries } = require('./queries');
const { searchVideos, fetchVideoStats } = require('./youtube');
const { scoreVideos } = require('./scorer');

/**
 * Write a named SSE event to the response.
 *
 * Format:
 *   event: {eventName}\n
 *   data: {JSON}\n\n
 *
 * @param {object} res - Express response object
 * @param {string} eventName - SSE event name
 * @param {object} data - Payload to JSON-serialize
 */
function sendEvent(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Write an SSE comment heartbeat to keep the connection alive.
 * Comment format is invisible to addEventListener.
 *
 * @param {object} res - Express response object
 */
function sendHeartbeat(res) {
  res.write(': heartbeat\n\n');
}

/**
 * Start a repeating 15-second heartbeat on the SSE response.
 *
 * @param {object} res - Express response object
 * @returns {NodeJS.Timeout} Interval ID — pass to clearInterval() on cleanup
 */
function startHeartbeat(res) {
  return setInterval(() => sendHeartbeat(res), 15000);
}

/**
 * Express route handler for GET /api/course-stream.
 *
 * Sets SSE headers, starts heartbeat, runs the real pipeline:
 *   1. generateQueries — Claude generates search queries
 *   2. searchVideos + fetchVideoStats — YouTube search and stat fetch
 *   3. scoreVideos — score and rank candidates
 *   4-5. transcripts_fetched + course_assembled — stubs (Phase 3)
 *
 * Inputs are validated by server.js before this handler is called.
 * Error handling (try/catch, SSE error events) lives in server.js.
 *
 * @param {object} req - Express request object (req.query.subject, req.query.skill_level)
 * @param {object} res - Express response object
 */
async function courseStreamHandler(req, res) {
  const { subject, skill_level: skillLevel } = req.query;

  // Set required SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const heartbeatInterval = startHeartbeat(res);
  req.on('close', () => clearInterval(heartbeatInterval));

  // Step 1: Generate search queries via Claude
  const queries = await generateQueries(subject, skillLevel);
  sendEvent(res, 'query_generated', {
    step: 1,
    total: 5,
    message: `Generated ${queries.length} search queries`,
    queries,
  });

  // Step 2: Search YouTube for each query and collect unique video IDs
  const searchResults = await Promise.all(queries.map(q => searchVideos(q)));
  const videoIdSet = new Set();
  for (const result of searchResults) {
    for (const item of (result.items || [])) {
      if (item.id?.videoId) videoIdSet.add(item.id.videoId);
    }
  }
  const videoIds = Array.from(videoIdSet);

  // Fetch full stats for all unique videos
  const videos = await fetchVideoStats(videoIds);
  sendEvent(res, 'videos_fetched', {
    step: 2,
    total: 5,
    message: `Fetched ${videos.length} candidate videos`,
  });

  // Step 3: Score and rank videos
  const scoredVideos = await scoreVideos(videos, skillLevel);
  sendEvent(res, 'scored', {
    step: 3,
    total: 5,
    message: `Scored and ranked ${scoredVideos.length} videos`,
    videos: scoredVideos,
  });

  // Steps 4–5: Stubs (Phase 3 will replace these)
  sendEvent(res, 'transcripts_fetched', {
    step: 4,
    total: 5,
    message: 'Transcript fetching coming in Phase 3',
  });

  sendEvent(res, 'course_assembled', {
    step: 5,
    total: 5,
    message: 'Course ready (stub — Phase 3)',
    course: { title: subject, overview: '', modules: [] },
  });

  clearInterval(heartbeatInterval);
  res.end();
}

module.exports = { sendEvent, sendHeartbeat, startHeartbeat, courseStreamHandler };
