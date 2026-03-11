from django.db import models

from django.contrib.auth.models import User

class Sector(models.Model):
    name = models.CharField(max_length=100, unique=True)
    
    def __str__(self):
        return self.name

class Stock(models.Model):
    # Core stock info
    symbol = models.CharField(max_length=20, unique=True)
    company_name = models.CharField(max_length=255, null=True, blank=True)
    
    # Connects the stock to the Sector table using a Foreign Key
    sector = models.ForeignKey(Sector, on_delete=models.CASCADE, related_name='stocks')
    
    # Analysis data from yfinance
    pe_ratio = models.FloatField(null=True, blank=True)
    current_price = models.FloatField(null=True, blank=True)
    fifty_two_week_high = models.FloatField(null=True, blank=True)
    fifty_two_week_low = models.FloatField(null=True, blank=True)
    discount_price = models.FloatField(null=True, blank=True)

    def __str__(self):
        return self.symbol

class Portfolio(models.Model):
    # Connects the portfolio to the logged-in User
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='portfolio_items')
    
    # Connects the portfolio to the Stock table using a Foreign Key
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='in_portfolios')
    portfolio_name = models.CharField(max_length=100, default='General')
    
    added_on = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ensures a user can't add the exact same stock to their portfolio twice
        unique_together = ('user', 'stock')

    def __str__(self):
        return f"{self.user.username} - {self.portfolio_name} - {self.stock.symbol}"
