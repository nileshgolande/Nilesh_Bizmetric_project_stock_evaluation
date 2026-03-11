from django.shortcuts import render
from django.views.generic import TemplateView
from pathlib import Path
import os

class HomeView(TemplateView):
    """
    View to serve the main index.html file
    """
    template_name = 'index.html'
    
    def get_template_names(self):
        # Get the path to index.html in the core directory
        base_dir = Path(__file__).resolve().parent
        template_path = base_dir / 'index.html'
        
        # Check if the file exists
        if template_path.exists():
            return [str(template_path)]
        return ['index.html']  # Fallback
