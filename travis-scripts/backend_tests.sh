#!/usr/bin/env bash
echo "Hello World!"
coverage run backend/manage.py test api.app.tests.$TESTS