import yfinance as yf
from django.core.management.base import BaseCommand
from portfolio.models import Sector, Stock

class Command(BaseCommand):
    help = 'Fetches stock data from yfinance and populates the database'

    def handle(self, *args, **kwargs):
        # Define 4 sectors and 10 stock symbols for each
        # You can change these to any symbols you prefer (e.g., Indian stocks like 'RELIANCE.NS')
        sectors_data = {
            "Technology": ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "INTC", "CSCO", "ORCL", "IBM", "TXN"],
            "Finance": ["JPM", "BAC", "WFC", "C", "GS", "MS", "AXP", "V", "MA", "PYPL"],
            "Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "TMO", "MRK", "DHR", "LLY", "ABT", "BMY"],
            "Energy": ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PXD", "VLO", "OXY", "PSX"]
        }

        for sector_name, tickers in sectors_data.items():
            # Get or create the sector in the database
            sector_obj, created = Sector.objects.get_or_create(name=sector_name)
            self.stdout.write(f"--- Processing Sector: {sector_name} ---")

            for symbol in tickers:
                self.stdout.write(f"Fetching data for {symbol}...")
                
                try:
                    ticker = yf.Ticker(symbol)
                    info = ticker.info

                    # Extract the required fields safely using .get() to avoid errors if data is missing
                    current_price = info.get('currentPrice', info.get('regularMarketPrice'))
                    fifty_two_week_high = info.get('fiftyTwoWeekHigh')
                    fifty_two_week_low = info.get('fiftyTwoWeekLow')
                    pe_ratio = info.get('trailingPE')
                    company_name = info.get('shortName', symbol)

                    # Calculate discount price (How much it has dropped from its 52-week high)
                    discount_price = None
                    if fifty_two_week_high and current_price:
                        discount_price = round(fifty_two_week_high - current_price, 2)

                    # Update or create the stock record in the database
                    Stock.objects.update_or_create(
                        symbol=symbol,
                        defaults={
                            'company_name': company_name,
                            'sector': sector_obj,
                            'pe_ratio': pe_ratio,
                            'current_price': current_price,
                            'fifty_two_week_high': fifty_two_week_high,
                            'fifty_two_week_low': fifty_two_week_low,
                            'discount_price': discount_price
                        }
                    )
                    self.stdout.write(self.style.SUCCESS(f"Successfully saved {symbol}"))

                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Failed to fetch {symbol}: {e}"))

        self.stdout.write(self.style.SUCCESS('Data fetching and database population complete!'))