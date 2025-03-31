# api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VenueViewSet, PlanViewSet

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'venues', VenueViewSet, basename='venue') # URL prefix: /api/venues/
router.register(r'plans', PlanViewSet, basename='plan')     # URL prefix: /api/plans/

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
]