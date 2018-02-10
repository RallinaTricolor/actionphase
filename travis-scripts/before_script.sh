#!/bin/bash
set -ev
mysql -e 'create database travis_ci;'
mv actionphase/.env.travis actionphase/.env
python manage.py migrate
if [[ "${TESTFOLDER}" != *"unit"* ]]; then
    sh -e /etc/init.d/xvfb start
    sleep 3 # give xvfb some time to start
fi