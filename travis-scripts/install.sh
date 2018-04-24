#!/bin/bash
set -ev
pip install coveralls
if [ "$TO_TEST" = "BACKEND" ]; then
    pip install -r backend/requirements.txt
fi
if [ "$TO_TEST" = "FRONTEND" ]; then
    npm install -g jest
    cd frontend && npm install
fi