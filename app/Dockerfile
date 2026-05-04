FROM node:20-alpine
RUN npm install -g serve
WORKDIR /app
COPY dist ./dist
EXPOSE 8080
CMD sh -c "serve -s dist -l ${PORT:-8080}"
