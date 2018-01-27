docker-compose run --rm web pip install -r requirements.txt && \
docker-compose run --rm web npm install && \
docker-compose run --rm web python manage.py migrate && \
docker-compose run --rm web python manage.py collectstatic --noinput && \
docker-compose up -d