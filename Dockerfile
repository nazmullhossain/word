# Use Python 3.10 slim image (matches your local version)
FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Install system dependencies (Node.js + build tools)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    build-essential && \
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Set environment variables
ENV PORT=3000
EXPOSE $PORT

# Run the application
CMD ["node", "server.js"]