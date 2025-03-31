# api/views.py
from rest_framework import viewsets
from .models import Venue, Plan
from .serializers import VenueSerializer, PlanSerializer

class VenueViewSet(viewsets.ReadOnlyModelViewSet): # Provides list and detail views (GET)
    queryset = Venue.objects.all() # Get all Venue objects from the database
    serializer_class = VenueSerializer

class PlanViewSet(viewsets.ReadOnlyModelViewSet): # Provides list and detail views (GET)
    queryset = Plan.objects.all() # Get all Plan objects
    serializer_class = PlanSerializer

# Note: We use ReadOnlyModelViewSet because our frontend currently only needs to READ data.
# If you needed to CREATE/UPDATE/DELETE from the frontend API later, you'd use ModelViewSet.