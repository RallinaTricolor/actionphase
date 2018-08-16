#!/bin/bash
set -ev
if [ "$BACKEND" = 1 ]; then
    pip install -r backend/requirements.txt
    pip install codecov
fi
if [ "$FRONTEND" = 1 ]; then
    npm -g i npm codecov && cd frontend && npm install
fi

if [ "$TESTS" = "e2e" ]; then
    export DISPLAY=':99.0'
    Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
fi