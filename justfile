# Swim Meet Setup Tasks

# Install CLI dependencies
install:
    npm install

# Setup a new swim meet (creates sheet and deploys script)
# Example: just setup "Summer Meet 2026"
setup name:
    node scripts/setup-meet.js "{{name}}"

# Run integration tests (requires gcloud auth)
test:
    node tests/integration.js
