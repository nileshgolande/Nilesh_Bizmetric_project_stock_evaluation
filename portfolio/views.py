from django.db.models import Count
from django.db import IntegrityError
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Sector, Stock, Portfolio
from .serializers import SectorSerializer, StockSerializer, PortfolioSerializer
from .services import search_tickers, fetch_live_snapshot, fetch_market_pulse, fetch_market_ticker
from .recommendations import build_portfolio_recommendation_map

DEFAULT_PORTFOLIO_NAME = 'General'


def normalize_portfolio_name(value):
    normalized = str(value or '').strip()
    if not normalized:
        return DEFAULT_PORTFOLIO_NAME
    return normalized[:100]


def _parse_bool(value, default=True):
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'y'}


class StockListView(generics.ListAPIView):
    """
    API endpoint that returns all stocks across all sectors.
    Public - no authentication required.
    Supports pagination and optional live data enrichment.
    """
    queryset = Stock.objects.select_related('sector').order_by('-current_price', 'symbol')
    serializer_class = StockSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # Optional filtering by sector
        sector_id = self.request.query_params.get('sector_id')
        if sector_id:
            queryset = queryset.filter(sector_id=sector_id)
        
        # Limit to top 30 as per user requirement
        return queryset[:30]
    
    def list(self, request, *args, **kwargs):
        # Check if live data is requested
        include_live = request.query_params.get('include_live', 'false').lower() == 'true'
        
        # We override list to handle the slicing manually if needed, but get_queryset[:30] handles it
        response = super().list(request, *args, **kwargs)
        
        # Optionally enrich with live data (can be slow, so make it optional)
        if include_live and response.data:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            import threading
            
            results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
            
            def enrich_stock(stock_data):
                symbol = stock_data.get('symbol')
                if not symbol:
                    return stock_data
                try:
                    snapshot = fetch_live_snapshot(symbol, include_metadata=False)
                    stock_data['live_price'] = snapshot.get('current_price')
                    stock_data['day_change_percent'] = snapshot.get('day_change_percent')
                    stock_data['sparkline_7d'] = snapshot.get('sparkline_7d', [])
                    stock_data['market_cap'] = snapshot.get('market_cap')
                except Exception:
                    pass  # Keep original data if live fetch fails
                return stock_data
            
            # Use threading for parallel fetching (limit to 30 concurrent requests)
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = {executor.submit(enrich_stock, stock): stock for stock in results[:30]} 
                for future in as_completed(futures):
                    pass  # Results are modified in place
            
            if isinstance(response.data, dict):
                response.data['results'] = results
            else:
                response.data = results
        
        return response


class StockSearchView(APIView):
    """
    Search stocks by symbol/company with type-ahead results.
    Optional filtering by sector.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        query = (request.query_params.get('q') or '').strip()
        sector_name = (request.query_params.get('sector_name') or '').strip()
        
        if not query and not sector_name:
            return Response([])

        suggestions = search_tickers(query, max_results=10)
        
        # If we have a sector filter, we should filter the suggestions or use a different search
        if sector_name:
            # Try to filter suggestions or just search from our DB
            fallback_stocks = Stock.objects.filter(
                Q(symbol__icontains=query) | Q(company_name__icontains=query)
            ).filter(sector__name__iexact=sector_name).select_related('sector')[:10]
        else:
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


class TopSectorsView(generics.ListAPIView):
    """
    Returns top 5 trending sectors (based on stock count for now).
    """
    queryset = Sector.objects.annotate(stock_count=Count('stocks')).order_by('-stock_count')[:5]
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
        return Stock.objects.filter(sector_id=sector_id).order_by('-current_price')[:30]



class UserPortfolioView(generics.ListCreateAPIView):
    """
    API endpoint for a logged-in user to view their saved stocks or add a new one.
    """
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user).select_related('stock', 'stock__sector').order_by('portfolio_name', '-added_on')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        include_live = _parse_bool(self.request.query_params.get('include_live'), default=True)
        include_analytics = _parse_bool(self.request.query_params.get('include_analytics'), default=False)
        context['include_live'] = include_live
        context['include_analytics'] = include_analytics

        if include_analytics:
            symbols = list(self.get_queryset().values_list('stock__symbol', flat=True))
            context['portfolio_recommendation_map'] = build_portfolio_recommendation_map(symbols)
        return context

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        items = list(serializer.data)

        grouped_portfolios = {}
        for item in items:
            portfolio_name = normalize_portfolio_name(item.get('portfolio_name'))
            grouped_portfolios.setdefault(portfolio_name, []).append(item)

        portfolio_names = sorted(
            grouped_portfolios.keys(),
            key=lambda name: (name.lower() != DEFAULT_PORTFOLIO_NAME.lower(), name.lower())
        )
        ordered_grouped_portfolios = {name: grouped_portfolios[name] for name in portfolio_names}

        return Response(
            {
                'portfolios': ordered_grouped_portfolios,
                'portfolio_names': portfolio_names,
                'items': items,
            },
            status=status.HTTP_200_OK
        )

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
        portfolio_name = normalize_portfolio_name(
            request.data.get('portfolio_sector') or request.data.get('portfolio_name')
        )
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

        moved = False
        try:
            portfolio_item, created = Portfolio.objects.get_or_create(
                user=request.user,
                stock=stock_obj,
                defaults={'portfolio_name': portfolio_name},
            )
        except IntegrityError:
            portfolio_item = Portfolio.objects.get(user=request.user, stock=stock_obj)
            created = False

        if not created and portfolio_item.portfolio_name != portfolio_name:
            portfolio_item.portfolio_name = portfolio_name
            portfolio_item.save(update_fields=['portfolio_name'])
            moved = True

        recommendation_map = build_portfolio_recommendation_map([stock_obj.symbol])
        serializer = PortfolioSerializer(
            portfolio_item,
            context={
                'request': request,
                'portfolio_recommendation_map': recommendation_map,
            },
        )
        return Response(
            {'created': created, 'moved': moved, 'item': serializer.data},
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

    def get_serializer_context(self):
        context = super().get_serializer_context()
        obj = self.get_object()
        symbol = getattr(getattr(obj, 'stock', None), 'symbol', None)
        context['portfolio_recommendation_map'] = build_portfolio_recommendation_map([symbol] if symbol else [])
        return context
