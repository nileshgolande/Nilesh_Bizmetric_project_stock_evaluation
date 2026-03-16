from django.urls import path
from .views import (
    StockListView, StockSearchView, SectorListView, SectorStockListView,
    UserPortfolioView, AddStockToPortfolioView, MarketPulseView, MarketTickerView, PortfolioDetailView,
    TopSectorsView
)

urlpatterns = [
    path('stocks/', StockListView.as_view(), name='stock-list'),
    path('stocks/search/', StockSearchView.as_view(), name='stock-search'),
    path('sectors/', SectorListView.as_view(), name='sector-list'),
    path('sectors/top/', TopSectorsView.as_view(), name='sector-top'),
    path('sectors/<int:sector_id>/stocks/', SectorStockListView.as_view(), name='sector-stock-list'),
    path('my-portfolio/', UserPortfolioView.as_view(), name='user-portfolio'),
    path('my-portfolio/add-stock/', AddStockToPortfolioView.as_view(), name='portfolio-add-stock'),
    path('market/pulse/', MarketPulseView.as_view(), name='market-pulse'),
    path('market/ticker/', MarketTickerView.as_view(), name='market-ticker'),
    path('my-portfolio/<int:pk>/', PortfolioDetailView.as_view(), name='portfolio-detail'),
]
