# backend/urls.py
from django.contrib import admin
from django.urls import path, include # Make sure 'include' is imported

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')), # Add this line to include your app's URLs under /api/
    # You might add paths for serving the frontend later
]