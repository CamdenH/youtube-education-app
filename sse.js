'use strict';

/**
 * sse.js — SSE helpers and stub course stream handler
 *
 * Exports: sendEvent, sendHeartbeat, startHeartbeat, courseStreamHandler
 */

const STUB_EVENTS = [
  {
    name: 'query_generated',
    data: { step: 1, total: 5, message: 'Generated 7 search queries' },
  },
  {
    name: 'videos_fetched',
    data: { step: 2, total: 5, message: 'Fetched 48 candidate videos' },
  },
  {
    name: 'scored',
    data: { step: 3, total: 5, message: 'Scored and ranked 48 videos' },
  },
  {
    name: 'transcripts_fetched',
    data: { step: 4, total: 5, message: 'Fetched transcripts for top 12 videos' },
  },
  {
    name: 'course_assembled',
    data: {
      step: 5,
      total: 5,
      message: 'Course ready',
      course: {
        title: 'Stub Course',
        overview: 'This is a stub course for SSE testing.',
        modules: [],
      },
    },
  },
];

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
 * Sets SSE headers, starts heartbeat, emits all 5 stub pipeline events
 * with 800ms delays between them, then ends the response.
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {number} [_delayMs=800] - Delay between events (overridable in tests)
 */
async function courseStreamHandler(req, res, _delayMs = 800) {
  // Set required SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Flush headers immediately so client receives them before any events
  res.flushHeaders();

  // Start heartbeat to keep proxies alive
  const heartbeatInterval = startHeartbeat(res);

  // Clean up heartbeat on client disconnect to prevent timer leaks
  req.on('close', () => clearInterval(heartbeatInterval));

  // Emit stub pipeline events with simulated delays
  for (const event of STUB_EVENTS) {
    await new Promise((r) => setTimeout(r, _delayMs));
    sendEvent(res, event.name, event.data);
  }

  // Stop heartbeat and close the response after the terminal event
  clearInterval(heartbeatInterval);
  res.end();
}

module.exports = { sendEvent, sendHeartbeat, startHeartbeat, courseStreamHandler };
