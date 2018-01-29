#!/usr/bin/env bash
cd /code
mv actionphase/.env.example actionphase/.env
docker-compose build >/dev/null
docker-compose run --rm web pip install -r requirements.txt >/dev/null
docker-compose up -d
docker exec -it code_web_1 npm install --silent
docker exec -it code_web_1  python manage.py migrate
docker exec -it code_web_1  python manage.py collectstatic --noinput
