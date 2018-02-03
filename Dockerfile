FROM python:3
ENV PYTHONUNBUFFERED 1
RUN mkdir /code
WORKDIR /code
ADD requirements.txt /code/
RUN pip install -r requirements.txt
ADD . /code/
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash - && \
    apt-get update -yq && apt-get upgrade -yq && \
    apt-get install -yq g++ libssl-dev apache2-utils curl git python make nano mysql-client ruby ruby-dev nodejs && \
    gem install sass
