# YouTube Learning Curator

Surface the best YouTube content for learning any subject.

## Setup

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```
3. Get a YouTube Data API v3 key at https://console.cloud.google.com/apis/credentials
4. Get an Anthropic API key at https://console.anthropic.com/settings/keys
5. Install dependencies:
   ```bash
   npm install
   ```
6. Start the server:
   ```bash
   node server.js
   ```
7. Open http://localhost:3000

## Development

Run tests:
```bash
npm test
```

Clear the dev cache (forces fresh YouTube API calls):
```bash
rm -rf .cache/
```
