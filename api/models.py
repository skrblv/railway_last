# api/models.py
from django.db import models

class Venue(models.Model):
    # --- Existing Venue Fields ---
    name = models.CharField(max_length=100)
    image_url = models.URLField(max_length=500, blank=True, null=True) # URL to the main venue image
    date_text = models.CharField(max_length=50, blank=True) # Example: "APRIL 5-6" or description
    rating_stars = models.IntegerField(default=0) # 0 to 5 stars (used in original swiper card)
    rating_text = models.CharField(max_length=150, blank=True) # Example: "View ratings & reviews" (used in original swiper card)
    venue_icon1 = models.CharField(max_length=10, blank=True) # Emoji/icon (used in original swiper card)
    venue_icon2 = models.CharField(max_length=10, blank=True) # Emoji/icon (used in original swiper card)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    # Add detail page specific fields if they differ from swiper card fields
    detail_image_url1 = models.URLField(max_length=500, blank=True, null=True) # Optional: Specific image for detail page
    detail_image_url2 = models.URLField(max_length=500, blank=True, null=True) # Optional: Another specific image
    detail_description = models.TextField(blank=True) # Longer description for detail page

    # --- Positive Plan Fields ---
    positive_notes = models.TextField(blank=True, help_text="Notes for the positive theme/plan.")
    positive_song_url = models.URLField(max_length=500, blank=True, null=True)
    positive_album_art_url = models.URLField(max_length=500, blank=True, null=True)
    positive_track_title = models.CharField(max_length=150, blank=True)
    positive_artist_name = models.CharField(max_length=150, blank=True)

    # --- Sad Plan Fields ---
    sad_notes = models.TextField(blank=True, help_text="Notes for the sad theme/plan.")
    sad_song_url = models.URLField(max_length=500, blank=True, null=True)
    sad_album_art_url = models.URLField(max_length=500, blank=True, null=True)
    sad_track_title = models.CharField(max_length=150, blank=True)
    sad_artist_name = models.CharField(max_length=150, blank=True)

    def __str__(self):
        return self.name

# --- Remove the old Plan model ---
# class Plan(models.Model):
#     ... (delete this entire model) ...
