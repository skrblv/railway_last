# api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VenueViewSet # Only import VenueViewSet

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'venues', VenueViewSet, basename='venue') # URL prefix: /api/venues/
# --- Remove the registration for plans ---
# router.register(r'plans', PlanViewSet, basename='plan')

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
    path('venue/<int:pk>/', api_views.venue_detail_view, name='venue-detail'),

]
