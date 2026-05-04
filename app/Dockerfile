FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV EXPO_ROUTER_APP_ROOT=.
RUN npx expo export -p web
RUN npm install -g serve
EXPOSE 8080
CMD sh -c "serve -s dist -l ${PORT:-8080}"
