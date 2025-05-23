# GRT Tracker API

A FastAPI application for tracking GRT data.

## Setup and Deployment

### Prerequisites

- GitHub account
- Render account (sign up at https://render.com)

### Deployment Steps

1. Fork this repository to your GitHub account

2. Create a new Web Service on Render:

   - Go to https://dashboard.render.com/new/web-service
   - Connect your GitHub repository
   - Choose the repository
   - Configure the service:
     - Name: grt-tracker (or your preferred name)
     - Environment: Python
     - Build Command: `pip install -r requirements.txt`
     - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Click "Create Web Service"

3. Get your Render API key:

   - Go to your Render dashboard
   - Click on your profile picture
   - Go to Settings > API Keys
   - Create a new API key

4. Add the Render secrets to your GitHub repository:

   - Go to your repository settings
   - Navigate to Secrets and Variables > Actions
   - Add these secrets:
     - `RENDER_API_KEY`: Your Render API key
     - `RENDER_SERVICE_ID`: Your service ID (found in the Render dashboard URL)

5. Push your code to the main branch:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

The GitHub Action will automatically deploy your application to Render whenever you push to the main branch.

## Local Development

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Run the application:
   ```bash
   uvicorn main:app --reload
   ```

The API will be available at `http://localhost:8000`
