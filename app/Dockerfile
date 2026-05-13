FROM caddy:2-alpine
COPY dist /srv
EXPOSE 8080
CMD sh -c "caddy file-server --root /srv --listen :${PORT:-8080}"
