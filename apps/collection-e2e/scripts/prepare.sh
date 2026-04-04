#!/usr/bin/env bash

DATA_DIR="${PWD}/apps/collection-e2e/env"
DATABASE_DIR="${DATA_DIR}/database"
STORE_DIR="${DATA_DIR}/store"
USER_HASH="6882164e2121e7219a4170a678025cb9aea2504a5ae141b1e25dbe707b897210d4d57edb75dfccb0951ac127807a04a64b0b38829bd01540427471b70ea31c99"

${PWD}/docker/scripts/stop.sh collection-tracker-cypress
${PWD}/docker/scripts/build.sh collection-tracker-cypress

rm -rf "${DATABASE_DIR}" "${STORE_DIR}"
mkdir -p "${DATABASE_DIR}"
mkdir -p "${STORE_DIR}/${USER_HASH}"
cat > "${DATABASE_DIR}/users.json" << 'EOF'
{"6882164e2121e7219a4170a678025cb9aea2504a5ae141b1e25dbe707b897210d4d57edb75dfccb0951ac127807a04a64b0b38829bd01540427471b70ea31c99":{"userTokenHash":"7b3e4ae98675fc646d90b4336680d70ae9ff8d929a41243cc54721278b390072d63a3a237b0a0e5a6b6ded5c5025fe5bcebb38561205e736113ed968362cc007","accessTokens":[]}}
EOF

${PWD}/docker/scripts/start.sh "${DATA_DIR}" collection-tracker-cypress "2999"
