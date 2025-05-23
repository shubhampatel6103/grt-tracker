import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stopNumber = searchParams.get('stop');
    
    if (!stopNumber) {
      return NextResponse.json(
        { error: 'Stop number is required' },
        { status: 400 }
      );
    }

    const executablePath = await chromium.executablePath();

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    
    // Navigate to the GRT stop page with dynamic stop number
    await page.goto(`https://nextride.grt.ca/stops/${stopNumber}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for the schedule data to load
    await page.waitForSelector('.table-row-group', { timeout: 10000 });

    // Extract the schedule data
    const scheduleData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.table-row.trip'));
      return rows.map(row => {
        const route = row.querySelector('.number-highlight')?.textContent?.trim();
        const destination = row.querySelector('.text-highlight.tracking-tighter')?.textContent?.trim()
          .replace(/(\w)to/, '$1 to');
        const time = row.querySelector('.minutes')?.textContent?.trim();
        const isLive = row.classList.contains('estimated');

        return {
          route,
          destination,
          time,
          isLive
        };
      }).filter(row => row.route && row.destination);
    });

    await browser.close();

    return NextResponse.json(scheduleData);
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule data' },
      { status: 500 }
    );
  }
} 