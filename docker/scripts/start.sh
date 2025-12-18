#!/usr/bin/env bash

docker run --rm -p $1:$1 -v ${PWD}/.data:/data -d collection-tracker > ./.container_id && cat ./.container_id
