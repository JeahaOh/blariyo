docker compose up -d --force-recreate
docker compose down -v --remove-orphans
docker compose up -d --build --force-recreate