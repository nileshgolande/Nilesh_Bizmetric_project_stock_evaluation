#!/bin/bash

# Exit on any error
set -e

# --- Configuration ---
PROJECT_NAME="Nilesh_Bizmetric_project_stock_evaluation"
PROJECT_DIR="/home/azureuser/$PROJECT_NAME"
LOG_DIR="$PROJECT_DIR/logs"
DOMAIN="stockevaluation.duckdns.org"
EMAIL="nilesh.g@bizmetric.com"

echo "==========================================="
echo "🚀 Starting Production Deployment for $DOMAIN"
echo "==========================================="

# --- Initial Setup ---
echo "📁 Creating log directory..."
mkdir -p "$LOG_DIR"

echo "Navigate to project directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

# --- Code Update ---
echo "📥 Pulling latest code from main branch..."
git fetch origin main
git reset --hard origin/main

# --- Permissions ---
echo "🔐 Setting directory permissions..."
sudo chmod +x /home/azureuser
sudo chown -R azureuser:azureuser "$PROJECT_DIR"

# --- Backend Setup (Python) ---
echo "🐍 Setting up Python backend..."
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
echo "Upgrading pip and installing dependencies from requirements.txt..."
pip install --upgrade pip
pip install -r requirements.txt

echo "🗄️ Running Django migrations and collecting static files..."
python manage.py migrate --noinput
python manage.py collectstatic --noinput

# --- Frontend Setup (Node.js) ---
echo "⚛️ Building React frontend..."
cd frontend/stock-frontend
npm install --no-fund --no-audit --silent
npm run build
cd ../..

# --- Nginx Initial Configuration ---
echo "🌐 Configuring Nginx (pre-SSL)..."
sudo cp nginx.conf /etc/nginx/sites-available/$DOMAIN

if [ -L /etc/nginx/sites-enabled/$DOMAIN ]; then
    sudo rm /etc/nginx/sites-enabled/$DOMAIN
fi
sudo ln -s /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

if [ -L /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
fi
echo "Testing Nginx configuration..."
sudo nginx -t
echo "Restarting Nginx to apply initial config..."
sudo systemctl restart nginx

# --- SSL Certificate with Certbot ---
echo "🔒 Obtaining/Renewing SSL certificate with Certbot..."
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
fi

echo "Running Certbot for domain $DOMAIN..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect

echo "Testing Nginx configuration post-SSL..."
sudo nginx -t
echo "Reloading Nginx to apply SSL changes..."
sudo systemctl reload nginx

# --- Application Startup with PM2 ---
echo "⚙️ Starting application with PM2..."
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js
pm2 save

# --- Final Status Check ---
echo "🔍 Final status check..."
pm2 status
sudo systemctl status nginx | cat

echo "==========================================="
echo "✅ Deployment Script Finished!"
echo "🔗 Site should be live at: https://$DOMAIN"
echo "📝 PM2 logs are in: $LOG_DIR"
echo "==========================================="
