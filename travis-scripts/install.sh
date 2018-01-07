#!/bin/bash
set -ev
pip install -r requirements.txt
if [[ "${TESTFOLDER}" == *"functional"* ]]; then
    npm install
fi