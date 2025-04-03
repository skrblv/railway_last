# backend/urls.py
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')), # Оставляем ТОЛЬКО API и админку
]

# Если у вас есть настройки для статики в DEBUG, они могут остаться,
# но строки path('', ...) и path('venue/<int:pk>/', ...) быть НЕ ДОЛЖНО.
