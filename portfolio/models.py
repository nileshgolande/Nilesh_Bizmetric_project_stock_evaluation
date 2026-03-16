from django.db import models
from django.conf import settings


class Sector(models.Model):
    """Stock sector/category (e.g., IT, Healthcare, Energy)."""
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Stock(models.Model):
    """Stock ticker with metadata and price data."""
    symbol = models.CharField(max_length=20, unique=True, db_index=True)
    company_name = models.CharField(max_length=255, null=True, blank=True)
    sector = models.ForeignKey(Sector, on_delete=models.SET_NULL, null=True, related_name='stocks')
    pe_ratio = models.FloatField(null=True, blank=True)
    current_price = models.FloatField(null=True, blank=True)
    fifty_two_week_high = models.FloatField(null=True, blank=True)
    fifty_two_week_low = models.FloatField(null=True, blank=True)
    discount_price = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['symbol']

    def __str__(self):
        return f"{self.symbol} ({self.company_name or 'N/A'})"


class Portfolio(models.Model):
    """User's saved stock (watchlist/portfolio item)."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='portfolio_items'
    )
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='portfolio_entries')
    portfolio_name = models.CharField(max_length=100, default='General')
    added_on = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-added_on']
        unique_together = [['user', 'stock']]

    def __str__(self):
        return f"{self.user.username}: {self.stock.symbol} ({self.portfolio_name})"
