# Use official Node.js image with Playwright dependencies
FROM mcr.microsoft.com/playwright:v1.52.0-noble

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
RUN npm install

# Copy the rest of the application
COPY . .

# Command to run the cron job
CMD ["npm", "run", "scrape-jobs-remote"]