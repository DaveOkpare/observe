import asyncio
import time
import json
import random
from datetime import datetime, timezone
import sys
import os

# Add backend to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import init_db_pool, close_db_pool, insert_spans_batch

def generate_mock_span(span_id: int) -> dict:
    """Generate a realistic span for testing"""
    now = datetime.now(timezone.utc)
    
    return {
        "trace_id": f"{span_id // 100:08x}{'0' * 24}",  # 32 chars total
        "span_id": f"{span_id:08x}{'0' * 8}",           # 16 chars total
        "parent_span_id": f"{span_id-1:08x}{'0' * 8}" if span_id > 0 else None,  # 16 chars
        "name": f"test_operation_{span_id % 10}",
        "start_time_unix_nano": now,
        "end_time_unix_nano": now,
        "kind": random.randint(0, 5),
        "attributes": json.dumps({
            "service.name": "db-load-test",
            "operation.id": span_id,
            "test.batch": span_id // 1000,
            "http.method": random.choice(["GET", "POST", "PUT", "DELETE"]),
            "http.status_code": random.choice([200, 201, 404, 500]),
            "duration_ms": random.randint(1, 1000)
        }),
        "events": json.dumps([
            {
                "time_unix_nano": now.isoformat(),
                "name": f"event_{i}",
                "attributes": {"event_id": i}
            } for i in range(random.randint(0, 3))
        ])
    }

async def direct_copy_from_test(
    batch_size: int = 2048, 
    total_spans: int = 20000,
    max_concurrent_batches: int = 5
):
    """
    Direct database load test - bypasses OpenTelemetry Collector entirely
    Tests pure COPY FROM + PostgreSQL performance using existing database functions
    """
    
    print(f"🗄️  DIRECT DATABASE LOAD TEST")
    print(f"   Batch size: {batch_size:,} spans")
    print(f"   Total spans: {total_spans:,}")
    print(f"   Max concurrent batches: {max_concurrent_batches}")
    print(f"   Target: Pure COPY FROM performance test")
    print(f"   Using: Existing backend/database.py functions")
    
    # Initialize database pool using existing function
    await init_db_pool()
    
    async def insert_batch(batch_start: int, batch_spans: int):
        """Insert a single batch using existing database function"""
        spans_data = [generate_mock_span(batch_start + i) for i in range(batch_spans)]
        
        batch_start_time = time.time()
        # Use existing insert_spans_batch function - same as production code
        await insert_spans_batch(spans_data)
        batch_duration = time.time() - batch_start_time
        
        return batch_spans, batch_duration
    
    # Calculate batches
    num_batches = total_spans // batch_size
    remaining_spans = total_spans % batch_size
    
    print(f"\n🚀 Generating {num_batches} batches of {batch_size} spans each...")
    if remaining_spans:
        print(f"   Plus 1 final batch of {remaining_spans} spans")
    
    start_time = time.time()
    total_inserted = 0
    batch_times = []
    
    # Process batches with controlled concurrency
    semaphore = asyncio.Semaphore(max_concurrent_batches)
    
    async def bounded_insert_batch(batch_id: int, batch_spans: int):
        async with semaphore:
            return await insert_batch(batch_id * batch_size, batch_spans)
    
    # Create all batch tasks
    tasks = []
    for batch_id in range(num_batches):
        task = bounded_insert_batch(batch_id, batch_size)
        tasks.append(task)
    
    # Add remaining spans batch if needed
    if remaining_spans:
        tasks.append(bounded_insert_batch(num_batches, remaining_spans))
    
    # Execute all batches
    results = await asyncio.gather(*tasks)
    
    # Calculate results
    total_duration = time.time() - start_time
    total_inserted = sum(spans for spans, _ in results)
    batch_times = [duration for _, duration in results]
    
    actual_rps = total_inserted / total_duration
    avg_batch_time = sum(batch_times) / len(batch_times)
    max_batch_time = max(batch_times)
    min_batch_time = min(batch_times)
    
    print(f"\n✅ DIRECT DATABASE TEST COMPLETE!")
    print(f"   Inserted: {total_inserted:,} spans")
    print(f"   Total duration: {total_duration:.2f} seconds")
    print(f"   Actual RPS: {actual_rps:,.0f} spans/second")
    print(f"   Average batch time: {avg_batch_time*1000:.1f}ms")
    print(f"   Batch time range: {min_batch_time*1000:.1f}ms - {max_batch_time*1000:.1f}ms")
    print(f"   Concurrent batches: {max_concurrent_batches}")
    
    # Clean up using existing function
    await close_db_pool()
    
    return {
        "total_spans": total_inserted,
        "duration": total_duration, 
        "rps": actual_rps,
        "avg_batch_time": avg_batch_time,
        "batch_size": batch_size,
        "concurrency": max_concurrent_batches
    }

async def run_batch_size_comparison():
    """Test different batch sizes to find optimal COPY FROM performance"""
    batch_sizes = [512, 1024, 2048, 4096, 8192]
    total_spans = 20000
    max_concurrent = 3
    
    print("📊 BATCH SIZE COMPARISON TEST")
    print("="*50)
    
    results = []
    for batch_size in batch_sizes:
        print(f"\n🔬 Testing batch size: {batch_size}")
        result = await direct_copy_from_test(
            batch_size=batch_size,
            total_spans=total_spans, 
            max_concurrent_batches=max_concurrent
        )
        results.append(result)
        
        # Wait between tests
        print("   Waiting 5 seconds before next test...")
        await asyncio.sleep(5)
    
    # Summary
    print(f"\n📋 BATCH SIZE PERFORMANCE SUMMARY")
    print("="*50)
    print(f"{'Batch Size':<12} {'RPS':<10} {'Avg Batch':<12} {'Efficiency':<10}")
    print("-" * 50)
    
    best_rps = max(r['rps'] for r in results)
    for result in results:
        efficiency = f"{result['rps']/best_rps*100:.1f}%"
        print(f"{result['batch_size']:<12} {result['rps']:<10.0f} "
              f"{result['avg_batch_time']*1000:<12.1f}ms {efficiency:<10}")

async def run_concurrency_test():
    """Test different concurrency levels"""
    concurrency_levels = [1, 3, 5, 8, 10]
    batch_size = 2048
    total_spans = 20000
    
    print("⚡ CONCURRENCY LEVEL TEST")
    print("="*50)
    
    for concurrency in concurrency_levels:
        print(f"\n🔬 Testing concurrency: {concurrency}")
        await direct_copy_from_test(
            batch_size=batch_size,
            total_spans=total_spans,
            max_concurrent_batches=concurrency
        )
        
        print("   Waiting 3 seconds before next test...")
        await asyncio.sleep(3)

if __name__ == "__main__":
    print("Direct Database Performance Tester")
    print("==================================")
    print("This bypasses the OpenTelemetry Collector and tests pure database performance")
    print()
    
    print("Choose test mode:")
    print("1. Single load test (20k spans)")
    print("2. Batch size comparison (512, 1024, 2048, 4096, 8192)")  
    print("3. Concurrency level test (1, 3, 5, 8, 10)")
    print("4. Maximum throughput test (50k spans)")
    
    choice = input("\nEnter choice (1-4): ").strip()
    
    if choice == "1":
        asyncio.run(direct_copy_from_test())
    elif choice == "2":
        asyncio.run(run_batch_size_comparison())
    elif choice == "3":
        asyncio.run(run_concurrency_test())
    elif choice == "4":
        print("⚠️  High load test - 50k spans")
        confirm = input("This will generate significant load. Continue? (y/N): ")
        if confirm.lower() == 'y':
            asyncio.run(direct_copy_from_test(batch_size=4096, total_spans=50000, max_concurrent_batches=5))
    else:
        print("Invalid choice")
    
    print("\n🔍 Check results:")
    print("   PGPASSWORD=postgres psql -h localhost -p 6432 -U postgres -d observability -c 'SELECT COUNT(*) FROM spans;'")