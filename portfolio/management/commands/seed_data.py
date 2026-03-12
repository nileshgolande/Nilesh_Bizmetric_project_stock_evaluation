from django.core.management.base import BaseCommand
from portfolio.models import Sector, Stock
import yfinance as yf

class Command(BaseCommand):
    help = 'Seeds sectors and top stocks'

    def handle(self, *args, **options):
        sectors = [
            'IT', 'Healthcare', 'Financial Services', 'Consumer Goods', 
            'Energy', 'Industrials', 'Telecommunications', 'Real Estate', 
            'Consumer Services', 'Materials & Mining', 'Automobile', 'Uncategorized'
        ]

        # Sector -> [Ticker symbols]
        top_stocks = {
            'IT': ['AAPL', 'MSFT', 'GOOGL', 'META', 'TSM', 'NVDA', 'ADBE', 'ORCL', 'SAP', 'ASML'],
            'Healthcare': ['JNJ', 'PFE', 'UNH', 'ABBV', 'TMO', 'LLY', 'MRK', 'DHR', 'AZN', 'NVS'],
            'Financial Services': ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'V', 'MA', 'AXP', 'HSBC'],
            'Consumer Goods': ['PG', 'KO', 'PEP', 'NKE', 'PM', 'EL', 'MO', 'MDLZ', 'KMB', 'STZ'],
            'Energy': ['XOM', 'CVX', 'SHEL', 'TTE', 'COP', 'BP', 'PBR', 'ENB', 'EOG', 'SLB'],
            'Industrials': ['CAT', 'UPS', 'GE', 'HON', 'UNP', 'MMM', 'RTX', 'LMT', 'DE', 'BA'],
            'Telecommunications': ['VZ', 'T', 'TMUS', 'ORAN', 'VOD', 'AMX', 'CHTR', 'SKM', 'TEF', 'BCE'],
            'Real Estate': ['AMT', 'PLD', 'CCI', 'EQIX', 'DLR', 'PSA', 'SPG', 'WELL', 'O', 'VICI'],
            'Consumer Services': ['AMZN', 'HD', 'WMT', 'MCD', 'DIS', 'NFLX', 'SBUX', 'LOW', 'BKNG', 'TJX'],
            'Materials & Mining': ['LIN', 'BHP', 'RIO', 'VALE', 'FCX', 'APD', 'SHW', 'ECL', 'NEM', 'CTVA'],
            'Automobile': ['TSLA', 'TM', 'F', 'GM', 'STLA', 'BMW.DE', 'MBG.DE', 'VOW3.DE', 'HMC', 'NSANY'],
            'Uncategorized': ['BTC-USD', 'ETH-USD', 'GC=F', 'SI=F', 'CL=F', 'NG=F', '^GSPC', '^DJI', '^IXIC', '^NSEI']
        }

        self.stdout.write('Seeding sectors and stocks...')

        for sector_name in sectors:
            sector, created = Sector.objects.get_or_create(name=sector_name)
            if created:
                self.stdout.write(f'Created sector: {sector_name}')
            
            symbols = top_stocks.get(sector_name, [])
            for symbol in symbols:
                stock, s_created = Stock.objects.get_or_create(
                    symbol=symbol,
                    defaults={'sector': sector}
                )
                if s_created:
                    self.stdout.write(f'  Added stock: {symbol}')
                    # Optional: Fetch initial data
                    try:
                        t = yf.Ticker(symbol)
                        info = t.info
                        stock.company_name = info.get('shortName', symbol)
                        stock.current_price = info.get('currentPrice') or info.get('regularMarketPrice')
                        stock.pe_ratio = info.get('trailingPE')
                        stock.fifty_two_week_high = info.get('fiftyTwoWeekHigh')
                        stock.fifty_two_week_low = info.get('fiftyTwoWeekLow')
                        stock.save()
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f'    Failed to fetch data for {symbol}: {e}'))

        self.stdout.write(self.style.SUCCESS('Seeding complete!'))
