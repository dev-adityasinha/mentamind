import asyncio
import uuid
import httpx

API_URL = "http://api:8000"

async def run_qa():
    print("🚀 Starting QA Test Suite for Module 8: MentaQuestions (Assessments)...\n")

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Register a QA User
        test_email = f"qa_test_{uuid.uuid4().hex[:8]}@mentamind.in"
        test_password = "SecurePassword123!"

        print("=== Registering QA User ===")
        res = await client.post(
            f"{API_URL}/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "display_name": "QA Assessments",
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
        print(f"✅ User Registered & Logged In\n")

        headers = {"Authorization": f"Bearer {token}"}

        # 2. Submit a Screening Result (PHQ-9)
        print("=== Submitting PHQ-9 Result ===")
        payload_phq9 = {
            "test_id": "phq-9",
            "score": 15,
            "max_score": 27,
            "severity": "moderate",
            "answers": [1, 2, 1, 3, 2, 1, 1, 2, 2]
        }
        res = await client.post(
            f"{API_URL}/screening/results",
            headers=headers,
            json=payload_phq9
        )
        assert res.status_code == 200, res.text
        phq9_resp = res.json()
        assert phq9_resp["test_id"] == "phq-9"
        assert phq9_resp["score"] == 15
        assert phq9_resp["severity"] == "moderate"
        print(f"✅ PHQ-9 recorded successfully. ID: {phq9_resp['id']}\n")

        # 3. Submit a Screening Result (GAD-7)
        print("=== Submitting GAD-7 Result ===")
        payload_gad7 = {
            "test_id": "gad-7",
            "score": 8,
            "max_score": 21,
            "severity": "mild",
            "answers": [1, 1, 2, 1, 1, 1, 1]
        }
        res = await client.post(
            f"{API_URL}/screening/results",
            headers=headers,
            json=payload_gad7
        )
        assert res.status_code == 200, res.text
        gad7_resp = res.json()
        assert gad7_resp["test_id"] == "gad-7"
        assert gad7_resp["score"] == 8
        print(f"✅ GAD-7 recorded successfully. ID: {gad7_resp['id']}\n")

        # 4. Fetch Screening History
        print("=== Fetching Overall Screening History ===")
        res = await client.get(
            f"{API_URL}/screening/history",
            headers=headers,
            params={"days": 30}
        )
        assert res.status_code == 200, res.text
        history = res.json()
        assert len(history) == 2
        # Order should be descending by created_at, so GAD-7 then PHQ-9
        assert history[0]["test_id"] == "gad-7"
        assert history[1]["test_id"] == "phq-9"
        
        # Verify metadata (answers) are persisted properly
        assert history[1]["metadata_answers"]["answers"] == [1, 2, 1, 3, 2, 1, 1, 2, 2]
        assert history[1]["metadata_answers"]["max_score"] == 27
        print("✅ Overall history fetched and validated successfully.\n")

        # 5. Fetch History for Specific Test
        print("=== Fetching PHQ-9 History Only ===")
        res = await client.get(
            f"{API_URL}/screening/history/phq-9",
            headers=headers
        )
        assert res.status_code == 200, res.text
        phq9_history = res.json()
        assert len(phq9_history) == 1
        assert phq9_history[0]["test_id"] == "phq-9"
        print("✅ Test-specific history fetched successfully.\n")

        print("🎉 ALL QA TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    asyncio.run(run_qa())
