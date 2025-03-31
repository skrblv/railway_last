# backend/urls.py
from django.contrib import admin
from django.urls import path, include # Make sure 'include' is imported
from api import views  # Добавьте этот импорт


urlpatterns = [
    path('', views.index, name='index'), 
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')), # Add this line to include your app's URLs under /api/
    # You might add paths for serving the frontend later
]
