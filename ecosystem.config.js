const path = require("path");

module.exports = {
  apps: [
    {
      name: "stock-backend",
      script: "./venv/bin/gunicorn",
      args: "core.wsgi:application --bind 0.0.0.0:8000 --workers 3",
      cwd: __dirname,
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PYTHONPATH: __dirname
      }
    }
  ]
};
