docker build -t baiyan-ai-web:0.11.4-fix .

cd /root
docker compose stop web
docker compose rm -f web
docker compose up -d web
