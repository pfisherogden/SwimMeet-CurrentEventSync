# Swim Meet Setup Tasks

# Setup a new swim meet (creates sheet and deploys script)
# Example: just setup "Summer Meet 2026"
setup name:
    uv run node scripts/setup-meet.js "{{name}}"

# Run integration tests (requires gcloud auth)
test:
    uv run node tests/integration.js
