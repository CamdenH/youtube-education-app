'use strict';

const { cacheGet, cacheSet } = require('./cache');
const { fetchVideoStats } = require('./youtube');

/**
 * Parses timedtext XML from the YouTube captions API into plain text.
 * Strips all XML tags, decodes HTML entities, and collapses whitespace.
 *
 * @param {string} xml - Raw XML/HTML string from timedtext response
 * @returns {string} Plain text with entities decoded and whitespace normalized
 */
function parseTimedtextXml(xml) {
  if (!xml) return '';
  // Strip all XML/HTML tags
  let text = xml.replace(/<[^>]+>/g, ' ');
  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Collapse whitespace and trim
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Fetches the transcript for a YouTube video using the timedtext API.
 * Returns cached data if available. Returns null if no valid transcript exists.
 *
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<{source: string, text: string}|null>}
 */
async function fetchTranscript(videoId) {
  const cacheKey = `transcript_${videoId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`);
    const xml = await res.text();

    if (xml && xml.trim().length > 0 && xml.includes('<')) {
      const text = parseTimedtextXml(xml);
      if (text.length > 50) {
        const result = { source: 'captions', text };
        await cacheSet(cacheKey, result);
        return result;
      }
    }
  } catch (_err) {
    // Fetch failure or parse error — silent fallthrough, return null
  }

  return null;
}

/**
 * Express route handler for GET /api/transcript/:videoId.
 * Returns transcript text from captions, falls back to video description,
 * or returns HTTP 404 when neither is available.
 *
 * @param {object} req - Express request object (req.params.videoId)
 * @param {object} res - Express response object
 */
async function transcriptHandler(req, res) {
  const { videoId } = req.params;

  try {
    const transcript = await fetchTranscript(videoId);

    if (transcript !== null) {
      return res.json({ videoId, source: transcript.source, text: transcript.text });
    }

    // Fallback: attempt to use video description
    const videos = await fetchVideoStats([videoId]);
    const video = videos && videos[0];
    if (video && video.snippet && video.snippet.description && video.snippet.description.length > 50) {
      const description = video.snippet.description;
      const result = { source: 'description', text: description };
      await cacheSet(`transcript_${videoId}`, result);
      return res.json({ videoId, source: 'description', text: description });
    }

    // Neither transcript nor description available
    return res.status(404).json({
      error: 'NO_TRANSCRIPT',
      videoId,
      message: 'No transcript or description available'
    });
  } catch (error) {
    return res.status(500).json({
      error: 'INTERNAL',
      videoId,
      message: error.message
    });
  }
}

module.exports = { fetchTranscript, parseTimedtextXml, transcriptHandler };
