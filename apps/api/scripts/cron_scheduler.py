import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from datetime import datetime, UTC, timedelta

from app.database import async_session_maker
from app.models.user import User
from app.models.mood_log import MoodLog
from app.models.notification_event import NotificationEvent, NotificationCategory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def send_checkin_reminders():
    """
    Simulates sending check-in reminders to users who haven't logged mood today.
    """
    logger.info("Running check-in reminders task...")
    async with async_session_maker() as session:
        # Find users who haven't logged a mood today
        start_of_day = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # We want active users
        active_users_result = await session.execute(
            select(User).where(User.deleted_at.is_(None))
        )
        users = active_users_result.scalars().all()
        
        count = 0
        for user in users:
            # Check if they have a mood log today
            log_result = await session.execute(
                select(MoodLog).where(
                    MoodLog.user_id == user.id, 
                    MoodLog.created_at >= start_of_day
                )
            )
            has_log = log_result.scalar_one_or_none()
            
            if not has_log:
                # Create a notification event
                notif = NotificationEvent(
                    user_id=user.id,
                    org_id=user.org_id,
                    category=NotificationCategory.CHECKIN_REMINDER,
                    title="Time for your Check-in!",
                    body_encrypted="How are you feeling today? Take a moment to log your mood.",
                )
                session.add(notif)
                count += 1
                
        await session.commit()
        logger.info(f"Sent check-in reminders to {count} users.")

async def send_streak_alerts():
    """
    Simulates sending streak alerts to users.
    """
    logger.info("Running streak alerts task...")
    # Simulation logic
    pass

async def main():
    scheduler = AsyncIOScheduler()
    
    # Schedule check-in reminders to run daily at 9:00 AM (for this demo, every minute)
    scheduler.add_job(send_checkin_reminders, 'interval', minutes=60)
    
    # Schedule streak alerts to run daily at 8:00 PM (for this demo, every minute)
    scheduler.add_job(send_streak_alerts, 'interval', minutes=60)
    
    scheduler.start()
    
    logger.info("APScheduler started. Press Ctrl+C to exit.")
    
    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        pass

if __name__ == "__main__":
    asyncio.run(main())
