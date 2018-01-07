#!/bin/bash
set -ev
if [[ "${TESTFOLDER}" == *"functional"* ]]; then
    wget https://github.com/mozilla/geckodriver/releases/download/v0.19.1/geckodriver-v0.19.1-linux64.tar.gz
    mkdir geckodriver
    tar -xzf geckodriver-v0.19.1-linux64.tar.gz -C geckodriver
fi