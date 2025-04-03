# api/admin.py
from django.contrib import admin
from .models import Venue # Only import Venue

# Simple registration:
# admin.site.register(Venue)
# --- Remove Plan registration ---
# admin.site.register(Plan)

# Customized Venue Admin for better editing
@admin.register(Venue)
class VenueAdmin(admin.ModelAdmin):
    list_display = ('name', 'date_text', 'rating_stars', 'latitude', 'longitude')
    search_fields = ('name', 'date_text', 'detail_description')
    list_filter = ('rating_stars',)

    fieldsets = (
        ('General Info', {
            'fields': ('name', 'image_url', 'date_text', 'rating_stars', 'rating_text', 'venue_icon1', 'venue_icon2')
        }),
        ('Detail Page Content', {
            'fields': ('detail_image_url1', 'detail_image_url2', 'detail_description'),
            'classes': ('collapse',) # Make this section collapsible
        }),
        ('Location', {
            'fields': ('latitude', 'longitude'),
            'classes': ('collapse',)
        }),
        ('Positive Plan Details', {
            'fields': ('positive_notes', 'positive_song_url', 'positive_album_art_url', 'positive_track_title', 'positive_artist_name'),
            'classes': ('collapse',)
        }),
        ('Sad Plan Details', {
            'fields': ('sad_notes', 'sad_song_url', 'sad_album_art_url', 'sad_track_title', 'sad_artist_name'),
            'classes': ('collapse',)
        }),
    )

# --- Remove PlanAdmin if it existed ---
