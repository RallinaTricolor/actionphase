docker-compose run --rm web pip install -r requirements.txt && \
docker-compose up -d && \
docker exec -it code_web_1 npm install && \
docker exec -it code_web_1  python manage.py migrate && \
docker exec -it code_web_1  python manage.py collectstatic --noinput
