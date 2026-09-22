# Include trong server {} shop / nanoai.vn / catch-all.
# Copy → /etc/nginx/snippets/nanoai-shop-locations.inc
# Cần /etc/nginx/conf.d/nanoai.conf (upstream nanoai_next + cache_path).

gzip on;
gzip_comp_level 5;
gzip_min_length 256;
gzip_proxied any;
gzip_vary on;
gzip_types text/plain text/css text/xml application/json application/javascript application/xml image/svg+xml;

location /_next/static/ {
    proxy_pass http://nanoai_next;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location /api/fetch-image {
    proxy_pass http://nanoai_next;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache nanoai_fetch_image;
    proxy_cache_valid 200 1d;
    proxy_cache_key $scheme$host$request_uri;
    add_header X-Cache-Status $upstream_cache_status;
}

location / {
    proxy_pass http://nanoai_next;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_connect_timeout 300;
    proxy_send_timeout 300;
    proxy_read_timeout 300;
    client_max_body_size 50M;
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;
    proxy_temp_file_write_size 256k;
}
