import asyncio
import uuid
import httpx

API_URL = "http://api:8000"

async def run_qa():
    print("🚀 Starting QA Test Suite for Module 9: Modular AI Assistant...\n")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Register a QA User
        test_email = f"qa_coach_{uuid.uuid4().hex[:8]}@mentamind.in"
        test_password = "SecurePassword123!"

        print("=== Registering QA User ===")
        res = await client.post(
            f"{API_URL}/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "display_name": "QA Coach User",
            },
        )
        assert res.status_code == 201, res.text
        
        # Login to get token
        login_res = await client.post(
            f"{API_URL}/auth/login",
            json={
                "email": test_email,
                "password": test_password,
            }
        )
        assert login_res.status_code == 200, login_res.text
        token = login_res.json()["access_token"]
        print("✅ User Registered & Logged In\n")

        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create AI Coach Session
        print("=== Creating AI Coach Session ===")
        res = await client.post(
            f"{API_URL}/ai-coach/sessions",
            headers=headers,
            json={"meta": {"topic": "Stress at work"}}
        )
        assert res.status_code == 201, res.text
        session_data = res.json()
        session_id = session_data["id"]
        print(f"✅ Session created successfully. ID: {session_id}\n")

        # 3. Send Message to AI Coach
        print("=== Sending Message to AI Coach ===")
        res = await client.post(
            f"{API_URL}/ai-coach/sessions/{session_id}/messages",
            headers=headers,
            json={"content": "I'm feeling really stressed today."}
        )
        assert res.status_code == 201, res.text
        msg_resp = res.json()
        assert msg_resp["role"] == "assistant"
        assert msg_resp["content"] is not None
        print(f"✅ AI Coach responded: '{msg_resp['content'][:50]}...'\n")

        # 4. Fetch Message History (verify decryption)
        print("=== Fetching Session History (Encryption Check) ===")
        res = await client.get(
            f"{API_URL}/ai-coach/sessions/{session_id}/messages",
            headers=headers
        )
        assert res.status_code == 200, res.text
        history = res.json()
        assert len(history) == 2
        assert history[0]["role"] == "user"
        assert history[0]["content"] == "I'm feeling really stressed today."
        assert history[1]["role"] == "assistant"
        print("✅ Message history retrieved and decrypted successfully.\n")

        # 5. End Session
        print("=== Ending AI Coach Session ===")
        res = await client.post(
            f"{API_URL}/ai-coach/sessions/{session_id}/end",
            headers=headers
        )
        assert res.status_code == 200, res.text
        end_resp = res.json()
        assert end_resp["ended_at"] is not None
        print("✅ Session ended successfully.\n")

        # 6. Fetch All Sessions
        print("=== Fetching All Sessions ===")
        res = await client.get(
            f"{API_URL}/ai-coach/sessions",
            headers=headers
        )
        assert res.status_code == 200, res.text
        sessions = res.json()
        assert len(sessions) == 1
        assert sessions[0]["id"] == session_id
        print("✅ All sessions fetched successfully.\n")

        print("🎉 ALL QA TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    asyncio.run(run_qa())
