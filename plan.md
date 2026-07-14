Mentamind MVP Implementation Plan
This Product Requirements Document (PRD) and Implementation Plan outlines the strategy to build the missing features for the Mentamind Platform, fulfilling the requirements of the technical evaluation. The focus is on clean architecture, robust security, and a production-grade setup.

User Review Required
IMPORTANT

AI Provider Integration: Module 9 requires a modular AI provider architecture (OpenAI/Gemini/Claude). Do you have preference on which library to use for the abstraction layer (e.g., litellm, langchain, or a custom factory pattern using native SDKs)?

Anonymous Chat Infrastructure: Module 5 requires real-time anonymous chat. I propose using FastAPI WebSockets with Redis Pub/Sub for horizontal scalability. Let me know if you prefer a different approach (like Socket.io).

Proposed Changes & Architecture
The following changes are grouped logically by module, moving from foundational features to complex integrations.

Phase 1: Core Foundation & Identity
Module 1: Authentication & Identity
[MODIFY] apps/api/app/routers/auth.py
Add /register endpoint for standard user registration (independent of organization registration).
Add /verify-email, /forgot-password, and /reset-password endpoints.
[MODIFY] apps/api/app/models/user.py
Add MODERATOR and THERAPIST to UserRole enum.
[MODIFY] apps/api/app/services/email.py
Add templates and Resend integration for verification and password reset emails.
Module 2: User Profile
[MODIFY] apps/api/app/models/user_settings.py (or create a new Profile model)
Add fields: age, gender, country, avatar_url, and mental_health_goals.
[MODIFY] apps/api/app/routers/users.py
Add endpoints to GET /me/profile and PATCH /me/profile.
Module 7: Mood Tracking Enhancements
[MODIFY] apps/api/app/models/mood_log.py
Add energy_score (SmallInteger, 1-5) and stress_score (SmallInteger, 1-5).
[MODIFY] apps/api/app/schemas/mood.py & apps/api/app/routers/mood.py
Update schemas and endpoints to accept and return the new fields.
Phase 2: Community & Real-time Features
Module 4: AnonyMenta (Community Platform)
[MODIFY] apps/api/app/models/post.py
Add relationships for PostTag, PostMood, and Comment.
Add category (Enum: Anxiety, Depression, etc.) and is_anonymous flags.
[NEW] apps/api/app/models/comment.py
Schema for hierarchical/flat anonymous comments.
[NEW] apps/api/app/models/report.py
Schema for content moderation reports.
[MODIFY] apps/api/app/routers/forum.py
Implement cursor-based pagination for infinite scrolling.
Add endpoints for /posts/{id}/like, /posts/{id}/comments, and /posts/{id}/report.
Module 5: Anonymous Chat
[NEW] apps/api/app/models/chat.py
Models for ChatRoom and ChatMessage (encrypted).
[NEW] apps/api/app/routers/chat.py
WebSocket endpoint /ws/chat/{session_id}.
Endpoints for random pairing (using Redis queues for matchmaking).
Implement typing indicators and read receipts via WS events.
Phase 3: Wellness & Assessments
Module 6: Mindful Architecture
[NEW] apps/api/app/models/meditation_library.py
Model MeditationTrack: title, audio_url, description, category, difficulty, duration_seconds.
[MODIFY] apps/api/app/models/meditation_session.py
Link session history to MeditationTrack.
[NEW] apps/api/app/routers/meditation.py
Endpoints to fetch library and record progress.
Module 8: MentaQuestions (Assessments)
[NEW] apps/api/app/models/assessment.py
Store standardized questions and scoring rules for PHQ-9, GAD-7, etc.
[MODIFY] apps/api/app/routers/screening.py
Add server-side scoring logic.
Generate contextual insights and recommend next steps (linking to meditation or AI coach).
Phase 4: AI & Administration
Module 9: Modular AI Assistant
[NEW] apps/api/app/services/ai_providers/
Implement a Factory pattern with adapters for GroqAdapter, OpenAIAdapter, AnthropicAdapter, and GeminiAdapter.
[MODIFY] apps/api/app/services/ai_coach.py
Inject context (recent mood, assessment scores) into the system prompt dynamically.
Add tool-calling capabilities for the AI to recommend specific meditation IDs.
Module 10: Admin Panel & Moderation
[MODIFY] apps/api/app/routers/admin.py
Add endpoints to aggregate stats: active users, total assessments, meditation minutes.
Add moderation queue endpoints: GET /admin/reports, POST /admin/reports/{id}/resolve, DELETE /admin/posts/{id}.
Module 11: Notifications (Cron Jobs)
[NEW] apps/api/scripts/cron_scheduler.py
Implement background tasks (via APScheduler or Celery/Redis) to queue check-in reminders and streak alerts based on user timezones.
Phase 5: Frontend Integration (apps/web)
[MODIFY] apps/web/src/app/(auth)/
Build UI for standard registration, forgot password, and reset password.
[MODIFY] apps/web/src/app/(app)/home/page.tsx (Dashboard)
Integrate components to show recent community posts, pending chats, and AI check-ins.
[NEW] apps/web/src/app/(app)/chat/
Build real-time chat interface with WebSocket integration.
[MODIFY] apps/web/src/app/(app)/forum/
Build infinite scroll feed, tagging, and commenting UI.
Security & Production Readiness
Encryption: Utilize the existing AES-256-GCM application-layer encryption for all sensitive user inputs (Chat messages, journal entries).
Rate Limiting: Implement slowapi (Redis-based rate limiting) across all public endpoints, especially Auth and Chat.
Transactions: Ensure robust SQLAlchemy async session management for multi-table inserts.
Verification Plan
Automated Tests
Run pytest apps/api/tests/ to verify no regressions in existing flows.
Add unit tests for the AI Provider Factory and server-side assessment scoring.
Add integration tests for the WebSocket chat matchmaking.
Manual Verification
Spin up the local Docker environment (docker compose up).
Test standard registration and login flows.
Test real-time anonymous chat matching using two separate browser profiles.
Run a PHQ-9 assessment and verify the generated report and AI coach context awareness.