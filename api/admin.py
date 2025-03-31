# api/admin.py
from django.contrib import admin
from .models import Venue, Plan # Import your models

# Simple registration:
admin.site.register(Venue)
admin.site.register(Plan)

# You can customize the admin display later if needed
# Example customization (optional for now):
# class VenueAdmin(admin.ModelAdmin):
#     list_display = ('name', 'date_text', 'rating_stars') # Columns to show in list view
#     search_fields = ('name', 'rating_text') # Add a search bar

# admin.site.register(Venue, VenueAdmin) # Register with customization