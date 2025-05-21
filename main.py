from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
import time

def scrape_grt_stop(stop_number):
    try:
        url = f"https://nextride.grt.ca/stops/{stop_number}"
        
        # Configure Chrome options
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        # chrome_options.binary_location = "/usr/bin/chromium-browser" 

        driver = webdriver.Chrome(options=chrome_options)
        driver.get(url)
        time.sleep(5)
        
        # Check if page is still loading
        if "Loading" in driver.title:
            print("Page did not load properly - still showing loading screen")
            driver.quit()
            return None
            
        # Get the page source and parse with BeautifulSoup
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')
        
        # Find all trip rows
        trip_rows = soup.find_all('div', class_='trip')
        
        # Extract data from each row
        schedule_data = []
        for row in trip_rows:
            route = row.find('div', {'aria-label': 'Route'}).text.strip()
            destination = row.find('div', class_='font-semibold').text.strip()
            destination_detail = row.find_all('div')[1].text.strip()
            departure = row.find('div', class_='minutes').text.strip()
            
            # Determine if it's real-time or scheduled
            is_real_time = 'estimated' in row.get('class', [])
            
            schedule_data.append({
                'route': route,
                'destination': destination,
                'destination_detail': destination_detail,
                'departure': departure,
                'is_real_time': is_real_time
            })
        
        driver.quit()
        return schedule_data
        
    except Exception as e:
        print(f"Error scraping GRT stop {stop_number}: {e}")
        if 'driver' in locals():
            driver.quit()
        return None

if __name__ == "__main__":
    stop_number = 1073
    result = scrape_grt_stop(stop_number)
    if result:
        print("Successfully scraped the bus schedule:")
        real_time_trips = [trip for trip in result if trip['is_real_time']]
        for trip in real_time_trips:
            print(f"\nRoute: {trip['route']}")
            print(f"Destination: {trip['destination']}")
            print(f"Details: {trip['destination_detail']}")
            print(f"Departure: {trip['departure']}")
            print(f"Real-time: Yes")
