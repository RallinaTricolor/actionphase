#!/usr/bin/env bash
cd /code
mv actionphase/.env.example actionphase/.env
docker-compose build
docker-compose run --rm web pip install -r requirements.txt
docker-compose up -d
sleep 15
docker exec code_web_1 npm install --silent
docker exec code_web_1 python manage.py migrate
docker exec code_web_1 python manage.py collectstatic --noinput
docker exec code_web_1 python manage.py runserver 0.0.0.0:8000