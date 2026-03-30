# 💕 Railway Last - Date Planning App 
**Live Demo:** https://railway-last.vercel.app


> **A romantic date planning application with interactive maps, music streaming, and venue suggestions. Built with Django REST Framework + Vanilla JavaScript.**

I was in love and wanted everything to be just right.  
I had never worked with Django before, so this became my first full-stack project.

I built **Railway Last** — venues, countdowns, music, maps, reminders — all in one.

And in the end… it didn’t go as planned.  
She blocked me everywhere.

But the project stayed.

And maybe that’s what matters —  
something real came out of it.  
Not the relationship.  
But the work. The growth. The proof that I can build something from nothing.


---

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [📊 Tech Stack](#-tech-stack)
- [🚀 Getting Started](#-getting-started)
- [⚙️ Installation & Setup](#️-installation--setup)
- [📁 Project Structure](#-project-structure)
- [🔌 API Documentation](#-api-documentation)
- [🗄️ Database Models](#️-database-models)
- [🎨 Frontend Features](#-frontend-features)
- [🔧 Configuration](#-configuration)
- [📡 Deployment](#-deployment)
- [🐛 Troubleshooting](#-troubleshooting)
- [📚 Additional Resources](#-additional-resources)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 🎯 Overview

**Railway Last** is a full-stack web application designed to help couples plan their perfect romantic dates. The application combines a powerful backend API with an engaging, interactive frontend interface.

### What This App Does:

1. **Venue Discovery** 🏨 - Browse and select from curated date venues
2. **Countdown Timer** ⏱️ - Get excited with a live countdown to your date
3. **Interactive Maps** 🗺️ - Explore venue locations using Leaflet.js
4. **Mood-Based Music** 🎵 - Play different tracks based on the date atmosphere
5. **Reminders & Checklists** ✅ - Keep track of date preparation tasks
6. **Date Details** 📝 - Store comprehensive information about each venue

---

## ✨ Features

### 🎵 **Music Player**
- Embedded audio player styled as a mobile device
- Track: *"Cupid (Twin Version)"* by FIFTY FIFTY
- Controls: Play/Pause, Previous/Next, Volume Control
- Progress bar with duration display
- Album art display

### ⏰ **Countdown Timer**
- Real-time countdown to your scheduled date
- Displays: Days, Hours, Minutes, Seconds
- Date picker for selecting the date
- Calendar view showing nearby dates
- Local storage persistence

### 🗺️ **Interactive Map**
- Powered by Leaflet.js
- Display venue locations on an interactive map
- Clickable markers for venue details
- Responsive design for mobile & desktop

### 🏨 **Venue Management**
- Browse all available venues
- View venue details (name, date, rating)
- See ratings and reviews information
- Display venue icons/emojis
- Navigate to detailed venue pages

### 📝 **Venue Details Page**
- Comprehensive venue information
- Multiple images for each venue
- Long-form descriptions
- Mood-specific plans (Positive/Sad)
- Music recommendations per mood
- Location coordinates

### ✅ **Reminder System**
- Checklist for date preparation:
  - Buy flowers
  - Choose outfit
  - Confirm time
- Interactive checkboxes with local storage
- Custom notes section

### 🎨 **Beautiful UI/UX**
- Modern, responsive design
- Poppins font family
- Smooth animations and transitions
- Mobile-first approach
- Dark/Light theme support ready
- Decorative elements (flowers, plates)

---

## 📊 Tech Stack

### **Backend**

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.13.2 | Server-side language |
| Django | 5.1.7 | Web framework |
| Django REST Framework | 3.16.0 | REST API |
| Gunicorn | 23.0.0 | WSGI HTTP Server |
| WhiteNoise | 6.9.0 | Static file serving in production |
| psycopg2 | 2.9.10 | PostgreSQL adapter |
| dj-database-url | Latest | Database URL parsing |
| django-cors-headers | 4.7.0 | CORS support |

### **Frontend**

| Technology | Purpose |
|-----------|---------|
| HTML5 | Semantic markup |
| CSS3 | Styling & layout |
| Vanilla JavaScript | Client-side logic |
| Leaflet.js 1.9.4 | Interactive maps |
| Poppins Font (Google Fonts) | Typography |
| Brotli | Compression |

### **Deployment**

| Service | Purpose |
|---------|---------|
| Vercel | Frontend & Backend hosting |
| Railway | Optional PostgreSQL database |

---

## 🚀 Getting Started

### **Prerequisites**

Before you begin, ensure you have the following installed:

- **Python 3.13.2** or later
- **pip** (Python package manager)
- **git** (for version control)
- **Virtual environment** tool (venv, conda, or similar)
- **Node.js** (optional, for frontend build tools if needed)

### **Quick Start (5 minutes)**

bash
# 1. Clone the repository
git clone https://github.com/skrblv/railway_last.git
cd railway_last

# 2. Create and activate virtual environment
python3.13 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run migrations
python manage.py migrate

# 5. Create superuser (for admin panel)
python manage.py createsuperuser

# 6. Start development server
python manage.py runserver
⚙️ Installation & Setup
Detailed Installation Guide
Step 1: Clone the Repository
bash
git clone https://github.com/skrblv/railway_last.git
cd railway_last
Step 2: Set Up Python Virtual Environment
bash
# Create virtual environment
python3.13 -m venv venv

# Activate it
# On Linux/Mac:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
You should see (venv) in your terminal prompt.

Step 3: Install Python Dependencies
bash
pip install --upgrade pip
pip install -r requirements.txt
This installs:

Django 5.1.7
Django REST Framework
django-cors-headers
Gunicorn
psycopg2-binary
And all other dependencies
Step 4: Set Environment Variables
Create a .env file in the project root:

bash
# .env
DJANGO_SECRET_KEY=your-super-secret-key-here-change-this-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,.vercel.app

# For PostgreSQL (optional)
DATABASE_URL=postgresql://user:password@localhost:5432/railway_last

# CORS settings
CORS_ALLOWED_ORIGINS=http://localhost:8000,http://localhost:3000
⚠️ Never commit .env to version control! Add to .gitignore.

Step 5: Initialize Database
bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate
Step 6: Create Superuser (Admin)
bash
python manage.py createsuperuser
# Follow prompts to create admin account
Step 7: Collect Static Files
bash
# Collect static files for production
python manage.py collectstatic --noinput
Step 8: Run Development Server
bash
python manage.py runserver
Visit:

Frontend: http://localhost:8000/
Admin Panel: http://localhost:8000/admin/
