import yfinance as yf
import pandas as pd
import numpy as np

def analyze_stock_eda(symbol):
    """
    Fetches 1 year of historical stock data and calculates key EDA metrics.
    
    Args:
        symbol (str): The stock ticker symbol (e.g., 'AAPL').
        
    Returns:
        dict: A dictionary containing the calculated metrics, or an empty dict if data is not found.
    """
    ticker = yf.Ticker(symbol)
    
    # Pull 1 year of historical data
    df = ticker.history(period="1y")
    
    # If the dataframe is empty, the ticker is likely invalid
    if df.empty:
        return {}

    # Calculate daily returns
    df['Daily_Return'] = df['Close'].pct_change()
    
    current_price = df['Close'].iloc[-1]
    
    # Helper to calculate returns based on trading days (approx: 3mo=63, 6mo=126)
    def calculate_period_return(days_back):
        if len(df) > days_back:
            past_price = df['Close'].iloc[-(days_back + 1)]
            return (current_price - past_price) / past_price
        return None

    return_3m = calculate_period_return(63)
    return_6m = calculate_period_return(126)
    # 1-year return compares current price to the very first price in the 1y dataset
    return_1y = (current_price - df['Close'].iloc[0]) / df['Close'].iloc[0]
    
    # 30-day Volatility (Annualized using standard ~252 trading days)
    volatility_30d = df['Daily_Return'].tail(30).std() * np.sqrt(252)
    
    # Best and Worst Daily Return
    best_daily_return = df['Daily_Return'].max()
    worst_daily_return = df['Daily_Return'].min()
    
    # Maximum Drawdown
    rolling_peak = df['Close'].cummax()
    drawdown = (df['Close'] - rolling_peak) / rolling_peak
    max_drawdown = drawdown.min()
    
    # Get the date of the max drawdown (handling timezone-aware pandas timestamps)
    max_drawdown_date = None
    if pd.notnull(max_drawdown):
        max_drawdown_date = drawdown.idxmin().strftime('%Y-%m-%d')
        
    # Categorize Market Cap
    info = ticker.info
    market_cap = info.get('marketCap', 0)
    
    if market_cap >= 200_000_000_000:
        cap_category = "Mega Cap"
    elif market_cap >= 10_000_000_000:
        cap_category = "Large Cap"
    elif market_cap >= 2_000_000_000:
        cap_category = "Mid Cap"
    elif market_cap >= 300_000_000:
        cap_category = "Small Cap"
    elif market_cap > 0:
        cap_category = "Micro/Nano Cap"
    else:
        cap_category = "Unknown"

    # Compile the results into a dictionary
    results = {
        "symbol": symbol.upper(),
        "current_price": round(current_price, 2),
        "returns_percentage": {
            "3_month": round(return_3m * 100, 2) if return_3m is not None else None,
            "6_month": round(return_6m * 100, 2) if return_6m is not None else None,
            "1_year": round(return_1y * 100, 2)
        },
        "volatility_30d_percentage": round(volatility_30d * 100, 2) if pd.notnull(volatility_30d) else None,
        "daily_returns_percentage": {
            "best": round(best_daily_return * 100, 2) if pd.notnull(best_daily_return) else None,
            "worst": round(worst_daily_return * 100, 2) if pd.notnull(worst_daily_return) else None
        },
        "maximum_drawdown": {
            "percentage": round(max_drawdown * 100, 2) if pd.notnull(max_drawdown) else None,
            "date": max_drawdown_date
        },
        "market_capitalization": {
            "value": market_cap,
            "category": cap_category
        }
    }
    
    return results