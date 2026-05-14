FROM node:22-bookworm-slim

#image postgreSQL postgres:16

RUN apt-get update
RUN apt-get install -y postgresql

RUN mkdir -p /var/run/postgresql \
	&& chown -R mysql:mysql /var/run/postgresql \
	&& chmod 777 /var/run/postgresql

EXPOSE 3306

COPY ./tools/mariadb.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/mariadb.sh

ENTRYPOINT [ "/usr/local/bin/mariadb.sh" ]

CMD ["mysqld", "--bind-address=0.0.0.0"]
