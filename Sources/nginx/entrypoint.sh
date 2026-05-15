#!/bin/bash

# Generate SSL certificate dynamically using environment variables
# This ensures the certificate CN matches the DOMAIN_NAME from .env

if [ ! -f /etc/nginx/ssl/nginx.crt ] || [ ! -f /etc/nginx/ssl/nginx.key ]; then
    echo "Generating SSL certificate for domain: $DOMAIN_NAME"
    
    mkdir -p /etc/nginx/ssl
    
    openssl req -newkey rsa:4096 -x509 -sha256 -days 365 -nodes \
        -out /etc/nginx/ssl/nginx.crt \
        -keyout /etc/nginx/ssl/nginx.key \
        -subj "/C=FR/ST=Perpignan/L=Perpignan/O=42 School/OU=$USER_UID/CN=$DOMAIN_NAME/"
    
    echo "SSL certificate generated successfully"
else
    echo "SSL certificate already exists"
fi

# Replace environment variables in nginx.conf (envsubst)
envsubst '${DOMAIN_NAME}' < /etc/nginx/conf.d/nginx.conf > /etc/nginx/conf.d/nginx.conf.tmp
mv /etc/nginx/conf.d/nginx.conf.tmp /etc/nginx/conf.d/nginx.conf

# Start nginx in foreground mode
nginx -g "daemon off;"
