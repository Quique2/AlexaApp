FROM node:20-alpine
WORKDIR /project

# Copy everything into /project/app/ so expo-router finds routes at app/ (its default)
COPY . ./app/

# Lift config files expo needs at the project root
RUN cp ./app/package.json . && \
    cp ./app/app.json . && \
    cp ./app/babel.config.js . && \
    cp ./app/tsconfig.json . && \
    (cp ./app/metro.config.js . 2>/dev/null || true)

RUN npm install

RUN npx expo export -p web

RUN npm install -g serve
EXPOSE 8080
CMD sh -c "serve -s dist -l ${PORT:-8080}"
