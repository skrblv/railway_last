# api/serializers.py
from rest_framework import serializers
from .models import Venue # Only import Venue

class VenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = '__all__' # Include all fields from the updated Venue model

# --- Remove the old PlanSerializer ---
# class PlanSerializer(serializers.ModelSerializer):
#     ... (delete this entire serializer) ...
