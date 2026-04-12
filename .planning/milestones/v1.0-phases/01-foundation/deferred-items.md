# Deferred Items

Pre-existing test failures discovered during 01-04 execution. These are NOT caused by 01-04 changes.

## Pre-existing Test Failures

### cache.test.js — test 8: `cacheSet overwrites existing file when called again`

- **File:** tests/unit/cache.test.js
- **Failure:** `cacheGet` returns null after cacheSet is called a second time — suggests the .cache/ dir state leaks between test runs
- **Impact:** Low — isolated test setup/teardown issue, does not affect production behavior

### youtube.test.js — tests 57, 58, 59 (fetchVideoStats and cleanup tests)

- **File:** tests/unit/youtube.test.js
- **Failure:** ENOENT on `.cache/` paths — the youtube test cleanup (rmdir) runs before all tests complete, removing the cache dir mid-suite when tests share .cache/
- **Impact:** Low — test isolation issue, does not affect production behavior
- **Root cause:** Test cleanup runs in wrong order relative to other tests when full suite runs together (`*.test.js` glob)

## Recommendation

Fix youtube.test.js cleanup to use `after()` hooks with recursive option, or use unique temp directories per test suite to avoid cross-suite interference.
