# #!/bin/bash

# echo "Starting Django Backend..."

# cd /home/azureuser/Nilesh_Bizmetric_project_stock_evaluation

# source venv/bin/activate

# gunicorn core.wsgi:application --bind 0.0.0.0:8000 &


# echo "Starting React Frontend..."

# cd frontend/stock-frontend

# npm install

# npm run build

# npx serve -s build -l 3000

#!/bin/bash

echo "Starting Django backend..."

cd stock_evaluation

source ../env/bin/activate
python manage.py runserver 0.0.0.0:8000 &

cd ..

echo "Starting React frontend..."

cd ./frontend/stock-frontend

npm install

npm run build

npx serve -s build -l 3000

#!/bin/bash 
npm run dev
HOST=0.0.0.0 PORT=3000 npm start
