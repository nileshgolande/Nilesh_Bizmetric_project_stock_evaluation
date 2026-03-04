from django.db import IntegrityError
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Sector, Stock, Portfolio
from .serializers import SectorSerializer, StockSerializer, PortfolioSerializer
from .services import search_tickers, fetch_live_snapshot, fetch_market_pulse, fetch_market_ticker


class StockListView(generics.ListAPIView):
    """
    API endpoint that returns all stocks across all sectors.
    Public - no authentication required.
    """
    queryset = Stock.objects.select_related('sector').order_by('sector__name', 'symbol')
    serializer_class = StockSerializer
    permission_classes = [AllowAny]


class StockSearchView(APIView):
    """
    Search stocks by symbol/company with type-ahead results.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        query = (request.query_params.get('q') or '').strip()
        if not query:
            return Response([])

        suggestions = search_tickers(query, max_results=10)
        if suggestions:
            return Response(suggestions, status=status.HTTP_200_OK)

        fallback_stocks = Stock.objects.filter(
            Q(symbol__icontains=query) | Q(company_name__icontains=query)
        ).select_related('sector')[:10]

        payload = [{
            'symbol': item.symbol,
            'name': item.company_name or item.symbol,
            'exchange': None,
            'type': 'EQUITY',
            'sector': item.sector.name if item.sector_id else None,
        } for item in fallback_stocks]

        return Response(payload, status=status.HTTP_200_OK)


class SectorListView(generics.ListAPIView):
    """
    API endpoint that returns a list of all sectors.
    Accessible to anyone.
    """
    queryset = Sector.objects.all()
    serializer_class = SectorSerializer
    permission_classes = [AllowAny]


class SectorStockListView(generics.ListAPIView):
    """
    API endpoint that returns stocks belonging to a specific sector.
    Accessible to anyone.
    """
    serializer_class = StockSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        sector_id = self.kwargs.get('sector_id')
        return Stock.objects.filter(sector_id=sector_id)


class UserPortfolioView(generics.ListCreateAPIView):
    """
    API endpoint for a logged-in user to view their saved stocks or add a new one.
    """
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user).select_related('stock', 'stock__sector').order_by('-added_on')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AddStockToPortfolioView(APIView):
    """
    Adds a stock to the user's portfolio by ticker symbol.
    The stock metadata/price are fetched from yfinance first.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        symbol = (request.data.get('symbol') or request.data.get('ticker') or '').strip().upper()
        if not symbol:
            return Response(
                {'error': 'Ticker symbol is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            snapshot = fetch_live_snapshot(symbol)
        except Exception as exc:
            return Response(
                {'error': 'Failed to fetch stock data.', 'details': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY
            )

        if not snapshot.get('current_price') and not snapshot.get('company_name'):
            return Response(
                {'error': f'No market data found for symbol {symbol}.'},
                status=status.HTTP_404_NOT_FOUND
            )

        sector_name = (snapshot.get('sector') or 'Uncategorized').strip()[:100] or 'Uncategorized'
        sector_obj, _ = Sector.objects.get_or_create(name=sector_name)

        stock_obj, _ = Stock.objects.update_or_create(
            symbol=symbol,
            defaults={
                'company_name': snapshot.get('company_name') or symbol,
                'sector': sector_obj,
                'pe_ratio': snapshot.get('pe_ratio'),
                'current_price': snapshot.get('current_price'),
                'fifty_two_week_high': snapshot.get('fifty_two_week_high'),
                'fifty_two_week_low': snapshot.get('fifty_two_week_low'),
                'discount_price': snapshot.get('discount_price'),
            }
        )

        try:
            portfolio_item, created = Portfolio.objects.get_or_create(user=request.user, stock=stock_obj)
        except IntegrityError:
            portfolio_item = Portfolio.objects.get(user=request.user, stock=stock_obj)
            created = False

        serializer = PortfolioSerializer(portfolio_item, context={'request': request})
        return Response(
            {'created': created, 'item': serializer.data},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class MarketPulseView(APIView):
    """
    Returns broad market pulse stats for dashboard header cards.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        symbol = (request.query_params.get('symbol') or '^GSPC').strip().upper()

        pulse = fetch_market_pulse(symbol)
        if pulse.get('current_price') is None and symbol == '^GSPC':
            pulse = fetch_market_pulse('^NSEI')

        return Response(pulse, status=status.HTTP_200_OK)


class MarketTickerView(APIView):
    """
    Returns market ticker items for major indices.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(fetch_market_ticker(), status=status.HTTP_200_OK)


class PortfolioDetailView(generics.RetrieveDestroyAPIView):
    """
    API endpoint to retrieve or delete a single portfolio item.
    Users can only delete their own portfolio items.
    """
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)
