# Codebase Structure

**Analysis Date:** 2026-03-18

## Directory Layout

```
youtube-education-app/
├── backend/                    # Server-side application
│   ├── app.py                  # Application factory / entry point
│   ├── config.py               # Configuration management
│   ├── models/                 # Database models and entities
│   ├── services/               # Business logic layer
│   ├── api/                    # API route handlers and controllers
│   ├── integrations/           # External service clients (YouTube, Auth, etc.)
│   ├── middleware/             # Request/response middleware
│   ├── utils/                  # Shared utilities and helpers
│   ├── tasks/                  # Background jobs and scheduled tasks
│   ├── db/                     # Database migrations and setup
│   └── requirements.txt        # Python dependencies
├── frontend/                   # Client-side application
│   ├── index.html              # HTML entry point
│   ├── src/
│   │   ├── main.tsx            # React/Vue application entry
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page-level components
│   │   ├── services/           # API client services
│   │   ├── store/              # State management (Redux, Pinia, etc.)
│   │   ├── utils/              # Client-side utilities
│   │   ├── hooks/              # Custom React hooks (if applicable)
│   │   ├── styles/             # Global styles
│   │   └── App.tsx             # Root application component
│   ├── package.json            # Node.js dependencies
│   └── tsconfig.json           # TypeScript configuration
├── tests/                      # Test suites
│   ├── backend/                # Backend unit and integration tests
│   ├── frontend/               # Frontend component and integration tests
│   └── e2e/                    # End-to-end tests
├── docs/                       # Documentation
│   ├── API.md                  # API documentation
│   ├── SETUP.md                # Setup and deployment guide
│   └── architecture.md         # Architecture overview
├── .env.example                # Example environment variables
├── docker-compose.yml          # Local development environment
├── README.md                   # Project overview
└── .gitignore                  # Git ignore rules
```

## Directory Purposes

**backend/:**
- Purpose: Server application handling content aggregation, user management, and API serving
- Contains: Python application code, routes, models, services
- Key files: `app.py`, `config.py`

**backend/models/:**
- Purpose: Database schema definitions and ORM models
- Contains: User, Content, Video, Progress, Playlist models
- Key files: `user.py`, `video.py`, `content.py`

**backend/services/:**
- Purpose: Core business logic abstraction layer
- Contains: ContentService, UserService, YouTubeService, AuthService
- Key files: `content_service.py`, `youtube_service.py`, `user_service.py`

**backend/api/:**
- Purpose: REST API route handlers and controllers
- Contains: Endpoint definitions, request validation, response formatting
- Key files: `routes.py`, `endpoints/` directory with organized route files

**backend/integrations/:**
- Purpose: External service adapters and clients
- Contains: YouTube API wrapper, authentication provider clients
- Key files: `youtube_client.py`, `auth_provider.py`

**backend/middleware/:**
- Purpose: Request/response processing before reaching routes
- Contains: Authentication checks, error handling, logging
- Key files: `auth.py`, `error_handler.py`

**backend/tasks/:**
- Purpose: Background jobs and scheduled tasks
- Contains: Content refresh jobs, notification delivery, cleanup routines
- Key files: `content_refresh.py`, `notifications.py`

**frontend/src/components/:**
- Purpose: Reusable UI building blocks
- Contains: Video player wrapper, content card, search bar, filters
- Key files: Organized by feature or domain

**frontend/src/pages/:**
- Purpose: Full page components representing routes
- Contains: HomePage, SearchPage, VideoDetailPage, UserProfilePage
- Key files: One component per page route

**frontend/src/services/:**
- Purpose: API client abstraction layer
- Contains: HTTP client configuration, API endpoint wrappers
- Key files: `api.ts`, `contentService.ts`, `authService.ts`

**frontend/src/store/:**
- Purpose: Client-side state management
- Contains: Redux slices, Vuex modules, or Pinia stores
- Key files: `index.ts`, feature-specific store files

**tests/:**
- Purpose: Automated test suites
- Contains: Unit tests, integration tests, end-to-end tests
- Key files: Organized to mirror source structure

## Key File Locations

**Entry Points:**
- `backend/app.py`: Flask/FastAPI application initialization and route registration
- `frontend/src/main.tsx`: React/Vue app bootstrapping and root component
- `docker-compose.yml`: Local development environment orchestration

**Configuration:**
- `backend/config.py`: Environment-based configuration (development, testing, production)
- `frontend/tsconfig.json`: TypeScript compiler configuration
- `.env.example`: Template for required environment variables

**Core Logic:**
- `backend/services/`: Business logic implementations
- `backend/integrations/youtube_client.py`: YouTube API communication
- `frontend/src/services/api.ts`: API client and request handling

**Testing:**
- `tests/backend/test_*.py`: Backend unit and integration tests
- `tests/frontend/**: Frontend component and integration tests
- `tests/e2e/`: End-to-end user flow tests

## Naming Conventions

**Files:**
- Python files: `snake_case.py` (e.g., `content_service.py`, `youtube_client.py`)
- TypeScript files: `camelCase.ts` or `PascalCase.tsx` for components (e.g., `videoPlayer.tsx`, `VideoCard.tsx`)
- Test files: `test_*.py` or `*.test.ts`
- Configuration: `config.py`, `tsconfig.json`, `.env*`

**Directories:**
- Lowercase with underscores for Python directories: `backend/models/`, `backend/services/`
- Lowercase for frontend directories: `frontend/src/components/`, `frontend/src/pages/`
- Plural for collections: `models/`, `services/`, `integrations/`

**Classes/Functions:**
- Classes: PascalCase (e.g., `ContentService`, `YouTubeClient`)
- Functions: camelCase in TypeScript, snake_case in Python
- Private functions: Prefix with underscore `_private_function()`

**Types/Interfaces:**
- TypeScript interfaces: PascalCase with `I` prefix optional (e.g., `VideoContent`, `UserProfile`)
- Python dataclasses: PascalCase (e.g., `VideoData`, `UserProfile`)

## Where to Add New Code

**New Feature:**
- Primary code: `backend/services/new_feature_service.py`
- API endpoints: `backend/api/routes/new_feature.py` or endpoint in `backend/api/routes.py`
- Models: `backend/models/new_entity.py` if database tables needed
- Tests: `tests/backend/test_new_feature.py`

**New Component/Module:**
- Implementation: `frontend/src/components/NewComponent.tsx` for reusable, `frontend/src/pages/NewPage.tsx` for page-level
- Styles: Co-located CSS/SCSS file or `frontend/src/styles/` directory
- Tests: `tests/frontend/components/NewComponent.test.tsx`

**Utilities:**
- Backend helpers: `backend/utils/helper_name.py`
- Frontend helpers: `frontend/src/utils/helperName.ts`
- Share across layers by importing from respective utils modules

**Database Schema Changes:**
- Create migration: `backend/db/migrations/001_create_table_name.sql` or via ORM migration tool
- Update model: `backend/models/entity.py`
- No manual SQL changes to production database without migrations

## Special Directories

**backend/db/:**
- Purpose: Database migrations and initialization
- Generated: Database migration files auto-generated or manually created
- Committed: Yes, migrations must be version controlled

**frontend/dist/ or frontend/build/:**
- Purpose: Compiled production build artifacts
- Generated: Yes, built from source during deployment
- Committed: No, excluded by .gitignore

**.env files:**
- Purpose: Environment variables and secrets
- Generated: No, created manually from .env.example
- Committed: No, .env excluded by .gitignore, only .env.example committed

**node_modules/ and venv/:**
- Purpose: Installed dependencies
- Generated: Yes, installed via package manager
- Committed: No, excluded by .gitignore

---

*Structure analysis: 2026-03-18*
