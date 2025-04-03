# api/views.py
from rest_framework import viewsets # Убедитесь, что это импортировано
from .models import Venue
from .serializers import VenueSerializer
# УДАЛИТЕ импорты для venue_detail_view, если они были

class VenueViewSet(viewsets.ReadOnlyModelViewSet): # ИСПОЛЬЗУЕТСЯ РОУТЕРОМ
    queryset = Venue.objects.all()
    serializer_class = VenueSerializer

