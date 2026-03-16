module.exports = {
  apps: [
    {
      name: "stock-backend",
      script: "./venv/bin/gunicorn",
      args: "core.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120",
      cwd: __dirname,
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PYTHONPATH: __dirname,
        DJANGO_SETTINGS_MODULE: "core.settings",
        DJANGO_DEBUG: "False"
      },
      error_file: "logs/backend-error.log",
      out_file: "logs/backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4000
    }
  ]
};
