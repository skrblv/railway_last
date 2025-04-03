# backend/urls.py
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from api import views as api_views # Import your api views

urlpatterns = [
    path('admin/', admin.site.urls),

    # API Endpoints (Keep these)
    path('api/', include('api.urls')), # Make sure you have api/urls.py set up for the ViewSets

    # Frontend Pages
    path('', TemplateView.as_view(template_name='index.html'), name='home'), # Main page

    # +++ ADD THIS URL PATTERN +++
    # Matches URLs like /venue/1/, /venue/15/, etc.
    # Calls the venue_detail_view function from api/views.py
    # The <int:pk> captures the number after /venue/ and passes it as 'pk' to the view
    path('venue/<int:pk>/', api_views.venue_detail_view, name='venue-detail'),
    # ++++++++++++++++++++++++++++

]

# Static file serving configuration (Ensure Whitenoise setup is correct in settings.py for production)
# The {% static %} tag relies on STATIC_URL setting.
