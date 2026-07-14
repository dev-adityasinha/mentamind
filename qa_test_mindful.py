import asyncio
import uuid
import httpx
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

API_URL = "http://api:8000"
DB_URL = "postgresql+asyncpg://mentamind:mentamind@postgres:5432/mentamind"

engine = create_async_engine(DB_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def register_user(email: str, password: str, client: httpx.AsyncClient) -> tuple[str, str]:
    res = await client.post(f"{API_URL}/auth/register-organization", json={
        "org_name": f"Org {uuid.uuid4().hex[:8]}",
        "data_residency_region": "in",
        "email": email,
        "password": password,
        "display_name": "QA Meditator"
    })
    
    if res.status_code != 201:
        res2 = await client.post(f"{API_URL}/auth/register", json={
            "email": email,
            "password": password,
            "display_name": "QA Meditator"
        })
    res = await client.post(f"{API_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    assert res.status_code == 200, f"Failed to login: {res.text}"
    token = res.json()["access_token"]
    
    res = await client.get(f"{API_URL}/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    user_id = res.json()["id"]
    return token, user_id


async def run_qa():
    print("🚀 Starting QA Test Suite for Module 6: Mindful Architecture...")
    
    # 1. Setup DB Data
    print("\n=== Injecting Test Meditation Track ===")
    track_id = uuid.uuid4()
    async with AsyncSessionLocal() as db:
        await db.execute(text("""
            INSERT INTO meditation_tracks (id, title, description, audio_url, duration_minutes, category, difficulty)
            VALUES (:id, 'Test Guided Focus', 'Focus on your breath', 'https://example.com/audio.mp3', 10, 'FOCUS', 'BEGINNER')
            ON CONFLICT (id) DO NOTHING
        """), {"id": str(track_id)})
        await db.commit()
    print(f"✅ Track {track_id} injected.")

    async with httpx.AsyncClient() as client:
        print("\n=== Registering QA User ===")
        email = f"mindful_{uuid.uuid4().hex[:8]}@example.com"
        token, user_id = await register_user(email, "TestPassword123!", client)
        print(f"✅ User Registered: {user_id}")

        print("\n=== Testing Library Fetch ===")
        res = await client.get(f"{API_URL}/meditation/tracks", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200, res.text
        tracks = res.json()
        assert len(tracks) > 0
        
        # Test filtering
        res = await client.get(f"{API_URL}/meditation/tracks?category=focus", headers={"Authorization": f"Bearer {token}"})
        assert len(res.json()) >= 1
        res = await client.get(f"{API_URL}/meditation/tracks?category=sleep", headers={"Authorization": f"Bearer {token}"})
        # Should be empty or not contain our test track since we only injected focus
        print("✅ Tracks fetched and filtered successfully.")

        print("\n=== Testing Streak Logic (Day 1) ===")
        res = await client.get(f"{API_URL}/meditation/stats", headers={"Authorization": f"Bearer {token}"})
        stats = res.json()
        assert stats["current_streak"] == 0
        assert stats["total_minutes"] == 0
        
        res = await client.post(f"{API_URL}/meditation/history", json={
            "track_id": str(track_id),
            "duration_minutes": 10
        }, headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 201, res.text
        
        res = await client.get(f"{API_URL}/meditation/stats", headers={"Authorization": f"Bearer {token}"})
        stats = res.json()
        assert stats["current_streak"] == 1
        assert stats["longest_streak"] == 1
        assert stats["total_minutes"] == 10
        assert stats["total_sessions"] == 1
        print("✅ Day 1 Meditated. Streak = 1, Minutes = 10.")
        
        print("\n=== Testing Streak Logic (Day 2 Continuation) ===")
        # Time travel DB to yesterday
        yesterday = datetime.now(UTC) - timedelta(days=1)
        async with AsyncSessionLocal() as db:
            await db.execute(text("UPDATE meditation_stats SET last_meditated_at = :t WHERE user_id = :uid"), 
                             {"t": yesterday, "uid": user_id})
            await db.commit()
            
        res = await client.post(f"{API_URL}/meditation/history", json={
            "track_id": str(track_id),
            "duration_minutes": 10
        }, headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 201
        
        res = await client.get(f"{API_URL}/meditation/stats", headers={"Authorization": f"Bearer {token}"})
        stats = res.json()
        assert stats["current_streak"] == 2
        assert stats["longest_streak"] == 2
        assert stats["total_minutes"] == 20
        assert stats["total_sessions"] == 2
        print("✅ Day 2 Meditated. Streak = 2, Minutes = 20.")
        
        print("\n=== Testing Streak Logic (Day 4 Missed Day) ===")
        # Time travel DB to 3 days ago relative to "today"
        three_days_ago = datetime.now(UTC) - timedelta(days=3)
        async with AsyncSessionLocal() as db:
            await db.execute(text("UPDATE meditation_stats SET last_meditated_at = :t WHERE user_id = :uid"), 
                             {"t": three_days_ago, "uid": user_id})
            await db.commit()
            
        res = await client.post(f"{API_URL}/meditation/history", json={
            "track_id": str(track_id),
            "duration_minutes": 5
        }, headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 201
        
        res = await client.get(f"{API_URL}/meditation/stats", headers={"Authorization": f"Bearer {token}"})
        stats = res.json()
        assert stats["current_streak"] == 1
        assert stats["longest_streak"] == 2
        assert stats["total_minutes"] == 25
        assert stats["total_sessions"] == 3
        print("✅ Day 4 Meditated after miss. Streak reset to 1. Longest = 2. Minutes = 25.")

        print("\n🎉 ALL QA TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    asyncio.run(run_qa())
