from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from bs4 import BeautifulSoup
import undetected_chromedriver.v2 as uc
import time

app = FastAPI(
    title="GRT Bus Schedule API",
    description="API for scraping GRT bus schedules",
    version="1.0.0"
)

# Enable CORS for all origins
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

def scrape_grt_stop(stop_number: int):
    driver = None
    try:
        print("⚙️ Configuring undetected Chrome options")
        options = uc.ChromeOptions()
        options.binary_location = "/opt/chrome/chrome"
        options.headless = True
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-software-rasterizer")
        options.add_argument("--disable-blink-features=AutomationControlled")

        print("🚀 Launching undetected Chrome driver")
        driver = uc.Chrome(
            driver_executable_path="/usr/bin/chromedriver",
            options=options
        )

        print(f"🌐 Fetching stop page: https://nextride.grt.ca/stops/{stop_number}")
        driver.get(f"https://nextride.grt.ca/stops/{stop_number}")
        time.sleep(2)
        print("✅ Page loaded")

        if "Loading" in driver.title:
            raise HTTPException(status_code=503, detail="Page did not load properly - still showing loading screen")

        soup = BeautifulSoup(driver.page_source, 'html.parser')
        trip_rows = soup.find_all('div', class_='trip')

        trips = []
        for row in trip_rows:
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
            except Exception as e:
                print(f"⚠️ Error parsing row: {e}")

        return trips

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if driver:
            print("🧹 Quitting Chrome driver")
            driver.quit()

@app.get("/api/schedule/{stop_number}", response_model=BusScheduleResponse)
async def get_schedule(stop_number: int):
    print(f"📥 Scraping stop {stop_number}")
    trips = scrape_grt_stop(stop_number)
    print(f"🚌 Trips found: {trips}")
    real_time_trips = [trip for trip in trips if trip['is_real_time']]
    return BusScheduleResponse(stop_number=stop_number, trips=real_time_trips)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)