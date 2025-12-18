#!/usr/bin/env bash

docker stop $(cat ./.container_id) && rm -rf ./.container_id
