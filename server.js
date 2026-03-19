'use strict';

require('dotenv').config();

const express = require('express');
const { courseStreamHandler, sendEvent } = require('./sse');
const { transcriptHandler } = require('./transcript');
const { YouTubeQuotaError } = require('./youtube');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from project root (index.html)
app.use(express.static(__dirname));

// API routes
app.get('/api/course-stream', async (req, res) => {
  try {
    await courseStreamHandler(req, res);
  } catch (err) {
    // If headers already sent (SSE stream started), emit error event
    if (res.headersSent) {
      if (err instanceof YouTubeQuotaError) {
        sendEvent(res, 'error', { code: 'QUOTA_EXCEEDED', message: 'YouTube quota exceeded. Try again tomorrow.' });
      } else {
        sendEvent(res, 'error', { code: 'INTERNAL', message: err.message });
      }
      res.end();
    } else {
      // Headers not sent yet — respond with 500
      res.status(500).json({ error: err.message });
    }
  }
});

app.get('/api/transcript/:videoId', transcriptHandler);

// Only start listening if this file is run directly (not required by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app; // Export for testing
