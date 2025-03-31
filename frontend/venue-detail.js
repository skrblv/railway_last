// frontend/venue-detail.js

document.addEventListener('DOMContentLoaded', () => {
    const venueDetailContainer = document.getElementById('venue-detail-content');
    const API_BASE_URL = 'http://127.0.0.1:8000/api'; // Your Django API base URL

    // --- Get Venue ID from URL Parameter ---
    const urlParams = new URLSearchParams(window.location.search);
    const venueId = urlParams.get('id');

    if (!venueId) {
        displayError("No Venue ID provided in the URL.");
        return;
    }

    // --- Fetch Venue Data ---
    fetchVenueDetails(venueId);

    // --- Function to fetch details for a specific venue ---
    async function fetchVenueDetails(id) {
        const apiUrl = `${API_BASE_URL}/venues/${id}/`;
        console.log("Fetching venue details from:", apiUrl);

        try {
            const response = await fetch(apiUrl);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Venue with ID ${id} not found.`);
                } else {
                    throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}`);
                }
            }

            const venueData = await response.json();
            console.log("Received venue data:", venueData);
            displayVenueDetails(venueData);
            console.log(venueData);
            

        } catch (error) {
            console.error("Error fetching venue details:", error);
            displayError(error.message || "Could not load venue details.");
        }
    }

    // --- Function to display the fetched venue details ---
    function displayVenueDetails(venue) {
        // Clear loading message
        venueDetailContainer.innerHTML = '';

        // Create elements and populate them
        const nameHeading = document.createElement('h1');
        nameHeading.id = 'venue-name-detail';
        nameHeading.textContent = venue.name || 'Venue Name Unavailable';
        venueDetailContainer.appendChild(nameHeading);

        if (venue.image_url) {
            const image = document.createElement('img');
            image.id = 'venue-image-detail';
            image.src = venue.image_url;
            image.alt = `Image of ${venue.name}`;
            venueDetailContainer.appendChild(image);
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'venue-info';

        // Add details (customize as needed)
        if (venue.rating_text) {
            infoDiv.innerHTML += `<p><strong>Description:</strong> ${venue.rating_text}</p>`;
        }
        if (venue.rating_stars > 0) {
             let stars = '';
             for(let i=1; i<=5; i++) stars += (i <= venue.rating_stars ? '★' : '☆');
             infoDiv.innerHTML += `<p><strong>Rating:</strong> ${stars} (${venue.rating_stars}/5)</p>`;
        }
        if (venue.date_text) {
            infoDiv.innerHTML += `<p><strong>Dates:</strong> ${venue.date_text}</p>`;
        }
        if (venue.venue_icon1 || venue.venue_icon2) {
            infoDiv.innerHTML += `<p><strong>Tags:</strong> ${venue.venue_icon1 || ''} ${venue.venue_icon2 || ''}</p>`;
        }

        venueDetailContainer.appendChild(infoDiv);

        // --- Add Leaflet Map ---
        if (venue.latitude != null && venue.longitude != null) {
            const mapDiv = document.createElement('div');
            mapDiv.id = 'venue-map-detail';
            venueDetailContainer.appendChild(mapDiv);

            try {
                 const map = L.map('venue-map-detail').setView([venue.latitude, venue.longitude], 15); // Use zoom level 15 or adjust
                 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                     attribution: '© OpenStreetMap contributors'
                 }).addTo(map);

                 L.marker([venue.latitude, venue.longitude])
                     .addTo(map)
                     .bindPopup(`<b>${venue.name}</b>`)
                     .openPopup();

                 // Invalidate size slightly after creation for proper rendering
                 setTimeout(() => map.invalidateSize(), 100);

            } catch(mapError) {
                console.error("Error initializing detail map:", mapError);
                mapDiv.innerHTML = "<p style='color:red;'>Could not load map.</p>";
            }

        } else {
             infoDiv.innerHTML += `<p><em>Map location not available.</em></p>`;
        }
    }
    

    // --- Function to display errors ---
    function displayError(message) {
        venueDetailContainer.innerHTML = `<div class="error-message">Error: ${message}</div>`;
    }

});