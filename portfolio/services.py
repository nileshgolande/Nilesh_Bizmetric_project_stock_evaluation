import math

from django.core.cache import cache
import yfinance as yf

SEARCH_CACHE_TTL_SECONDS = 120
SNAPSHOT_CACHE_TTL_SECONDS = 300
MARKET_TICKER_CACHE_TTL_SECONDS = 45


def _safe_float(value):
    try:
        if value is None:
            return None
        numeric = float(value)
        if math.isnan(numeric):
            return None
        return numeric
    except (TypeError, ValueError):
        return None


def _extract_company_name(info, fallback_symbol):
    return (
        info.get('shortName')
        or info.get('longName')
        or info.get('displayName')
        or fallback_symbol
    )


def search_tickers(query, max_results=8):
    cleaned_query = (query or '').strip()
    if not cleaned_query:
        return []

    cache_key = f"ticker_search:{cleaned_query.lower()}:{max_results}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        search = yf.Search(
            cleaned_query,
            max_results=max_results,
            news_count=0,
            lists_count=0,
            include_research=False,
            include_cultural_assets=False,
            include_nav_links=False,
            raise_errors=False,
        )
        quotes = getattr(search, 'quotes', []) or []
    except Exception:
        return []

    suggestions = []
    seen_symbols = set()
    for quote in quotes:
        symbol = (quote or {}).get('symbol')
        if not symbol:
            continue

        symbol = symbol.upper()
        if symbol in seen_symbols:
            continue
        seen_symbols.add(symbol)

        suggestions.append({
            'symbol': symbol,
            'name': (
                quote.get('shortname')
                or quote.get('longname')
                or quote.get('name')
                or symbol
            ),
            'exchange': quote.get('exchange'),
            'type': quote.get('quoteType'),
        })

        if len(suggestions) >= max_results:
            break

    cache.set(cache_key, suggestions, SEARCH_CACHE_TTL_SECONDS)
    return suggestions


def fetch_live_snapshot(symbol, include_metadata=True):
    ticker_symbol = (symbol or '').strip().upper()
    if not ticker_symbol:
        return {}

    cache_key = f"live_snapshot:{ticker_symbol}:{'meta' if include_metadata else 'light'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    ticker = yf.Ticker(ticker_symbol)

    try:
        fast_info = dict(ticker.fast_info) if ticker.fast_info else {}
    except Exception:
        fast_info = {}

    info = {}
    if include_metadata:
        try:
            info = ticker.info or {}
        except Exception:
            info = {}

    history = None
    for period in ('7d', '10d', '1mo'):
        try:
            history = ticker.history(period=period, interval='1d')
        except Exception:
            history = None
        if history is not None and not history.empty:
            break

    sparkline_7d = []
    latest_close = None
    previous_close_from_history = None
    if history is not None and not history.empty:
        history_window = history.tail(7)
        for idx, row in history_window.iterrows():
            close_value = _safe_float(row.get('Close'))
            if close_value is None:
                continue
            sparkline_7d.append({
                'date': idx.strftime('%Y-%m-%d'),
                'close': round(close_value, 2),
            })

        if sparkline_7d:
            latest_close = sparkline_7d[-1]['close']
        if len(sparkline_7d) > 1:
            previous_close_from_history = sparkline_7d[-2]['close']

    current_price = (
        _safe_float(fast_info.get('lastPrice'))
        or _safe_float(info.get('currentPrice'))
        or _safe_float(info.get('regularMarketPrice'))
        or latest_close
    )
    previous_close = (
        _safe_float(fast_info.get('previousClose'))
        or _safe_float(info.get('previousClose'))
        or previous_close_from_history
    )

    day_change_percent = None
    if current_price is not None and previous_close not in (None, 0):
        day_change_percent = round(((current_price - previous_close) / previous_close) * 100, 2)

    pe_ratio = _safe_float(info.get('trailingPE'))
    fifty_two_week_high = _safe_float(info.get('fiftyTwoWeekHigh')) or _safe_float(fast_info.get('yearHigh'))
    fifty_two_week_low = _safe_float(info.get('fiftyTwoWeekLow')) or _safe_float(fast_info.get('yearLow'))
    discount_price = (
        round(fifty_two_week_high - current_price, 2)
        if current_price is not None and fifty_two_week_high is not None
        else None
    )

    snapshot = {
        'symbol': ticker_symbol,
        'company_name': _extract_company_name(info, ticker_symbol),
        'sector': info.get('sector') or 'Uncategorized',
        'current_price': round(current_price, 2) if current_price is not None else None,
        'day_change_percent': day_change_percent,
        'market_cap': _safe_float(fast_info.get('marketCap')) or _safe_float(info.get('marketCap')),
        'sparkline_7d': sparkline_7d,
        'pe_ratio': pe_ratio,
        'fifty_two_week_high': fifty_two_week_high,
        'fifty_two_week_low': fifty_two_week_low,
        'discount_price': discount_price,
    }

    cache.set(cache_key, snapshot, SNAPSHOT_CACHE_TTL_SECONDS)
    return snapshot


def fetch_market_pulse(index_symbol='^GSPC'):
    snapshot = fetch_live_snapshot(index_symbol, include_metadata=False)
    change = snapshot.get('day_change_percent')

    if change is None:
        direction = 'neutral'
        status = 'No Signal'
    elif change > 0:
        direction = 'up'
        status = 'Bullish'
    elif change < 0:
        direction = 'down'
        status = 'Bearish'
    else:
        direction = 'neutral'
        status = 'Flat'

    return {
        'symbol': snapshot.get('symbol') or index_symbol,
        'name': snapshot.get('company_name') or index_symbol,
        'current_price': snapshot.get('current_price'),
        'day_change_percent': change,
        'direction': direction,
        'status': status,
    }


def fetch_market_ticker():
    cache_key = 'market_ticker:major_indices'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    indices = [
        {'symbol': '^GSPC', 'label': 'S&P 500'},
        {'symbol': '^IXIC', 'label': 'NASDAQ'},
        {'symbol': '^DJI', 'label': 'DOW 30'},
        {'symbol': '^NSEI', 'label': 'NIFTY 50'},
    ]
    ticker_items = []

    for index in indices:
        pulse = fetch_market_pulse(index['symbol'])
        ticker_items.append({
            'symbol': index['symbol'],
            'label': index['label'],
            'current_price': pulse.get('current_price'),
            'day_change_percent': pulse.get('day_change_percent'),
            'direction': pulse.get('direction'),
        })

    cache.set(cache_key, ticker_items, MARKET_TICKER_CACHE_TTL_SECONDS)
    return ticker_items
