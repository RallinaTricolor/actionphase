FROM python:3
ENV PYTHONUNBUFFERED 1
RUN mkdir /code
WORKDIR /code
ADD requirements.txt /code/
RUN pip install -r requirements.txt
ADD . /code/backend/
RUN apt-get update -yq && apt-get upgrade -yq && \
    apt-get install -yq g++ libssl-dev apache2-utils curl git python make nano mysql-client
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]