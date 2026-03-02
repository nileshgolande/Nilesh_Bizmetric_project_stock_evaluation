from rest_framework import serializers
from .models import Sector, Stock, Portfolio

class StockSerializer(serializers.ModelSerializer):
    sector_name = serializers.CharField(source='sector.name', read_only=True)
    sector_id = serializers.IntegerField(source='sector.id', read_only=True)

    class Meta:
        model = Stock
        fields = [
            'id', 'symbol', 'company_name', 'sector_id', 'sector_name',
            'pe_ratio', 'current_price', 'fifty_two_week_high', 
            'fifty_two_week_low', 'discount_price'
        ]

class SectorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sector
        fields = ['id', 'name']

class PortfolioSerializer(serializers.ModelSerializer):
    # We can include the stock details nested inside the portfolio response
    stock_details = StockSerializer(source='stock', read_only=True)

    class Meta:
        model = Portfolio
        fields = ['id', 'user', 'stock', 'stock_details', 'added_on']
        read_only_fields = ['user']