from django.urls import path
from . import views

urlpatterns = [
    # Example URL: /eda/analyze/AAPL/
    path('analyze/<str:symbol>/', views.get_stock_eda, name='analyze-stock-eda'),
]