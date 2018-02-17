FROM node
RUN mkdir /code
WORKDIR /code
COPY package.json /code

RUN npm install

EXPOSE 3000
CMD ["npm", "run", "start"]