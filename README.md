[![Build Status](https://travis-ci.org/jhouser/actionphase.svg?branch=master)](https://travis-ci.org/jhouser/actionphase)

[Issue Tracker](https://tree.taiga.io/project/rallina-house-of-fun/)

# Development
1. Install docker-machine (https://docs.docker.com/machine/get-started/)
2. If necessary, map your working directory to the VirtualBox file system
3. If your first run:
    1. In the docker-machine, run ```docker-compose build```
    2. Then, run ```start_server.sh```
4. If you've already built and run start_server:
    1. Run ```docker-compose up -d```

The application is now running on port 8000 of your Docker machine's IP