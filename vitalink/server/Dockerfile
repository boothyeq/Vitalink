# Base image
FROM node:20-slim

# Install Python 3, pip, and system dependencies for OpenCV
# libgl1 and libglib2.0-0 are REQUIRED for cv2 to work on Linux
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Node dependencies and install
COPY package*.json ./
RUN npm ci --only=production

# Copy the backend source code
COPY . .

# Copy Python requirements and install
COPY requirements.txt .
# Use --break-system-packages if pip warns about managed environments, or just install
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Expose port used by Node backend
EXPOSE 3000

# Start the Node server
CMD ["node", "server.js"]
