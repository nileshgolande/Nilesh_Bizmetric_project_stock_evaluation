from django.shortcuts import render
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Sector, Stock, Portfolio
from .serializers import SectorSerializer, StockSerializer, PortfolioSerializer

class SectorListView(generics.ListAPIView):
    """
    API endpoint that returns a list of all 4 sectors.
    Accessible to anyone.
    """
    queryset = Sector.objects.all()
    serializer_class = SectorSerializer
    permission_classes = [AllowAny]


class SectorStockListView(generics.ListAPIView):
    """
    API endpoint that returns the 10 stocks belonging to a specific sector.
    Accessible to anyone.
    """
    serializer_class = StockSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Grabs the 'sector_id' from the URL and filters the stocks
        sector_id = self.kwargs.get('sector_id')
        return Stock.objects.filter(sector_id=sector_id)


class UserPortfolioView(generics.ListCreateAPIView):
    """
    API endpoint for a logged-in user to view their saved stocks or add a new one.
    Requires the user to be authenticated.
    """
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only return the portfolio items that belong to the user making the request
        return Portfolio.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # When a new stock is added to the portfolio, automatically link it to the requesting user
        serializer.save(user=self.request.user)
