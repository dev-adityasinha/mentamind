import asyncio
import json
import os
import uuid
import httpx
import websockets

API_URL = "http://api:8000"
WS_URL = "ws://api:8000"

async def register_user(email: str, password: str, client: httpx.AsyncClient) -> tuple[str, str]:
    res = await client.post(f"{API_URL}/auth/register-organization", json={
        "org_name": f"Org {uuid.uuid4().hex[:8]}",
        "data_residency_region": "in",
        "email": email,
        "password": password,
        "display_name": "Test User"
    })
    
    if res.status_code != 201:
        print(f"Warning: Org registration failed: {res.text}")
        # Try normal user registration
        res2 = await client.post(f"{API_URL}/auth/register", json={
            "email": email,
            "password": password,
            "display_name": "Test User"
        })
        if res2.status_code != 201:
            print(f"Warning: User registration failed: {res2.text}")
    res = await client.post(f"{API_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    assert res.status_code == 200, f"Failed to login: {res.text}"
    token = res.json()["access_token"]
    
    res = await client.get(f"{API_URL}/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, f"Failed to get /me: {res.text}"
    user_id = res.json()["id"]
    return token, user_id

async def run_qa():
    print("🚀 Starting QA Test Suite for Module 4 and 5...")
    
    async with httpx.AsyncClient() as client:
        print("\n=== Registering Users ===")
        user_a_email = f"user_a_{uuid.uuid4().hex[:8]}@example.com"
        user_b_email = f"user_b_{uuid.uuid4().hex[:8]}@example.com"
        
        token_a, id_a = await register_user(user_a_email, "TestPassword123!", client)
        
        # Get org_id from User A
        res_me = await client.get(f"{API_URL}/me", headers={"Authorization": f"Bearer {token_a}"})
        org_id = res_me.json()["org_id"]
        
        # Register User B in same org
        res_b = await client.post(f"{API_URL}/auth/register", json={
            "email": user_b_email,
            "password": "TestPassword123!",
            "display_name": "Test User B",
            "org_id": org_id
        })
        assert res_b.status_code == 201, f"Failed to register B: {res_b.text}"
        
        res_login_b = await client.post(f"{API_URL}/auth/login", json={
            "email": user_b_email,
            "password": "TestPassword123!"
        })
        token_b = res_login_b.json()["access_token"]
        res_me_b = await client.get(f"{API_URL}/me", headers={"Authorization": f"Bearer {token_b}"})
        id_b = res_me_b.json()["id"]
        
        print(f"✅ User A: {id_a}")
        print(f"✅ User B: {id_b}")

        print("\n=== Testing Module 4: AnonyMenta Forum ===")
        # Post
        res = await client.post(f"{API_URL}/forum/posts", json={
            "title": "QA Test Post",
            "content": "Does anonymity work?",
            "category": "General",
            "is_anonymous": True
        }, headers={"Authorization": f"Bearer {token_a}"})
        assert res.status_code == 200, res.text
        post_id = res.json()["id"]
        assert res.json()["author_id"] is None, "Author ID should be scrubbed for anonymity!"
        print("✅ Anonymous Post Created.")

        # Like post
        res = await client.post(f"{API_URL}/forum/posts/{post_id}/like", headers={"Authorization": f"Bearer {token_b}"})
        assert res.status_code == 200, f"Failed to like post: {res.text}"
        print("✅ Post Liked.")

        # Comment on post
        res = await client.post(f"{API_URL}/forum/posts/{post_id}/comments", json={
            "content": "Yes it works!",
            "is_anonymous": False
        }, headers={"Authorization": f"Bearer {token_b}"})
        assert res.status_code == 200, res.text
        comment_id = res.json()["id"]
        print("✅ Comment Created.")
        
        # Report comment
        res = await client.post(f"{API_URL}/forum/reports", json={
            "target_type": "comment",
            "target_id": comment_id,
            "reason": "Test report",
            "details": "Testing the reporting mechanism"
        }, headers={"Authorization": f"Bearer {token_a}"})
        assert res.status_code == 200, f"Failed to report: {res.text}"
        print("✅ Content Reported.")

        print("\n=== Testing Module 5: Anonymous Chat ===")
        print("Connecting User A to WebSocket...")
        ws_a = await websockets.connect(f"{WS_URL}/chat/ws?token={token_a}")
        
        print("Connecting User B to WebSocket...")
        ws_b = await websockets.connect(f"{WS_URL}/chat/ws?token={token_b}")
        
        # User A should get waiting or matched directly
        msg_a = json.loads(await ws_a.recv())
        if msg_a["type"] == "waiting":
            msg_a = json.loads(await ws_a.recv()) # Next should be matched
            
        assert msg_a["type"] == "matched"
        session_id = msg_a["session_id"]
        print(f"✅ User A Matched: Session {session_id}")
        
        msg_b = json.loads(await ws_b.recv())
        assert msg_b["type"] == "matched"
        assert msg_b["session_id"] == session_id
        print("✅ User B Matched!")

        print("Testing message delivery...")
        await ws_a.send(json.dumps({
            "type": "message",
            "session_id": session_id,
            "content": "Hello from A!"
        }))
        
        recv_b = json.loads(await ws_b.recv())
        assert recv_b["type"] == "message"
        assert recv_b["message"]["content"] == "Hello from A!"
        msg_id = recv_b["message"]["id"]
        print("✅ Message A -> B delivered.")
        
        print("Testing typing indicator...")
        await ws_b.send(json.dumps({
            "type": "typing",
            "session_id": session_id
        }))
        
        recv_a = json.loads(await ws_a.recv())
        assert recv_a["type"] == "typing"
        print("✅ Typing indicator B -> A delivered.")
        
        print("Testing read receipt...")
        await ws_b.send(json.dumps({
            "type": "read",
            "session_id": session_id,
            "message_id": msg_id
        }))
        
        recv_a2 = json.loads(await ws_a.recv())
        assert recv_a2["type"] == "read"
        assert recv_a2["message_id"] == msg_id
        print("✅ Read receipt B -> A delivered.")

        print("Testing end session...")
        await ws_a.send(json.dumps({
            "type": "end",
            "session_id": session_id
        }))
        
        recv_b2 = json.loads(await ws_b.recv())
        assert recv_b2["type"] == "end"
        print("✅ End session A -> B delivered.")
        
        await ws_a.close()
        await ws_b.close()
        
        print("\n=== Testing REST API History ===")
        res = await client.get(f"{API_URL}/chat/sessions", headers={"Authorization": f"Bearer {token_a}"})
        assert res.status_code == 200
        sessions = res.json()
        assert len(sessions) > 0
        assert sessions[0]["id"] == session_id
        assert sessions[0]["status"] == "ended"
        print("✅ Chat session recorded in DB.")
        
        res = await client.get(f"{API_URL}/chat/sessions/{session_id}/messages", headers={"Authorization": f"Bearer {token_a}"})
        assert res.status_code == 200
        history = res.json()
        assert len(history) == 1
        assert history[0]["content"] == "Hello from A!"
        assert history[0]["is_read"] == True
        print("✅ Chat history properly saved with read receipt status.")

        print("\n🎉 ALL QA TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    asyncio.run(run_qa())
