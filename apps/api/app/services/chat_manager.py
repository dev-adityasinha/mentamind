import asyncio
import json
import logging
import uuid

import redis.asyncio as aioredis
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatSession, ChatSessionStatus
from app.services.redis_client import get_redis

logger = logging.getLogger(__name__)


class ChatManager:
    def __init__(self):
        # Local connections in this worker
        # Mapping: user_id -> WebSocket
        self.active_connections: dict[uuid.UUID, WebSocket] = {}

        self.pubsub: aioredis.client.PubSub | None = None
        self.pubsub_task: asyncio.Task | None = None

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

        # Ensure the Redis pubsub listener is running for this worker
        if self.pubsub_task is None:
            await self.start_redis_listener()

    def disconnect(self, user_id: uuid.UUID):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def start_redis_listener(self):
        redis = get_redis()
        self.pubsub = redis.pubsub()
        await self.pubsub.subscribe("chat:events")

        self.pubsub_task = asyncio.create_task(self._listen_to_redis())

    async def _listen_to_redis(self):
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    target_user_id = uuid.UUID(data.get("target_user_id"))

                    if target_user_id in self.active_connections:
                        ws = self.active_connections[target_user_id]
                        try:
                            await ws.send_json(data["payload"])
                        except Exception as e:
                            logger.error(f"Error sending to WS: {e}")
                            self.disconnect(target_user_id)
        except Exception as e:
            logger.error(f"Redis listener error: {e}")
            self.pubsub_task = None

    async def send_personal_message(self, target_user_id: uuid.UUID, payload: dict):
        """Send a real-time message to a specific user via Redis Pub/Sub."""
        redis = get_redis()
        message = {"target_user_id": str(target_user_id), "payload": payload}
        await redis.publish("chat:events", json.dumps(message))

    async def find_partner(
        self, user_id: uuid.UUID, org_id: uuid.UUID, db: AsyncSession
    ) -> ChatSession | None:
        """
        Matchmaking logic using a Redis queue.

        Users are only ever matched with a partner from the SAME organization:
        the waiting queue is keyed per-org, so a user only pops/pushes within
        their own org's pool and can never be paired across organizations.

        If a partner is found, a ChatSession is created in Postgres and returned.
        Otherwise, adds the user to their org's waiting queue and returns None.
        """
        redis = get_redis()
        # Per-org waiting pool: matching is confined to a single organization.
        waiting_pool_key = f"chat:waiting_pool:{org_id}"

        # Try to pop a waiting user (necessarily from the same org, by key)
        partner_str = await redis.lpop(waiting_pool_key)

        if partner_str:
            partner_id = uuid.UUID(partner_str)
            if partner_id == user_id:
                # User somehow in queue multiple times, put them back
                await redis.rpush(waiting_pool_key, str(user_id))
                return None

            # Match found! Create a ChatSession in DB
            session = ChatSession(
                participant_1_id=partner_id,
                participant_2_id=user_id,
                status=ChatSessionStatus.ACTIVE,
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)
            return session
        else:
            # No one waiting, join queue
            await redis.rpush(waiting_pool_key, str(user_id))
            return None


chat_manager = ChatManager()
