#!/bin/bash

# WhatsApp Bot Deploy Script
echo "🚀 Starting WhatsApp Bot Deployment..."

# Stop existing bot if running
pm2 stop whatsapp-bot 2>/dev/null || true
pm2 delete whatsapp-bot 2>/dev/null || true

# Install/update dependencies
npm install

# Create necessary directories
mkdir -p sessions
mkdir -p media
mkdir -p logs

# Start bot with PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup 2>/dev/null || true

echo "✅ Deployment completed!"
echo "📱 Bot is running with PM2"
echo "📊 Check status: pm2 status"
echo "📝 View logs: pm2 logs whatsapp-bot"
