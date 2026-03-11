from django.shortcuts import render
from django.core.cache import cache
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

# Adjust this import based on where your function is located. 
# For example, if it's in a file called services.py:
from .services import analyze_stock_eda 


@api_view(['GET'])
def get_stock_eda(request, symbol):
    """
    API endpoint that takes a stock symbol, performs EDA, 
    and returns the results as JSON.
    Includes caching for improved performance.
    """
    try:
        # Ensure the symbol is uppercase for consistency
        symbol = symbol.upper()
        
        # Call your EDA function (which now includes caching)
        eda_results = analyze_stock_eda(symbol)
        
        # Check if results are empty (e.g., invalid ticker)
        if not eda_results:
            return Response(
                {"error": f"No data found for symbol: {symbol}"}, 
                status=status.HTTP_404_NOT_FOUND
            )
            
        # Return the dictionary directly; DRF's Response handles the JSON serialization
        return Response(eda_results, status=status.HTTP_200_OK)
        
    except Exception as e:
        # Catch unexpected errors to prevent the server from crashing
        return Response(
            {"error": "An error occurred during analysis.", "details": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
