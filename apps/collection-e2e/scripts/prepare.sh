#!/usr/bin/env bash

${PWD}/docker/scripts/stop.sh collection-tracker-cypress
${PWD}/docker/scripts/build.sh collection-tracker-cypress
${PWD}/docker/scripts/start.sh "${PWD}/apps/collection-e2e/env/" collection-tracker-cypress "2999"
