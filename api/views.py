# api/views.py
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from .models import Venue
from .serializers import VenueSerializer

def venue_detail_view(request, pk):
    # Используем get_object_or_404, чтобы получить объект по pk или вернуть 404, если объект не найден
    venue = get_object_or_404(Venue, pk=pk)
    # Сериализуем объект для возвращения в виде JSON
    serializer = VenueSerializer(venue)
    return JsonResponse(serializer.data)
