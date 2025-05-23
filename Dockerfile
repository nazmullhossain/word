# Use a more stable base image
FROM python:3.10-slim-buster

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    curl && \
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Install Node dependencies
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

ENV PORT=3000
EXPOSE $PORT
CMD ["node", "server.js"]