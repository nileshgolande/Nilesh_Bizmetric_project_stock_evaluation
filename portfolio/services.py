"""Market data and search services for the portfolio app."""
from django.core.cache import cache

try:
    import yfinance as yf
    YF_AVAILABLE = True
except ImportError:
    YF_AVAILABLE = False

CACHE_TTL = 300  # 5 minutes for live data


def search_tickers(query, max_results=10):
    """
    Search stocks by symbol or company name.
    Returns list of dicts: {symbol, name, exchange, type, sector}.
    """
    if not query or not query.strip():
        return []
    query = query.strip().upper()
    cache_key = f"search_tickers:{query}:{max_results}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    results = []
    if YF_AVAILABLE:
        try:
            # Try direct symbol lookup; yfinance has no built-in search
            ticker = yf.Ticker(query)
            info = ticker.info
            if info and (info.get('symbol') or info.get('regularMarketPrice') is not None):
                results.append({
                    'symbol': info.get('symbol', query),
                    'name': info.get('shortName', info.get('longName', query)),
                    'exchange': info.get('exchange', None),
                    'type': info.get('quoteType', 'EQUITY'),
                    'sector': info.get('sector', None),
                })
        except Exception:
            pass

    cache.set(cache_key, results, 60)  # Cache search for 1 min
    return results


def fetch_live_snapshot(symbol, include_metadata=True):
    """
    Fetch live price and metadata for a symbol.
    Returns dict with: current_price, day_change_percent, sparkline_7d, market_cap,
    company_name, sector, pe_ratio, fifty_two_week_high, fifty_two_week_low, discount_price.
    """
    if not symbol:
        return {}
    symbol = str(symbol).strip().upper()
    cache_key = f"live_snapshot:{symbol}:{include_metadata}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    result = {
        'current_price': None,
        'day_change_percent': None,
        'sparkline_7d': [],
        'market_cap': None,
        'company_name': symbol,
        'sector': 'Uncategorized',
        'pe_ratio': None,
        'fifty_two_week_high': None,
        'fifty_two_week_low': None,
        'discount_price': None,
    }

    if not YF_AVAILABLE:
        return result

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period="7d")

        result['company_name'] = info.get('shortName', info.get('longName', symbol))
        result['current_price'] = info.get('currentPrice') or info.get('regularMarketPrice')
        result['pe_ratio'] = info.get('trailingPE')
        result['fifty_two_week_high'] = info.get('fiftyTwoWeekHigh')
        result['fifty_two_week_low'] = info.get('fiftyTwoWeekLow')
        result['sector'] = (info.get('sector') or 'Uncategorized')[:100]
        result['market_cap'] = info.get('marketCap')

        if include_metadata and result['current_price'] and result['fifty_two_week_high'] and result['fifty_two_week_low']:
            avg_52w = (result['fifty_two_week_high'] + result['fifty_two_week_low']) / 2
            result['discount_price'] = round(avg_52w - result['current_price'], 2)

        if not hist.empty:
            prev_close = hist['Close'].iloc[-2] if len(hist) > 1 else hist['Close'].iloc[-1]
            curr = hist['Close'].iloc[-1]
            if prev_close and prev_close > 0:
                result['day_change_percent'] = round((curr - prev_close) / prev_close * 100, 2)
            result['sparkline_7d'] = [round(float(p), 2) for p in hist['Close'].tolist()]
    except Exception:
        pass

    cache.set(cache_key, result, CACHE_TTL)
    return result


def fetch_market_pulse(symbol):
    """
    Fetch broad market pulse stats for a symbol (e.g. ^GSPC, ^NSEI).
    Returns dict with current_price, day_change_percent, etc.
    """
    snapshot = fetch_live_snapshot(symbol, include_metadata=False)
    return {
        'current_price': snapshot.get('current_price'),
        'day_change_percent': snapshot.get('day_change_percent'),
        'symbol': symbol,
    }


def fetch_market_ticker():
    """
    Returns market ticker items for major indices.
    """
    cache_key = "market_ticker"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    indices = [
        ('^GSPC', 'S&P 500'),
        ('^DJI', 'Dow Jones'),
        ('^IXIC', 'NASDAQ'),
        ('^NSEI', 'Nifty 50'),
    ]

    items = []
    for sym, name in indices:
        pulse = fetch_market_pulse(sym)
        items.append({
            'symbol': sym,
            'name': name,
            'current_price': pulse.get('current_price'),
            'day_change_percent': pulse.get('day_change_percent'),
        })

    cache.set(cache_key, items, 60)  # 1 min cache
    return items
