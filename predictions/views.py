from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from .services import get_predictions, ASSETS
from .stock_predictions import get_stock_predictions

class PredictionView(APIView):
    # permission_classes = [IsAuthenticated]
    permission_classes = [AllowAny]

    def get(self, request, asset_type):
        print(f"PredictionView called for {asset_type}")
        if asset_type not in ASSETS:
            return Response({"error": f"Invalid asset type. Must be one of {list(ASSETS.keys())}"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            results, error = get_predictions(asset_type)
            if error:
                return Response({"error": error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            return Response(results)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StockPredictionView(APIView):
    """
    API endpoint for stock predictions (7-day forecast).
    """
    permission_classes = [AllowAny]

    def get(self, request, symbol):
        symbol = symbol.upper().strip()
        days = int(request.query_params.get('days', 7))
        
        if not symbol:
            return Response({"error": "Stock symbol is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if days < 1 or days > 30:
            return Response({"error": "Days must be between 1 and 30"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            results, error = get_stock_predictions(symbol, days=days)
            if error:
                return Response({"error": error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            if results is None:
                return Response({"error": "Failed to generate predictions"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            return Response(results)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
