#!/bin/sh
set -e

CERT_DIR=/etc/nginx/certs
mkdir -p "$CERT_DIR"

if [ -s "$CERT_DIR/fullchain.pem" ] && [ -s "$CERT_DIR/privkey.pem" ]; then
  echo "Using existing TLS certificate in $CERT_DIR"
else
  HOST="${NGINX_HOST:-localhost}"
  if [ -n "$SSL_SAN" ]; then
    SAN="$SSL_SAN"
  elif echo "$HOST" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'; then
    SAN="IP:${HOST},DNS:localhost"
  else
    SAN="DNS:${HOST},DNS:localhost"
  fi

  echo "No TLS certificate found, generating a self-signed certificate for ${HOST}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/CN=${HOST}" \
    -addext "subjectAltName=${SAN}"
  chmod 644 "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem" || true
fi
