from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import httpx
from bs4 import BeautifulSoup
import time
import traceback

app = FastAPI(
    title="GRT Bus Schedule API",
    description="API for scraping GRT bus schedules",
    version="1.0.0"
)

# Configure CORS to allow all origins during testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def health_check():
    return {"status": "healthy"}

class BusTrip(BaseModel):
    route: str
    route_name: str
    destination_detail: str
    departure: str
    is_real_time: bool

class BusScheduleResponse(BaseModel):
    stop_number: int
    trips: List[BusTrip]

async def scrape_grt_stop(stop_number: int):
    print(f"[DEBUG] scrape_grt_stop() called with stop_number={stop_number}")
    
    try:
        url = f"https://nextride.grt.ca/stops/{stop_number}"
        print(f"[DEBUG] Fetching URL: {url}")
        
        async with httpx.AsyncClient() as client:
            # First request to get the initial page
            response = await client.get(url)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch stop data")
            
            # Parse the HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find the API endpoint from the page
            api_endpoint = None
            for script in soup.find_all('script'):
                if 'apiEndpoint' in str(script):
                    # Extract the API endpoint from the script
                    # This is a simplified example - you'll need to adjust based on actual page structure
                    api_endpoint = "https://nextride.grt.ca/api/v1/stops/" + str(stop_number)
                    break
            
            if not api_endpoint:
                raise HTTPException(status_code=503, detail="Could not find API endpoint")
            
            # Make the API request
            api_response = await client.get(api_endpoint)
            if api_response.status_code != 200:
                raise HTTPException(status_code=api_response.status_code, detail="Failed to fetch schedule data")
            
            data = api_response.json()
            
            # Process the API response
            trips = []
            for trip in data.get('trips', []):
                trips.append({
                    'route': trip.get('route', ''),
                    'route_name': trip.get('routeName', ''),
                    'destination_detail': trip.get('destination', ''),
                    'departure': trip.get('departureTime', ''),
                    'is_real_time': trip.get('isRealTime', False)
                })
            
            print(f"[DEBUG] Total parsed trips: {len(trips)}")
            return trips

    except Exception as e:
        print("[ERROR] Exception in scrape_grt_stop:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/schedule/{stop_number}", response_model=BusScheduleResponse)
async def get_schedule(stop_number: int):
    print(f"[DEBUG] API called for stop number: {stop_number}")
    trips = await scrape_grt_stop(stop_number)
    real_time_trips = [trip for trip in trips if trip['is_real_time']]
    print(f"[DEBUG] Returning {len(real_time_trips)} real-time trips")
    if len(real_time_trips) == 0:
        print("[DEBUG] No real-time trips found, returning all trips")
        return BusScheduleResponse(stop_number=stop_number, trips=trips)
    return BusScheduleResponse(stop_number=stop_number, trips=real_time_trips)

if __name__ == "__main__":
    import uvicorn
    print("[DEBUG] Starting Uvicorn server")
    uvicorn.run(app, host="0.0.0.0", port=8000)