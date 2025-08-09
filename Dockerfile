# Use a newer stable base image (Python 3.10 with Bullseye instead of Buster)
FROM python:3.10-slim-bullseye

WORKDIR /app

# Install system dependencies (updated for Bullseye)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    curl && \
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Install Node dependencies (with production flag)
COPY package*.json ./
RUN npm install --production

# Copy application files (do this last as it changes most frequently)
COPY . .

# Environment variables
ENV PORT=3000
EXPOSE $PORT

# Command to run the application
CMD ["node", "server.js"]