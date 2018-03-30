#!/usr/bin/env bash
cd /code
mv backend/api/.env.example backend/api/.env
mv frontend/.env.stage frontend/.env
docker-compose build
docker-compose run --rm api pip install -r requirements.txt
docker-compose up -d
sleep 15
docker exec code_api_1 python manage.py migrate
docker exec code_api_1 bash load_fixtures.sh
docker exec code_api_1 python manage.py runserver 0.0.0.0:8000
