import time
import requests

BASE_URL = "http://localhost:8000/api/v1"

def run_crawl_test(url, render_mode, max_depth, max_pages, request_delay=0.25):
    print(f"\n==========================================", flush=True)
    print(f"Initiating Crawl: {url}", flush=True)
    print(f"Mode: {render_mode} | Depth: {max_depth} | Pages: {max_pages} | Delay: {request_delay}s", flush=True)
    print(f"==========================================", flush=True)
    
    payload = {
        "url": url,
        "render_mode": render_mode,
        "max_depth": max_depth,
        "max_pages": max_pages,
        "request_delay": request_delay,
        "respect_robots_txt": True,
        "timeout": 30.0
    }
    
    resp = requests.post(f"{BASE_URL}/crawl", json=payload)
    if resp.status_code != 200:
        print(f"Failed to submit crawl: {resp.status_code} - {resp.text}", flush=True)
        return False
        
    data = resp.json()
    crawl_id = data["crawl_id"]
    print(f"Crawl submitted! ID: #{crawl_id}, Initial Status: {data['status']}", flush=True)
    
    statuses_seen = [data["status"]]
    start_time = time.monotonic()
    
    while True:
        status_resp = requests.get(f"{BASE_URL}/crawl/{crawl_id}/status")
        if status_resp.status_code != 200:
            print(f"Error checking status: {status_resp.status_code}", flush=True)
            time.sleep(1)
            continue
            
        status_data = status_resp.json()
        curr_status = status_data["status"]
        if curr_status != statuses_seen[-1]:
            statuses_seen.append(curr_status)
            print(f"Status transition -> {curr_status} (crawled: {status_data['pages_crawled']}/{status_data['max_pages']}, progress: {status_data['progress_percent']}%)", flush=True)
        else:
            print(f"Polling #{crawl_id}: status={curr_status}, crawled={status_data['pages_crawled']}/{status_data['max_pages']}, progress={status_data['progress_percent']}%", flush=True)
            
        if curr_status in ("COMPLETED", "FAILED"):
            print(f"\n--- Final Result for Crawl #{crawl_id} ---", flush=True)
            print(f"Final Status: {curr_status}", flush=True)
            print(f"Duration: {time.monotonic() - start_time:.2f}s", flush=True)
            print(f"Pages Discovered: {status_data['pages_discovered']}", flush=True)
            print(f"Total Pages Crawled: {status_data['pages_crawled']}", flush=True)
            print(f"Successful Pages: {status_data['successful_pages']}", flush=True)
            print(f"Failed Pages: {status_data['pages_failed']}", flush=True)
            print(f"Sequence: {' -> '.join(statuses_seen)}", flush=True)
            if curr_status == "FAILED":
                print(f"Error: {status_data.get('error')}", flush=True)
            return curr_status == "COMPLETED"
            
        time.sleep(1.0)

if __name__ == "__main__":
    print("Checking backend connectivity...", flush=True)
    r = requests.get(f"{BASE_URL}/history")
    print(f"Backend alive: status {r.status_code}\n", flush=True)

    # Test 1: HTTPX / Auto mode on books.toscrape.com
    res1 = run_crawl_test("https://books.toscrape.com/", "auto", 1, 10, 0.25)
    
    # Test 2: Playwright mode on web-scraping.dev
    res2 = run_crawl_test("https://web-scraping.dev/", "playwright", 1, 5, 0.25)
    
    print("\n==========================================", flush=True)
    print(f"TEST 1 (books.toscrape.com - Auto): {'PASSED' if res1 else 'FAILED'}", flush=True)
    print(f"TEST 2 (web-scraping.dev - Playwright): {'PASSED' if res2 else 'FAILED'}", flush=True)
    print("==========================================", flush=True)
