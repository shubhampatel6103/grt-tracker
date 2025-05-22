from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import time

app = FastAPI(
    title="GRT Bus Schedule API",
    description="API for scraping GRT bus schedules",
    version="1.0.0"
)

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

class BusTrip(BaseModel):
    route: str
    route_name: str
    destination_detail: str
    departure: str
    is_real_time: bool

class BusScheduleResponse(BaseModel):
    stop_number: int
    trips: List[BusTrip]

def scrape_grt_stop(stop_number):
    """
    Scrapes bus schedule data for a given stop number.
    
    Args:
        stop_number (int): The stop number to scrape
        
    Returns:
        list: List of dictionaries containing bus schedule data, or None if failed
    """
    driver = None
    try:
        # Configure Chrome options
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.binary_location = "/usr/bin/chromium-"

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.get(f"https://nextride.grt.ca/stops/{stop_number}")
        time.sleep(2)
        
        # Check if page is still loading
        if "Loading" in driver.title:
            raise HTTPException(status_code=503, detail="Page did not load properly - still showing loading screen")
            
        # Parse page and extract data
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        trip_rows = soup.find_all('div', class_='trip')
        
        return [{
            'route': row.find('div', {'aria-label': 'Route'}).text.strip(),
            'route_name': row.find('div', class_='font-semibold').text.strip(),
            'destination_detail': row.find_all('div')[1].text.strip(),
            'departure': row.find('div', class_='minutes').text.strip(),
            'is_real_time': 'estimated' in row.get('class', [])
        } for row in trip_rows]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if driver:
            driver.quit()

@app.get("/api/schedule/{stop_number}", response_model=BusScheduleResponse)
async def get_schedule(stop_number: int):
    """
    Get bus schedule for a specific stop number.
    
    Args:
        stop_number (int): The stop number to get schedule for
        
    Returns:
        BusScheduleResponse: The bus schedule data
    """
    trips = scrape_grt_stop(stop_number)
    real_time_trips = [trip for trip in trips if trip['is_real_time']]
    return BusScheduleResponse(stop_number=stop_number, trips=real_time_trips)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
