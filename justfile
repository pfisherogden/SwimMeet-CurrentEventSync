# Swim Meet Setup Tasks

# Setup a new swim meet (creates sheet and deploys script)
# Usage: just setup "Meet Name" [team_id]
setup name team="":
    uv run node scripts/setup-meet.js "{{name}}" "{{team}}"

# Run integration tests (requires gcloud auth)
test:
    uv run node tests/integration.js
