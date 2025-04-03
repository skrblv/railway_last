# backend/urls.py
from django.contrib import admin
from django.urls import path, include
# УДАЛИТЕ: from django.views.generic import TemplateView
# УДАЛИТЕ: from api import views as api_views (если осталось)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')), # Оставляем ТОЛЬКО API и админку

    # --- УБЕДИТЕСЬ, ЧТО ЭТОЙ СТРОКИ ТОЧНО НЕТ ---
    # path('', TemplateView.as_view(template_name='index.html'), name='home'),
    # ------------------------------------------
]

# Настройки static() для DEBUG больше не нужны, если используете
# 'whitenoise.runserver_nostatic'
