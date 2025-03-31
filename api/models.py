# api/models.py
from django.db import models

class Venue(models.Model):
    name = models.CharField(max_length=100)
    image_url = models.URLField(max_length=500, blank=True, null=True) # URL to the image
    date_text = models.CharField(max_length=50, blank=True)
    rating_stars = models.IntegerField(default=0) # 0 to 5 stars
    rating_text = models.CharField(max_length=150, blank=True)
    venue_icon1 = models.CharField(max_length=10, blank=True) # Store emoji or short code
    venue_icon2 = models.CharField(max_length=10, blank=True) # Store emoji or short code
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    # Add any other fields you might need

    def __str__(self):
        # This is how the venue will be displayed in the admin panel list
        return self.name

class Plan(models.Model):
    THEME_CHOICES = [
        ('positive', 'Positive / Bright'),
        ('sad', 'Sad / Darker'),
        # Add other themes if needed
    ]

    name = models.CharField(max_length=100, unique=True) # e.g., "Plan A", "Plan B"
    theme = models.CharField(max_length=20, choices=THEME_CHOICES, default='positive')
    notes = models.TextField(blank=True) # For your descriptions
    song_url = models.URLField(max_length=500, blank=True, null=True) # URL for the song file
    album_art_url = models.URLField(max_length=500, blank=True, null=True) # URL for album art
    track_title = models.CharField(max_length=150, blank=True)
    artist_name = models.CharField(max_length=150, blank=True)
    # Add fields for other plan-specific things if needed

    def __str__(self):
        return f"{self.name} ({self.get_theme_display()})" # Display name and theme in admin