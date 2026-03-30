#!/usr/bin/env bash

DATA_FOLDER=${1:-${PWD}/.data}
IMAGE=${2:-collection-tracker}
PORT=${3:-3000}

docker run --rm -p $PORT:3001 -v ${DATA_FOLDER}:/data -d ${IMAGE}
