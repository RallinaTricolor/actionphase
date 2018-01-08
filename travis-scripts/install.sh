#!/bin/bash
set -ev
pip install -r requirements.txt
if [[ "${TESTFOLDER}" != *"unit"* ]]; then
    npm install
fi