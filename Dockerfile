# Use official Python base image (slim version for smaller size)
FROM python:3.9-slim as base

# Install Node.js (LTS version)
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies first (better layer caching)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Node dependencies
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

# Make Python script executable
RUN chmod +x ./pdf-to-docx/pdf-to-docx-python-script.py

# Create temporary directory
RUN mkdir -p /tmp/uploads

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start command (using node directly instead of npm for production)
CMD ["node", "server.js"]