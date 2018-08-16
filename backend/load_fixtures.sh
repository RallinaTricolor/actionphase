#!/usr/bin/env bash
python manage.py sqlflush | python manage.py dbshell
directory="api/app/fixtures/*"
for file in $directory
do
	python manage.py loaddata $file
done
