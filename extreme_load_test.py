import os
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
import logfire

# Configure OTLP endpoint
os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://localhost:4318"
logfire.configure(send_to_logfire=False, service_name="extreme-load-test")

async def generate_spans_ultra_fast(batch_id: int, spans_count: int = 200):
    """Generate spans as fast as possible with minimal overhead"""
    for i in range(spans_count):
        # Minimize span complexity for maximum throughput
        if i % 10 == 0:
            logfire.info(f"B{batch_id}-{i}")
        else:
            # Simple spans with minimal attributes
            logfire.debug(f"B{batch_id}-{i}")

async def extreme_load_test(target_rps: int = 10000, duration_seconds: int = 2):
    """
    Generate extreme load to test system limits
    
    WARNING: This pushes your system hard - monitor resources!
    """
    total_spans = target_rps * duration_seconds
    spans_per_worker = 200  # Batch size per worker
    workers_needed = total_spans // spans_per_worker
    
    print(f"🔥 EXTREME LOAD TEST")
    print(f"   Target: {target_rps:,} spans/second")
    print(f"   Duration: {duration_seconds} seconds")
    print(f"   Total spans: {total_spans:,}")
    print(f"   Workers: {workers_needed}")
    print(f"   ⚠️  This will stress test your system!")
    
    # Ask for confirmation
    response = input("\nProceed? (y/N): ").strip().lower()
    if response != 'y':
        print("Test cancelled.")
        return
    
    print(f"\n🚀 Starting in 3 seconds...")
    await asyncio.sleep(3)
    
    start_time = time.time()
    
    # Use aggressive parallelization
    with ThreadPoolExecutor(max_workers=min(50, workers_needed)) as executor:
        tasks = []
        
        # Create all workers upfront for maximum speed
        for worker_id in range(workers_needed):
            task = asyncio.get_event_loop().run_in_executor(
                executor,
                lambda wid=worker_id: asyncio.run(generate_spans_ultra_fast(wid, spans_per_worker))
            )
            tasks.append(task)
        
        # Wait for all workers to complete
        await asyncio.gather(*tasks)
    
    elapsed = time.time() - start_time
    actual_rps = total_spans / elapsed
    
    print(f"\n✅ EXTREME LOAD TEST COMPLETE!")
    print(f"   Generated: {total_spans:,} spans")
    print(f"   Duration: {elapsed:.2f} seconds")
    print(f"   Actual RPS: {actual_rps:,.0f} spans/second")
    print(f"   Peak memory should trigger collector batch processing")

async def graduated_load_test():
    """Gradually ramp up to find your system's limits safely"""
    test_configs = [
        (1000, 2, "Warm-up"),
        (2500, 2, "Moderate"),
        (5000, 2, "High"),
        (7500, 2, "Very High"),
        (10000, 2, "Maximum")
    ]
    
    print("🎯 GRADUATED LOAD TEST")
    print("This will ramp up load gradually to find your system limits\n")
    
    for rps, duration, level in test_configs:
        print(f"--- {level} Load: {rps:,} RPS ---")
        await extreme_load_test(rps, duration)
        
        # Check if user wants to continue
        print(f"\nCheck system resources now...")
        response = input("Continue to next level? (Y/n): ").strip().lower()
        if response == 'n':
            break
        
        print("Waiting 10 seconds for system to settle...")
        await asyncio.sleep(10)

if __name__ == "__main__":
    print("Extreme Observability Load Tester")
    print("=================================")
    print("Choose test mode:")
    print("1. Direct 10k RPS test (2 seconds)")
    print("2. Graduated load test (find your limits)")
    
    choice = input("\nEnter choice (1 or 2): ").strip()
    
    if choice == "1":
        asyncio.run(extreme_load_test(10000, 2))
    elif choice == "2":
        asyncio.run(graduated_load_test())
    else:
        print("Invalid choice")
    
    print("\n📊 After test, check:")
    print("   • docker stats (resource usage)")
    print("   • PGPASSWORD=postgres psql -h localhost -p 6432 -U postgres -d observability -c 'SELECT COUNT(*) FROM spans;'")
    print("   • docker-compose logs otel-collector --tail 20")