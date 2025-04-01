# api/views.py
from rest_framework import viewsets
from .models import Venue, Plan
from .serializers import VenueSerializer, PlanSerializer
from django.shortcuts import render

class VenueViewSet(viewsets.ReadOnlyModelViewSet): # Provides list and detail views (GET)
    queryset = Venue.objects.all() # Get all Venue objects from the database
    serializer_class = VenueSerializer

class PlanViewSet(viewsets.ReadOnlyModelViewSet): # Provides list and detail views (GET)
    queryset = Plan.objects.all() # Get all Plan objects
    serializer_class = PlanSerializer
def home(request):
    return render(request, "index.html")  # Загружаем HTML-файл

def venue_detail_view(request, pk):
    """
    Renders the venue detail HTML page.
    The actual data fetching happens client-side via JavaScript.
    The 'pk' parameter is captured from the URL but not used directly here.
    """
    return render(request, "venue-detail.html")

# Note: We use ReadOnlyModelViewSet because our frontend currently only needs to READ data.
# If you needed to CREATE/UPDATE/DELETE from the frontend API later, you'd use ModelViewSet.
