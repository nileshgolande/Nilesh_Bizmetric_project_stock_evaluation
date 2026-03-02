from django.shortcuts import render

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .serializers import UserSerializer

class RegisterView(APIView):
    """
    API endpoint to register a new user.
    """
    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Generate a token for the newly registered user
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key, 
                'user_id': user.id,
                'message': 'User created successfully.'
            }, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    """
    API endpoint to log in a user and return an auth token.
    """
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        # Authenticate checks the hashed password in the database
        user = authenticate(username=username, password=password)
        
        if user:
            # Retrieve the existing token or create a new one if it doesn't exist
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key, 
                'user_id': user.id
            }, status=status.HTTP_200_OK)
            
        return Response(
            {'error': 'Invalid username or password'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )