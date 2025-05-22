# Use an official Python runtime as a parent image
FROM python:3.8-slim

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl \
    && curl -sL https://deb.nodesource.com/setup_14.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Install Python dependencies first (they change less often)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install pdf2docx (or any other Python packages you need)
RUN pip install pdf2docx

# Copy package.json and package-lock.json and install Node modules
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Make the Python script executable
RUN chmod +x ./pdf-to-docx/pdf-to-docx-python-script.py

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]