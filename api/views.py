# api/views.py
from rest_framework import viewsets
from .models import Venue # Only import Venue
from .serializers import VenueSerializer # Only import VenueSerializer

class VenueViewSet(viewsets.ReadOnlyModelViewSet): # Provides list and detail views (GET)
    queryset = Venue.objects.all() # Get all Venue objects from the database
    serializer_class = VenueSerializer

# --- Remove the old PlanViewSet ---
# class PlanViewSet(viewsets.ReadOnlyModelViewSet):
#     ... (delete this entire viewset) ...
