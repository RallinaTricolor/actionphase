docker-compose run --rm web pip install -r requirements.txt && \
docker-compose up -d && \
sleep 5 && \
docker exec code_web_1 npm install && \
docker exec code_web_1 python manage.py migrate && \
docker exec code_web_1 python manage.py collectstatic --noinput
