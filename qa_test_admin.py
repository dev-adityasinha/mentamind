import asyncio
import uuid
import httpx

API_URL = "http://localhost:8000"


async def run_qa():
    print("🚀 Starting QA Test Suite for Module 10: Admin Panel & Moderation...\n")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Register a standard user
        print("=== Registering Standard User ===")
        user_email = f"user_{uuid.uuid4().hex[:8]}@mentamind.in"
        res = await client.post(
            f"{API_URL}/auth/register",
            json={
                "email": user_email,
                "password": "Password123!",
                "display_name": "Standard User",
            },
        )
        assert res.status_code == 201

        login_res = await client.post(
            f"{API_URL}/auth/login",
            json={"email": user_email, "password": "Password123!"},
        )
        user_token = login_res.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}

        # 2. Register an Admin user
        # Note: By default register sets role=UserRole.EMPLOYEE (or student).
        # We'll need a trick or just use an existing admin. Let's see if we can promote them,
        # but the test might fail if we can't promote them. Wait, the DB allows promoting via SQL!
        # For this test, let's just execute a raw SQL to make the second user an admin.

        print("=== Registering Admin User ===")
        admin_email = f"admin_{uuid.uuid4().hex[:8]}@mentamind.in"
        res = await client.post(
            f"{API_URL}/auth/register",
            json={
                "email": admin_email,
                "password": "Password123!",
                "display_name": "Admin User",
            },
        )
        print("=== Promoting User to Admin via DB ===")
        import sys
        import hashlib

        sys.path.append("/app")
        from app.database import AsyncSessionLocal
        from sqlalchemy import text

        email_hash = hashlib.sha256(admin_email.lower().encode()).hexdigest()
        async with AsyncSessionLocal() as db:
            await db.execute(
                text(
                    f"UPDATE users SET role = 'admin' WHERE email_hash = '{email_hash}';"
                )
            )
            await db.commit()

        login_res = await client.post(
            f"{API_URL}/auth/login",
            json={"email": admin_email, "password": "Password123!"},
        )
        admin_token = login_res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print("✅ Admin registered and promoted successfully.\n")

        # 3. Standard User creates a post
        print("=== Creating a Post ===")
        res = await client.post(
            f"{API_URL}/forum/posts",
            headers=user_headers,
            json={
                "content": "This is a terrible post that violates rules!",
                "category": "general",
                "is_anonymous": False,
            },
        )
        assert res.status_code in [200, 201], res.text
        post_id = res.json()["id"]
        print(f"✅ Post created. ID: {post_id}\n")

        # 4. Standard User reports the post
        print("=== Reporting the Post ===")
        res = await client.post(
            f"{API_URL}/forum/reports",
            headers=user_headers,
            json={
                "target_type": "post",
                "target_id": post_id,
                "reason": "Abusive content",
            },
        )
        assert res.status_code in [200, 201], res.text
        report_id = res.json()["id"]
        print(f"✅ Post reported successfully. Report ID: {report_id}\n")

        # 5. Admin retrieves stats
        print("=== Fetching Admin Stats ===")
        res = await client.get(f"{API_URL}/admin/stats", headers=admin_headers)
        assert res.status_code == 200, res.text
        stats = res.json()
        assert stats["active_reports"] >= 1
        print("✅ Admin stats retrieved successfully.\n")

        # 6. Admin fetches reports
        print("=== Fetching Pending Reports ===")
        res = await client.get(
            f"{API_URL}/admin/reports",
            headers=admin_headers,
            params={"status_filter": "pending"},
        )
        assert res.status_code == 200
        reports = res.json()
        target_report = next((r for r in reports if r["id"] == report_id), None)
        assert target_report is not None
        assert (
            target_report["target_content"]
            == "This is a terrible post that violates rules!"
        )
        print("✅ Reports retrieved. Enriched content verified.\n")

        # 7. Admin deletes the post
        print("=== Deleting the Post ===")
        res = await client.delete(
            f"{API_URL}/admin/posts/{post_id}", headers=admin_headers
        )
        assert res.status_code == 200
        print("✅ Post deleted successfully.\n")

        # 8. Admin resolves the report
        print("=== Resolving the Report ===")
        res = await client.patch(
            f"{API_URL}/admin/reports/{report_id}",
            headers=admin_headers,
            json={"status": "resolved"},
        )
        assert res.status_code == 200
        print("✅ Report resolved successfully.\n")

        print("🎉 ALL QA TESTS PASSED SUCCESSFULLY! 🎉")


if __name__ == "__main__":
    asyncio.run(run_qa())
