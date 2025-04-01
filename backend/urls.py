from django.contrib import admin
from django.urls import path, include
from django.shortcuts import render  # Добавляем render для шаблонов

# Представление для рендеринга HTML-страницы
def home(request):
    return render(request, "index.html")  # Покажет index.html из frontend/assets

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
    path("", home),  # Открываем HTML на главной странице
]
