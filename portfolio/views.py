from django.shortcuts import render
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Sector, Stock, Portfolio
from .serializers import SectorSerializer, StockSerializer, PortfolioSerializer


class StockListView(generics.ListAPIView):
    """
    API endpoint that returns all stocks across all sectors.
    Public - no authentication required.
    """
    queryset = Stock.objects.select_related('sector').order_by('sector__name', 'symbol')
    serializer_class = StockSerializer
    permission_classes = [AllowAny]


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
        return Portfolio.objects.filter(user=self.request.user).select_related('stock', 'stock__sector')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PortfolioDetailView(generics.RetrieveDestroyAPIView):
    """
    API endpoint to retrieve or delete a single portfolio item.
    Users can only delete their own portfolio items.
    """
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)
