#!/bin/bash
set -ev
if [ "$BACKEND" = 1 ]; then
    mysql -e 'create database travis_ci;'
    mv backend/api/.env.travis backend/api/.env
    python backend/manage.py migrate
fi

if [ "$FRONTEND" = 1 ]; then
    mv frontend/.env.travis frontend/.env
fi

if [ "$TESTS" = "e2e" ]; then
    npm i -g cypress
    cd backend && sh load_fixtures.sh
    python manage.py runserver 0.0.0.0:8000 &
    export REACT_API_ENDPOINT=http://localhost:8000
    cd ../frontend && npm start -- --silent &
fi