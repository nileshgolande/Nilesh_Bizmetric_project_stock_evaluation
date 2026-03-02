from django.urls import path
from .views import SectorListView, SectorStockListView, UserPortfolioView

urlpatterns = [
    # Endpoint to get the list of the 4 sectors
    path('sectors/', SectorListView.as_view(), name='sector-list'),

    # Endpoint to get the 10 stocks for a specific sector (e.g., /sectors/1/stocks/)
    path('sectors/<int:sector_id>/stocks/', SectorStockListView.as_view(), name='sector-stock-list'),
    
    # Endpoint for the logged-in user to view or add to their portfolio
    path('my-portfolio/', UserPortfolioView.as_view(), name='user-portfolio'),
]