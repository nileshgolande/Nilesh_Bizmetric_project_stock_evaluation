from rest_framework import serializers
from .models import Sector, Stock, Portfolio
from .services import fetch_live_snapshot
from .recommendations import build_portfolio_recommendation_map, get_base_signal_for_symbol

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
    portfolio_name = serializers.CharField(read_only=True)
    symbol = serializers.CharField(source='stock.symbol', read_only=True)
    company_name = serializers.SerializerMethodField()
    live_price = serializers.SerializerMethodField()
    day_change_percent = serializers.SerializerMethodField()
    market_cap = serializers.SerializerMethodField()
    sparkline_7d = serializers.SerializerMethodField()
    price_direction = serializers.SerializerMethodField()
    annualized_return = serializers.SerializerMethodField()
    volatility = serializers.SerializerMethodField()
    cluster_label = serializers.SerializerMethodField()
    predicted_price_7d = serializers.SerializerMethodField()
    forecast_line_7d = serializers.SerializerMethodField()
    rsi_14 = serializers.SerializerMethodField()
    buy_signal = serializers.SerializerMethodField()
    lr_forecast_2d = serializers.SerializerMethodField()
    logistic_signal = serializers.SerializerMethodField()
    cnn_next_2_days = serializers.SerializerMethodField()
    rnn_next_2_days = serializers.SerializerMethodField()
    logistic_accuracy = serializers.SerializerMethodField()
    cnn_rmse = serializers.SerializerMethodField()
    rnn_rmse = serializers.SerializerMethodField()

    def _include_live(self):
        return bool(self.context.get('include_live', True))

    def _include_analytics(self):
        return bool(self.context.get('include_analytics', True))

    def _get_live_snapshot(self, obj):
        if not self._include_live():
            return {}
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

    def _empty_recommendation_metrics(self):
        cached = self.context.get('_empty_portfolio_metrics')
        if cached is not None:
            return cached
        cached = {
            'annualized_return': None,
            'volatility': None,
            'cluster_label': None,
            'predicted_price_7d': None,
            'forecast_line_7d': [],
            'rsi_14': None,
            'buy_signal': False,
            'lr_forecast_2d': [None, None],
            'logistic_signal': None,
            'cnn_next_2_days': [None, None],
            'rnn_next_2_days': [None, None],
            'logistic_accuracy': None,
            'cnn_rmse': None,
            'rnn_rmse': None,
        }
        self.context['_empty_portfolio_metrics'] = cached
        return cached

    def _get_recommendation_map(self):
        if not self._include_analytics():
            return {}
        recommendation_map = self.context.get('_portfolio_recommendation_map')
        if recommendation_map is not None:
            return recommendation_map

        incoming_map = self.context.get('portfolio_recommendation_map')
        if incoming_map is not None:
            self.context['_portfolio_recommendation_map'] = incoming_map
            return incoming_map

        symbols = []
        instance = getattr(self, 'instance', None)
        if instance is not None:
            try:
                symbols = [
                    item.stock.symbol
                    for item in instance
                    if getattr(item, 'stock', None) and getattr(item.stock, 'symbol', None)
                ]
            except TypeError:
                stock = getattr(instance, 'stock', None)
                if stock and getattr(stock, 'symbol', None):
                    symbols = [stock.symbol]

        recommendation_map = build_portfolio_recommendation_map(symbols)
        self.context['_portfolio_recommendation_map'] = recommendation_map
        return recommendation_map

    def _get_recommendation_metrics(self, obj):
        if not self._include_analytics():
            return self._empty_recommendation_metrics()
        symbol = getattr(obj.stock, 'symbol', '').upper()
        recommendation_map = self._get_recommendation_map()
        if symbol in recommendation_map:
            return recommendation_map[symbol]

        base_signal = get_base_signal_for_symbol(symbol)
        cluster_label = 'Underperformers'
        if base_signal.get('annualized_return') is not None and base_signal.get('annualized_return') >= 0:
            cluster_label = 'Safe Haven' if (base_signal.get('volatility') or 0) <= 22 else 'Aggressive Growth'

        predicted = base_signal.get('predicted_price_7d')
        current_price = base_signal.get('current_price')
        rsi_14 = base_signal.get('rsi_14')
        predicted_positive = (
            current_price is not None
            and current_price > 0
            and predicted is not None
            and predicted > current_price * 1.05
        )
        cluster_positive = cluster_label in {'Safe Haven', 'Aggressive Growth'}

        if predicted_positive and rsi_14 is not None and rsi_14 < 40 and cluster_positive:
            buy_signal = True
        elif cluster_label == 'Underperformers' or (rsi_14 is not None and rsi_14 > 70):
            buy_signal = False
        else:
            buy_signal = False

        return {
            **base_signal,
            'cluster_label': cluster_label,
            'buy_signal': buy_signal,
        }

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

    def get_annualized_return(self, obj):
        return self._get_recommendation_metrics(obj).get('annualized_return')

    def get_volatility(self, obj):
        return self._get_recommendation_metrics(obj).get('volatility')

    def get_cluster_label(self, obj):
        return self._get_recommendation_metrics(obj).get('cluster_label')

    def get_predicted_price_7d(self, obj):
        return self._get_recommendation_metrics(obj).get('predicted_price_7d')

    def get_forecast_line_7d(self, obj):
        return self._get_recommendation_metrics(obj).get('forecast_line_7d') or []

    def get_rsi_14(self, obj):
        return self._get_recommendation_metrics(obj).get('rsi_14')

    def get_buy_signal(self, obj):
        return bool(self._get_recommendation_metrics(obj).get('buy_signal'))

    def get_lr_forecast_2d(self, obj):
        return self._get_recommendation_metrics(obj).get('lr_forecast_2d') or [None, None]

    def get_logistic_signal(self, obj):
        return self._get_recommendation_metrics(obj).get('logistic_signal')

    def get_cnn_next_2_days(self, obj):
        return self._get_recommendation_metrics(obj).get('cnn_next_2_days') or [None, None]

    def get_rnn_next_2_days(self, obj):
        return self._get_recommendation_metrics(obj).get('rnn_next_2_days') or [None, None]

    def get_logistic_accuracy(self, obj):
        return self._get_recommendation_metrics(obj).get('logistic_accuracy')

    def get_cnn_rmse(self, obj):
        return self._get_recommendation_metrics(obj).get('cnn_rmse')

    def get_rnn_rmse(self, obj):
        return self._get_recommendation_metrics(obj).get('rnn_rmse')

    class Meta:
        model = Portfolio
        fields = [
            'id', 'user', 'stock', 'portfolio_name', 'stock_details', 'symbol', 'company_name',
            'live_price', 'day_change_percent', 'market_cap', 'sparkline_7d',
            'price_direction', 'annualized_return', 'volatility', 'cluster_label',
            'predicted_price_7d', 'forecast_line_7d', 'rsi_14',
            'buy_signal', 'added_on', 'lr_forecast_2d',
            'logistic_signal', 'cnn_next_2_days', 'rnn_next_2_days',
            'logistic_accuracy', 'cnn_rmse', 'rnn_rmse'
        ]
        read_only_fields = [
            'user', 'portfolio_name', 'symbol', 'company_name', 'live_price', 'day_change_percent',
            'market_cap', 'sparkline_7d', 'price_direction',
            'annualized_return', 'volatility', 'cluster_label',
            'predicted_price_7d', 'forecast_line_7d', 'rsi_14',
            'buy_signal', 'lr_forecast_2d',
            'logistic_signal', 'cnn_next_2_days', 'rnn_next_2_days',
            'logistic_accuracy', 'cnn_rmse', 'rnn_rmse'
        ]
