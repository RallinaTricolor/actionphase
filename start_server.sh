docker-compose up -d
sleep 5
docker exec code_web_1 pip install -r requirements.txt >/dev/null
docker exec code_web_1 npm install
docker exec code_web_1 python manage.py migrate
docker exec code_web_1 python manage.py collectstatic --noinput
