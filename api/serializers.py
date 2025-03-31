# api/serializers.py
from rest_framework import serializers
from .models import Venue, Plan # Import your models

class VenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = '__all__' # Include all fields from the Venue model

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = '__all__' # Include all fields from the Plan model