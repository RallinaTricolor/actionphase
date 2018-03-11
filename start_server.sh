docker-compose up -d
sleep 5
docker exec code_api_1 pip install -r requirements.txt >/dev/null
docker exec code_api_1 python manage.py migrate
docker exec code_api_1 python manage.py runserver 0.0.0.0:8000