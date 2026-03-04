from rest_framework import serializers
from .models import Sector, Stock, Portfolio
from .services import fetch_live_snapshot

class StockSerializer(serializers.ModelSerializer):
    sector_name = serializers.CharField(source='sector.name', read_only=True)
    sector_id = serializers.IntegerField(source='sector.id', read_only=True)
    trend = serializers.SerializerMethodField()
    live_price = serializers.SerializerMethodField()
    day_change_percent = serializers.SerializerMethodField()
    market_cap = serializers.SerializerMethodField()
    sparkline_7d = serializers.SerializerMethodField()
    insight_badge = serializers.SerializerMethodField()
    avg_discount_52w = serializers.SerializerMethodField()

    def get_trend(self, obj):
        current_price = obj.current_price
        low = obj.fifty_two_week_low
        high = obj.fifty_two_week_high

        if current_price is None or low is None or high is None:
            return 'Unknown'
        if high <= low:
            return 'Unknown'

        position_in_range = (current_price - low) / (high - low)

        if position_in_range >= 0.67:
            return 'Uptrend'
        if position_in_range <= 0.33:
            return 'Downtrend'
        return 'Sideways'

    def get_live_price(self, obj):
        return obj.current_price

    def get_day_change_percent(self, _obj):
        return None

    def get_market_cap(self, _obj):
        return None

    def get_sparkline_7d(self, _obj):
        return []

    def get_insight_badge(self, obj):
        current_price = obj.current_price
        high = obj.fifty_two_week_high
        low = obj.fifty_two_week_low

        if current_price is None or high is None or low is None or high <= low:
            return 'Neutral'

        position_in_range = (current_price - low) / (high - low)
        if position_in_range <= 0.2:
            return 'Undervalued'
        if position_in_range >= 0.85:
            return 'Overbought'
        return 'Neutral'

    def get_avg_discount_52w(self, obj):
        current_price = obj.current_price
        high = obj.fifty_two_week_high
        low = obj.fifty_two_week_low
        if current_price is None or high is None or low is None:
            return None
        average_52w_price = (high + low) / 2
        return round(average_52w_price - current_price, 2)

    class Meta:
        model = Stock
        fields = [
            'id', 'symbol', 'company_name', 'sector_id', 'sector_name',
            'pe_ratio', 'current_price', 'fifty_two_week_high', 
            'fifty_two_week_low', 'discount_price', 'trend', 'live_price',
            'day_change_percent', 'market_cap', 'sparkline_7d', 'insight_badge',
            'avg_discount_52w'
        ]

class SectorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sector
        fields = ['id', 'name']

class PortfolioStockSerializer(serializers.ModelSerializer):
    sector_name = serializers.CharField(source='sector.name', read_only=True)
    avg_discount_52w = serializers.SerializerMethodField()

    def get_avg_discount_52w(self, obj):
        current_price = obj.current_price
        high = obj.fifty_two_week_high
        low = obj.fifty_two_week_low
        if current_price is None or high is None or low is None:
            return None
        average_52w_price = (high + low) / 2
        return round(average_52w_price - current_price, 2)

    class Meta:
        model = Stock
        fields = [
            'id', 'symbol', 'company_name', 'sector_name', 'current_price',
            'pe_ratio', 'fifty_two_week_high', 'fifty_two_week_low',
            'avg_discount_52w', 'discount_price'
        ]

class PortfolioSerializer(serializers.ModelSerializer):
    # We can include the stock details nested inside the portfolio response
    stock_details = PortfolioStockSerializer(source='stock', read_only=True)
    symbol = serializers.CharField(source='stock.symbol', read_only=True)
    company_name = serializers.SerializerMethodField()
    live_price = serializers.SerializerMethodField()
    day_change_percent = serializers.SerializerMethodField()
    market_cap = serializers.SerializerMethodField()
    sparkline_7d = serializers.SerializerMethodField()
    price_direction = serializers.SerializerMethodField()

    def _get_live_snapshot(self, obj):
        cache = self.context.setdefault('_live_snapshot_cache', {})
        symbol = getattr(obj.stock, 'symbol', None)
        if not symbol:
            return {}
        if symbol not in cache:
            try:
                cache[symbol] = fetch_live_snapshot(symbol, include_metadata=False)
            except Exception:
                cache[symbol] = {}
        return cache[symbol]

    def get_company_name(self, obj):
        return getattr(obj.stock, 'company_name', None) or obj.stock.symbol

    def get_live_price(self, obj):
        snapshot = self._get_live_snapshot(obj)
        if snapshot.get('current_price') is not None:
            return snapshot.get('current_price')
        return getattr(obj.stock, 'current_price', None)

    def get_day_change_percent(self, obj):
        snapshot = self._get_live_snapshot(obj)
        return snapshot.get('day_change_percent')

    def get_market_cap(self, obj):
        snapshot = self._get_live_snapshot(obj)
        return snapshot.get('market_cap')

    def get_sparkline_7d(self, obj):
        snapshot = self._get_live_snapshot(obj)
        return snapshot.get('sparkline_7d') or []

    def get_price_direction(self, obj):
        change = self.get_day_change_percent(obj)
        if change is None:
            return 'neutral'
        if change > 0:
            return 'up'
        if change < 0:
            return 'down'
        return 'neutral'

    class Meta:
        model = Portfolio
        fields = [
            'id', 'user', 'stock', 'stock_details', 'symbol', 'company_name',
            'live_price', 'day_change_percent', 'market_cap', 'sparkline_7d',
            'price_direction', 'added_on'
        ]
        read_only_fields = [
            'user', 'symbol', 'company_name', 'live_price', 'day_change_percent',
            'market_cap', 'sparkline_7d', 'price_direction'
        ]
