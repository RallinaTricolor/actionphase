#!/bin/bash
set -ev
if [ "$TO_TEST" = "BACKEND" ]; then
    pip install -r backend/requirements.txt
    pip install coveralls
fi
if [ "$TO_TEST" = "FRONTEND" ]; then
    cd frontend && npm install
fi