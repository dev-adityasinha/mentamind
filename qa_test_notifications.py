import asyncio
import uuid
import httpx
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.notification_event import NotificationEvent, NotificationCategory
from app.models.user import User
from app.services.encryption import encrypt

API_URL = "http://api:8000"

async def run_qa():
    print("🚀 Starting Notifications QA Flow...")

    async with httpx.AsyncClient(timeout=30.0) as client:
        test_email = f"qa_notify_{uuid.uuid4().hex[:8]}@mentamind.in"
        test_password = "SecurePassword123!"

        print("\n[1] Registering QA User via API...")
        res = await client.post(
            f"{API_URL}/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "display_name": "QA Notify User",
            },
        )
        assert res.status_code == 201, res.text

        # Login to get token
        login_res = await client.post(
            f"{API_URL}/auth/login",
            json={"email": test_email, "password": test_password}
        )
        assert login_res.status_code == 200, login_res.text
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Bypass onboarding
        await client.post(
            f"{API_URL}/onboarding/submit-consent",
            headers=headers,
            json={"data_processing": True, "anonymized_research": True}
        )
        print("    QA User registered and onboarded.")

        # Get User ID and Org ID
        me_res = await client.get(f"{API_URL}/me", headers=headers)
        assert me_res.status_code == 200, me_res.text
        user_data = me_res.json()
        user_id = user_data["id"]
        org_id = user_data["org_id"]

        print("\n[2] Injecting Mock Notification via DB...")
        async with AsyncSessionLocal() as db:
            from datetime import datetime, UTC
            user_db = await db.get(User, uuid.UUID(user_id))
            user_db.onboarding_completed_at = datetime.now(UTC)
            
            body_encrypted = encrypt("We noticed you've been working late. Take a break!", associated_data=user_id.encode())
            event = NotificationEvent(
                user_id=user_id,
                org_id=org_id,
                category=NotificationCategory.BURNOUT_ALERT,
                title="Burnout Warning",
                body_encrypted=body_encrypted,
            )
            db.add(event)
            await db.commit()
            await db.refresh(event)
            print(f"    Injected Notification ID: {event.id}")

        print("\n[3] Fetching Unread Notifications from API...")
        resp = await client.get(f"{API_URL}/me/notifications?unread_only=true", headers=headers)
        assert resp.status_code == 200, f"Failed to fetch notifications: {resp.text}"
        notifications = resp.json()
        print(f"    Retrieved {len(notifications)} unread notification(s).")
        
        target_notification = next((n for n in notifications if n["id"] == str(event.id)), None)
        assert target_notification is not None, "Injected notification not found in API response!"
        assert target_notification["is_read"] == False
        assert target_notification["title"] == "Burnout Warning"
        assert target_notification["body"] == "We noticed you've been working late. Take a break!"
        print("    Decrypted notification payload verified.")

        print("\n[4] Marking Notification as Read...")
        read_resp = await client.post(f"{API_URL}/me/notifications/{event.id}/read", headers=headers)
        assert read_resp.status_code == 200, f"Failed to mark as read: {read_resp.text}"
        read_data = read_resp.json()
        assert read_data["is_read"] == True
        print("    Notification successfully marked as read.")

        print("\n[5] Verifying Unread Notifications is Empty (or reduced)...")
        resp2 = await client.get(f"{API_URL}/me/notifications?unread_only=true", headers=headers)
        notifications2 = resp2.json()
        target_notification_2 = next((n for n in notifications2 if n["id"] == str(event.id)), None)
        assert target_notification_2 is None, "Notification still appears in unread list!"
        print("    Notification no longer appears in unread list.")

    print("\n✅ QA Flow Complete! The Notifications module is working perfectly.")

if __name__ == "__main__":
    asyncio.run(run_qa())
