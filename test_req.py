import asyncio, httpx
async def main():
    async with httpx.AsyncClient() as c:
        r = await c.get(http://127.0.0.1:8000/settings)
        print(r.status_code)
        print(r.text)
asyncio.run(main())
