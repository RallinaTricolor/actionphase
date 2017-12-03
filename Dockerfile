 FROM python:3
 ENV PYTHONUNBUFFERED 1
 RUN mkdir /code
 WORKDIR /code
 ADD requirements.txt /code/
 RUN pip install -r requirements.txt
 ADD . /code/
 RUN apt-get update -yq && apt-get upgrade -yq && \
    apt-get install -yq g++ libssl-dev apache2-utils curl git python make nano mysql-client
RUN MODULES="local" && \
    echo prefix = ~/$MODULES >> ~/.npmrc && \
    echo "export PATH=\$HOME/$MODULES/bin:\$PATH" >> ~/.bashrc && \
    . ~/.bashrc && \
    mkdir ~/$MODULES && \
    mkdir ~/node-latest-install && cd $_ && \
    curl http://nodejs.org/dist/node-latest.tar.gz | tar xz --strip-components=1 && \
    ./configure --prefix=~/$MODULES && \
    make && make install