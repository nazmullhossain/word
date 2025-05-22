# Use a Node.js base image with Python support
FROM node:22-bullseye

# Install Python and build tools
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy all remaining files
COPY . .

# Make Python script executable
RUN chmod +x ./pdf-to-docx/pdf-to-docx-python-script.py

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]