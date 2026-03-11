from django.urls import path
from .views import PredictionView, StockPredictionView

urlpatterns = [
    path('<str:asset_type>/', PredictionView.as_view(), name='predictions'),
    path('stock/<str:symbol>/', StockPredictionView.as_view(), name='stock-predictions'),
]
