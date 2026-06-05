# Dùng image Playwright chính thức - đã có đủ system deps cho Chromium
FROM mcr.microsoft.com/playwright/python:v1.43.0-jammy

WORKDIR /app

# Copy requirements và install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright browser đã có sẵn trong base image, chỉ cần install thêm nếu thiếu
RUN python -m playwright install chromium

# Copy toàn bộ source
COPY . .

# Expose port
EXPOSE 8000

# Start server (không cần playwright install nữa vì đã có trong image)
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
