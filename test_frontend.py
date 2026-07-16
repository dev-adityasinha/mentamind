import urllib.request
import json
import urllib.error

def request(url, body):
    req = urllib.request.Request(
        f'http://localhost:3000/api/{url}',
        data=json.dumps(body).encode('utf-8'),
        method='POST',
        headers={'Content-Type': 'application/json'}
    )
    try:
        resp = urllib.request.urlopen(req)
        print(f"Success {url}: {resp.status}")
        print(resp.read().decode('utf-8'))
        print("Cookies:", resp.getheader('Set-Cookie'))
        return resp.getheader('Set-Cookie')
    except urllib.error.HTTPError as e:
        print(f"Error {url}: {e.code}")
        print(e.read().decode('utf-8'))
        return None
    except Exception as e:
        print(f"Exception {url}: {e}")
        return None

print("--- Register Org ---")
cookie = request('auth/register-org', {
    'org_name': 'test_org_500', 
    'email': 'test500@test.com', 
    'password': 'password123', 
    'display_name': 'Test User', 
    'data_residency_region': 'in'
})

print("--- Login ---")
cookie = request('auth/login', {
    'email': 'test500@test.com', 
    'password': 'password123'
})

print("--- Refresh ---")
if cookie:
    # parse the mm_refresh token
    # e.g. mm_refresh=abc; Path=/; HttpOnly; SameSite=Strict
    val = cookie.split(';')[0]
    req2 = urllib.request.Request(
        'http://localhost:3000/api/auth/refresh',
        method='POST',
        headers={'Cookie': val}
    )
    try:
        resp2 = urllib.request.urlopen(req2)
        print(f"Success refresh: {resp2.status}")
        print(resp2.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"Error refresh: {e.code}")
        print(e.read().decode('utf-8'))
