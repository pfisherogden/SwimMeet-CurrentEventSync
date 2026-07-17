set shell := ["bash", "-c"]

# Setup a new swim meet (creates sheet and deploys script)
# Usage: just setup "Meet Name" [team_id]
setup name team="":
    uv run node scripts/setup-meet.js "{{name}}" "{{team}}"

# Run all tests (integration node script + python E2E test suites)
test: test-e2e
    uv run node tests/integration.js

# Run the python E2E Playwright verification tests
test-e2e:
    uv run pytest

# Run the Tauri desktop scoreboard controller app in development mode
dev-desktop:
    npx tauri dev

# Compile and package the Tauri desktop scoreboard controller app
build-desktop:
    npx tauri build
