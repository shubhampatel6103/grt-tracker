from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import time
import traceback

app = FastAPI(
    title="GRT Bus Schedule API",
    description="API for scraping GRT bus schedules",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    print(f"[DEBUG] scrape_grt_stop() called with stop_number={stop_number}")
    driver = None
    try:
        print("[DEBUG] Setting Chrome options")
        chrome_options = Options()
        chrome_options.binary_location = "/opt/chrome/chrome"
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--disable-extensions")
        chrome_options.add_argument("--disable-software-rasterizer")

        print("[DEBUG] Starting Chrome driver")
        service = Service("/usr/bin/chromedriver")
        driver = webdriver.Chrome(service=service, options=chrome_options)

        url = f"https://nextride.grt.ca/stops/{stop_number}"
        print(f"[DEBUG] Navigating to URL: {url}")
        driver.get(url)
        time.sleep(2)

        print(f"[DEBUG] Page title after load: {driver.title}")
        if "Loading" in driver.title:
            raise HTTPException(status_code=503, detail="Page did not load properly.")

        soup = BeautifulSoup(driver.page_source, 'html.parser')
        trip_rows = soup.find_all('div', class_='trip')
        print(f"[DEBUG] Found {len(trip_rows)} trip rows")

        trips = []
        for idx, row in enumerate(trip_rows):
            try:
                route_div = row.find('div', {'aria-label': 'Route'})
                route = route_div.text.strip() if route_div else None

                name_div = row.find('div', class_='font-semibold')
                route_name = name_div.text.strip() if name_div else None

                destination_detail = row.find_all('div')[1].text.strip() if len(row.find_all('div')) > 1 else None

                departure_div = row.find('div', class_='minutes')
                departure = departure_div.text.strip() if departure_div else None

                is_real_time = 'estimated' in row.get('class', [])

                if route and route_name and departure:
                    trips.append({
                        'route': route,
                        'route_name': route_name,
                        'destination_detail': destination_detail,
                        'departure': departure,
                        'is_real_time': is_real_time
                    })
            except Exception as inner_e:
                print(f"[DEBUG] Error parsing row #{idx}: {inner_e}")
        
        print(f"[DEBUG] Total parsed trips: {len(trips)}")
        return trips

    except Exception as e:
        print("[ERROR] Exception in scrape_grt_stop:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if driver:
            print("[DEBUG] Quitting Chrome driver")
            driver.quit()

@app.get("/api/schedule/{stop_number}", response_model=BusScheduleResponse)
async def get_schedule(stop_number: int):
    print(f"[DEBUG] API called for stop number: {stop_number}")
    trips = scrape_grt_stop(stop_number)
    real_time_trips = [trip for trip in trips if trip['is_real_time']]
    print(f"[DEBUG] Returning {len(real_time_trips)} real-time trips")
    return BusScheduleResponse(stop_number=stop_number, trips=real_time_trips)

if __name__ == "__main__":
    import uvicorn
    print("[DEBUG] Starting Uvicorn server")
    uvicorn.run(app, host="0.0.0.0", port=8000)