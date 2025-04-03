from django.shortcuts import render
from django.http import HttpResponse

def venue_detail_view(request, pk):
    # Ваш код для обработки запроса
    return HttpResponse(f"Venue detail for {pk}")
