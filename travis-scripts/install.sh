#!/bin/bash
set -ev
pip install -r requirements.txt
if [[ "${TESTFOLDER}" != *"unit"* ]]; then
    npm install
    gem install sass
    npm install --global babel-cli
fi