#!/bin/bash

# Exit on error
set -e

# Get the directory where the script is located
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_URL="https://github.com/nileshgolande/Nilesh_Bizmetric_project_stock_evaluation.git"

echo "Current Project Directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

echo "Updating system..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv nginx git curl

# Install Node.js
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Update Repository
echo "Updating repository..."
git pull origin main --rebase || (echo "Pull failed, checking status..." && git status)

# Setup Backend
echo "Setting up Backend..."
if [ ! -f "requirements.txt" ]; then
    echo "ERROR: requirements.txt not found in $(pwd)"
    ls -la
    exit 1
fi

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# Setup Frontend
echo "Setting up Frontend..."
cd frontend/stock-frontend
npm install
npm run build
cd ../..

# Configure Nginx
echo "Configuring Nginx..."
sudo cp nginx.conf /etc/nginx/sites-available/stock_evaluation
sudo ln -sf /etc/nginx/sites-available/stock_evaluation /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Start with PM2
echo "Starting application with PM2..."
pm2 delete stock-backend || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "Deployment complete! Visit http://stockevaluation.duckdns.org"
