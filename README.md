[![Build Status](https://travis-ci.org/jhouser/actionphase.svg?branch=master)](https://travis-ci.org/jhouser/actionphase)

[![Coverage Status](https://coveralls.io/repos/github/jhouser/actionphase/badge.svg)](https://coveralls.io/github/jhouser/actionphase)

# Development
1. Install docker-machine (https://docs.docker.com/machine/get-started/)
2. If necessary, map your working directory to the VirtualBox file system
3. Move the backend/.env.example file to backend/.env, changing any settings you need to
4. Move the frontend/.env.example file to frontend/.env
5. If your first run:
    1. In the docker-machine, run ```docker-compose build```
    2. Then, run ```start_server.sh```
6. If you've already built and run start_server:
    1. Run ```docker-compose up -d```

The UI is now running on port 3000 of your Docker machine's IP, while the API is running on port 8000.