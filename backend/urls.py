# backend/urls.py
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView # Нужен для главной страницы
from api import views as api_views          # Нужен для страницы деталей

urlpatterns = [
    path('admin/', admin.site.urls),

    # API эндпоинты остаются без изменений
    path('api/', include('api.urls')),

    # --- Маршруты для HTML страниц ---
    # Главная страница (index.html)
    # Django найдет index.html в папке frontend/, т.к. она указана в TEMPLATES['DIRS']
    path('', TemplateView.as_view(template_name='index.html'), name='home'),

    # Страница деталей (venue-detail.html)
    # Вызывает функцию venue_detail_view из api/views.py
    path('venue/<int:pk>/', api_views.venue_detail_view, name='venue-detail-page'), # Используем другое имя, чтобы не конфликтовать с API
    # ---------------------------------
]

# Конфигурация для статики (WhiteNoise сам обработает /static/ в production)
# Настройки static() в DEBUG не обязательны при использовании whitenoise.runserver_nostatic
# from django.conf import settings
# from django.conf.urls.static import static
# if settings.DEBUG:
#     urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
