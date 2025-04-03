# backend/settings.py

"""
Django settings for backend project.

Generated by 'django-admin startproject' using Django 5.1.7.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.1/ref/settings/
"""

import os
from pathlib import Path
import dj_database_url # Для конфигурации БД на Railway

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# --- SECURITY SETTINGS ---

# SECURITY WARNING: keep the secret key used in production secret!
# Загружается из переменной окружения DJANGO_SECRET_KEY (установите в Railway)
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    # НЕ ИСПОЛЬЗУЙТЕ этот ключ в production! Только для локальной разработки.
    'django-insecure-fallback-key-for-local-dev-only-@#($*@#)sf'
)

# SECURITY WARNING: don't run with debug turned on in production!
# Установите DJANGO_DEBUG=False в переменных окружения Railway для production.
# По умолчанию True, если переменная не установлена или не равна 'False'.
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') != 'False'


# --- HOSTS & CORS ---

# Домены, с которых разрешено обслуживать сайт
ALLOWED_HOSTS = [
    # Домен вашего приложения на Railway (замените, если отличается)
    "railwaylast-production.up.railway.app",
    # Домены для локальной разработки
    "localhost",
    "127.0.0.1",
    # Railway может предоставлять временные домены или использовать внутренние прокси,
    # иногда требуется '*' в DEBUG режиме, но будьте осторожны с этим в production.
    # Если DEBUG=False, '*' использовать НЕЛЬЗЯ.
]
# Если DEBUG=True, можно временно добавить '*' для простоты локальной настройки,
# но УБЕРИТЕ это для production:
# if DEBUG:
#     ALLOWED_HOSTS.append('*')


# Настройки CORS (Cross-Origin Resource Sharing)
# Определяет, какие внешние домены (например, ваш фронтенд на Vercel или Netlify)
# могут делать запросы к вашему API.

# Вариант 1: Разрешить все источники (НЕ рекомендуется для production)
# CORS_ALLOW_ALL_ORIGINS = True

# Вариант 2: Указать конкретные разрешенные источники (Рекомендуется)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "https://railwaylast-production.up.railway.app", # Ваш основной домен
    "http://localhost:8000",   # Django dev server
    "http://127.0.0.1:8000",  # Django dev server
    "http://localhost:5500",   # VS Code Live Server (порт может отличаться)
    "http://127.0.0.1:5500",  # VS Code Live Server (порт может отличаться)
    "null", # Иногда нужно для локальных file:// запросов
]

# Если фронтенд будет отправлять cookies или заголовки авторизации:
# CORS_ALLOW_CREDENTIALS = True

# Доверенные источники для CSRF защиты (важно, если frontend на другом домене)
CSRF_TRUSTED_ORIGINS = [
    "https://railwaylast-production.up.railway.app",
    # Добавьте другие доверенные домены, если необходимо
]


# --- Application definition ---

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    # --- Whitenoise (должен быть ВЫШЕ staticfiles) ---
    'whitenoise.runserver_nostatic',
    'django.contrib.staticfiles',
    # --- Third-party apps ---
    'rest_framework',
    'corsheaders',
    # --- Your apps ---
    'api', # Ваше приложение API
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # --- Whitenoise Middleware (сразу после SecurityMiddleware) ---
    'whitenoise.middleware.WhiteNoiseMiddleware',
    # --- CORS Middleware ---
    'corsheaders.middleware.CorsMiddleware',
    # --- Standard Django Middleware ---
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls' # Указывает на backend/urls.py

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        # --- Указываем Django, где искать HTML-шаблоны (даже если их отдает WhiteNoise) ---
        # Это нужно, чтобы тег {% static %} корректно работал внутри HTML.
        'DIRS': [BASE_DIR / 'frontend'],
        'APP_DIRS': True, # Искать шаблоны внутри папок 'templates' приложений
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                # --- Добавляем обработчик для тега {% static %} ---
                'django.template.context_processors.static',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application' # Точка входа для WSGI серверов (Gunicorn)


# --- Database ---
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

# Конфигурация по умолчанию (SQLite)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Конфигурация для Railway PostgreSQL (если переменная DATABASE_URL задана)
# Railway автоматически предоставляет эту переменную окружения при подключении БД.
if 'DATABASE_URL' in os.environ:
    DATABASES['default'] = dj_database_url.config(
        conn_max_age=600, # Время жизни соединения (опционально)
        ssl_require=False # Railway обычно обрабатывает SSL сам, но может потребоваться True
                          # Проверьте документацию Railway или настройки вашей БД
    )


# --- Password validation ---
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},
]


# --- Internationalization ---
# https://docs.djangoproject.com/en/5.1/topics/i18n/
LANGUAGE_CODE = 'en-us' # Или 'ru-ru', если нужно
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True # Рекомендуется оставить True


# --- Static files (CSS, JavaScript, Images) ---
# https://docs.djangoproject.com/en/5.1/howto/static-files/
# https://whitenoise.readthedocs.io/

STATIC_URL = '/static/' # URL-префикс для статических файлов

# Папки, ОТКУДА `collectstatic` будет брать ваши статические файлы (JS, CSS, HTML, assets)
STATICFILES_DIRS = [
    BASE_DIR / 'frontend', # Указываем на вашу папку с фронтендом
]

# Папка, КУДА `collectstatic` соберет ВСЕ статические файлы для production.
# Whitenoise будет отдавать файлы из этой папки.
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Хранилище для WhiteNoise (включает сжатие и вечное кэширование через манифест)
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
# Для Django < 4.2 используйте эту настройку вместо STORAGES:
# STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'


# --- Default primary key field type ---
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
