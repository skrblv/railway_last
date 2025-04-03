# api/views.py
from rest_framework import viewsets
from .models import Venue
from .serializers import VenueSerializer
from django.shortcuts import render # Добавьте импорт render

# --- ViewSet для API (остается без изменений) ---
class VenueViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Venue.objects.all()
    serializer_class = VenueSerializer

# --- Функция View для рендеринга HTML страницы деталей ---
def venue_detail_view(request, pk):
    """
    Эта view функция НЕ загружает данные из БД.
    Ее задача - просто отрендерить HTML-шаблон venue-detail.html,
    передав ему ID запрошенного заведения (pk).
    JavaScript на этой HTML странице затем сам запросит данные из API.
    """
    print(f"[Django View] Rendering venue-detail.html for venue ID: {pk}") # Лог для отладки
    # Передаем 'venue_id' в контекст шаблона
    context = {'venue_id': pk}
    # Django найдет venue-detail.html в папке frontend/, указанной в TEMPLATES['DIRS']
    return render(request, 'venue-detail.html', context)
