FROM nginx:alpine

COPY . /usr/share/nginx/html/
COPY .docker/nginx-vhost.conf /etc/nginx/conf.d/default.conf 

HEALTHCHECK --interval=1m --timeout=10s \
	CMD nc -z localhost 80 

VOLUME ["/images"]
