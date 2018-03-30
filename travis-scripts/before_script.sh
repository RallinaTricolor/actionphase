#!/bin/bash
set -ev
mysql -e 'create database travis_ci;'
mv backend/actionphase/.env.travis backend/actionphase/.env
python backend/manage.py migrate