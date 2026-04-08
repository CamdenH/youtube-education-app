'use strict';

/**
 * sse.js — SSE helpers and course stream handler
 *
 * Exports: sendEvent, sendHeartbeat, startHeartbeat, courseStreamHandler
 */

const { generateQueries } = require('./queries');
const { searchVideos, fetchVideoStats } = require('./youtube');
const { scoreVideos } = require('./scorer');
const { fetchTranscript } = require('./transcript');
const { assembleCourse }  = require('./assembler');

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
 *   4. fetchTranscript × top 12 — parallel transcript fetch with description fallback
 *   5. assembleCourse — Claude assembles course JSON; emits course_assembled
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

  // Step 4: Fetch transcripts for top 12 scored videos (TRAN-01, TRAN-02, TRAN-03)
  // D-05: fetchTranscript returns { source: 'captions', text } or null (captions only)
  // D-06: Videos with null result AND no description are excluded before Claude call
  // CRITICAL: description fallback lives in transcriptHandler, NOT in fetchTranscript.
  // sse.js must apply the fallback manually: check video.snippet.description when null.
  const top12 = scoredVideos.slice(0, 12);
  const rawResults = await Promise.all(top12.map(v => fetchTranscript(v.id)));

  const transcripts = {}; // { [videoId]: { source, text } }
  const videosWithTranscripts = [];
  let skippedCount = 0;

  for (let i = 0; i < top12.length; i++) {
    const video = top12[i];
    let result = rawResults[i];

    if (result === null) {
      // TRAN-02: fall back to video description when fetchTranscript returns null
      const desc = video.snippet && video.snippet.description;
      if (desc && desc.length > 50) {
        result = { source: 'description', text: desc };
      }
    }

    if (result !== null) {
      transcripts[video.id] = result;
      videosWithTranscripts.push(video);
    } else {
      // TRAN-03: no transcript and no description — exclude from course
      skippedCount++;
    }
  }

  sendEvent(res, 'transcripts_fetched', {
    step: 4,
    total: 5,
    message: `Fetched ${videosWithTranscripts.length} transcripts (${skippedCount} skipped)`,
  });

  // Step 5: Assemble course via Claude (CURA-01 through CURA-07, QUES-01–03)
  // D-01: Single Claude call — all transcripts + full assembly in one prompt
  // D-09: course_assembled is the terminal SSE event
  const courseResult = await assembleCourse(videosWithTranscripts, transcripts, subject, skillLevel);

  if (courseResult.error === 'TOO_FEW_VIDEOS') {
    // D-03: Emit error shape as the terminal course_assembled event (no course key)
    sendEvent(res, 'course_assembled', courseResult);
  } else {
    sendEvent(res, 'course_assembled', {
      step: 5,
      total: 5,
      message: 'Course ready',
      course: courseResult,
    });
  }

  clearInterval(heartbeatInterval);
  res.end();
}

module.exports = { sendEvent, sendHeartbeat, startHeartbeat, courseStreamHandler };
