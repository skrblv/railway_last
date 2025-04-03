# backend/urls.py
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from api import views as api_views  # Импортируйте ваши представления из api

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),  # Включаем API маршруты

    # Frontend Pages
    path('', TemplateView.as_view(template_name='index.html'), name='home'),  # Главная страница


    # Динамический маршрут для деталей места
    path('venue/<int:pk>/', api_views.venue_detail_view, name='venue-detail'),  # Добавьте этот путь
]
