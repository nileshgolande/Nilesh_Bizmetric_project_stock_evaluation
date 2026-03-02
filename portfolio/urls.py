from django.urls import path
from .views import StockListView, SectorListView, SectorStockListView, UserPortfolioView, PortfolioDetailView

urlpatterns = [
    path('stocks/', StockListView.as_view(), name='stock-list'),
    path('sectors/', SectorListView.as_view(), name='sector-list'),
    path('sectors/<int:sector_id>/stocks/', SectorStockListView.as_view(), name='sector-stock-list'),
    path('my-portfolio/', UserPortfolioView.as_view(), name='user-portfolio'),
    path('my-portfolio/<int:pk>/', PortfolioDetailView.as_view(), name='portfolio-detail'),
]