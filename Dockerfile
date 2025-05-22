# Dockerfile
FROM node:22-bullseye

RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN pip install -r requirements.txt && \
    npm install && \
    chmod +x ./pdf-to-docx/pdf-to-docx-python-script.py

EXPOSE 3000
CMD ["npm", "start"]