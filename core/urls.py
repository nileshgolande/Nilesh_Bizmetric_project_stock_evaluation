"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from pathlib import Path
from src.api.prediction_api import predict_ticker

def serve_index(request):
    """Serve the index.html file directly"""
    base_dir = Path(__file__).resolve().parent
    index_path = base_dir / 'index.html'
    
    if index_path.exists():
        with open(index_path, 'r', encoding='utf-8') as f:
            from django.http import HttpResponse
            return HttpResponse(f.read(), content_type='text/html')
    else:
        from django.http import HttpResponseNotFound
        return HttpResponseNotFound("Index file not found")

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', serve_index, name='home'),
    path('api/predict/<str:ticker>/', predict_ticker, name='predict_ticker'),
    path('api/predictions/', include('predictions.urls')),
    # Routes all our portfolio API endpoints under the /api/ prefix
    path('api/', include('portfolio.urls')), 
    path('api/eda/', include('eda.urls')),
    path('api/auth/', include('staff.urls')),
]