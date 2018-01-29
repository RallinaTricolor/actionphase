#!/usr/bin/env bash
cd /code
docker-compose down
docker system prune --volumes -f