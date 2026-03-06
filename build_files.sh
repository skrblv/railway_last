# Создаем виртуальное окружение
python3.12 -m venv venv
# Активируем его
source venv/bin/activate

# Устанавливаем зависимости
pip install --upgrade pip
pip install -r requirements.txt

# Собираем статику
python3.12 manage.py collectstatic --noinput --clear

# Деактивируем окружение
deactivate