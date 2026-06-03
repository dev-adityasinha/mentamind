# MentaMind Platform Architecture & Workflows

This repository contains the MentaMind blood donation and medicine request platform. It features safety-critical validation (such as ABO/Rh blood compatibility rules and geographic proximity checking) and automated features like OCR extraction for medical prescriptions.

---

## 1. System Overview & Technology Stack

MentaMind is designed as a modular web application that coordinates blood donations and medicine requests. It features safety-critical validation and automated features like OCR extraction for medical prescriptions.

```mermaid
graph TD
    A["Frontend (Next.js / TypeScript)"] <-->|REST API / JWT Auth| B["Backend (Express / Node.js)"]
    B <-->|Prisma ORM| C[("Database (PostgreSQL)")]
    B <-->|S3 API| D[("File Storage (MinIO)")]
    B <-->|Local Implementations| E["Service Container"]
    subgraph E [Service Container]
        E1["Identity Verifier (Aadhaar OTP)"]
        E2["OCR Service (Prescription Parser)"]
        E3["Donor Ranker (Haversine & Blood Matching)"]
        E4["Notifier (In-App / Email / SMS)"]
    end
```

### Core Technologies
1. **Frontend**: Next.js (App Router, React 18, TypeScript) with vanilla CSS for responsive, glassmorphic dashboards.
2. **Backend**: Express.js REST API with TypeScript, structured with a middleware-first design.
3. **Database & ORM**: PostgreSQL managed via Prisma ORM.
4. **Shared Package**: A custom `@mentamind/shared` TypeScript module containing safety rules (e.g., blood compatibility matrix), status enums, validation utilities, and TypeScript types shared between the client and server.
5. **Storage**: MinIO S3-compatible object storage for prescriptions, income certificates, and blood requisition forms.

---

## 2. Shared Domain Logic & Data Models

### 2.1 The Blood Compatibility Matrix
Located in `packages/shared/src/utils/blood-compatibility.ts`, the platform enforces strict medical rules for red blood cell compatibility:

- **O-** is the universal donor.
- **AB+** is the universal recipient.

The matrix maps each recipient blood group to eligible donor blood groups. The backend exposes two primary utility functions:
- `getCompatibleDonorGroups(recipientGroup)`: returns donors who can give to the recipient.
- `getCompatibleRecipientGroups(donorGroup)`: returns recipients who can receive from the donor.

### 2.2 Database Schema Overview
The database uses standard relations to isolate user roles while maintaining a unified `User` model:
- **`User`**: Base model containing login credentials, role enum (`PATIENT`, `DONOR`, `HOSPITAL`, `VOLUNTEER`, `ADMIN`), and identity verification status.
- **`Patient`**: Extends `User` with age, gender, city, address, and medical history. Has relations to `BloodRequest` and `MedicineRequest`.
- **`Donor`**: Extends `User` with blood group, last donation date, availability flag (`isAvailable`), response score, and geolocation (latitude/longitude) for distance calculations.
- **`Hospital`**: Extends `User` with hospital name, city, department, verified status, and coordinates.
- **`BloodRequest`**: Tracks requisition forms, target blood group, units, hospital address, status (`DRAFT` to `FULFILLED`), matching logs, and assignment of a specific donor.
- **`MedicineRequest`**: Tracks prescriptions, supporting financial documents, OCR suggestions, and verification status.

---

## 3. User Roles & Permission Matrix

The platform implements Role-Based Access Control (RBAC) via the `requireRole` middleware.

| Role | Allowed Dashboards / Sidebar Links | Primary Capabilities |
| :--- | :--- | :--- |
| **PATIENT** | Blood Requests, Medicines, Notifications, Profile | Create blood requests, upload prescriptions, trigger OTP verification, view status. |
| **DONOR** | Blood Pool, My Assignments, Notifications, Donor Profile | Browse compatible blood requests, accept/decline assigned requests, edit availability. |
| **HOSPITAL** | Blood Requests, Notifications, Profile | View patient requests, search and rank eligible local donors, assign a donor. |
| **VOLUNTEER**| Blood Requests, Medicines, Notifications, Assignments, Profile | Verify blood requests, trigger OCR, review medicine lists, log phone interactions. |
| **ADMIN** | Blood Requests, Medicines, Users, Audit Log, Notifications, Profile | System configuration, override requests, view security audit logs, manage users. |

---

## 4. Core Workflows

### 4.1 Registration & Authentication Flow
During registration, users are validated via Zod. The backend requires a `city` for all accounts to support proximity matches.

```mermaid
sequenceDiagram
    autonumber
    actor User as Registrant
    participant FE as Next.js Frontend
    participant BE as Express API
    participant DB as PostgreSQL
    
    User->>FE: Fill email, password, role & city
    FE->>FE: Verify mandatory fields (e.g. city)
    FE->>BE: POST /api/auth/register (payload)
    BE->>BE: Run registerSchema validation (Zod)
    alt Validation Failed (missing city or fields)
        BE-->>FE: 400 Bad Request
        FE-->>User: Show validation error
    else Validation Succeeded
        BE->>BE: Hash password (bcrypt)
        BE->>DB: Create User + Role Profile (Patient/Donor/Hospital)
        DB-->>BE: User Record Created
        BE-->>FE: 201 Created (Access & Refresh Tokens)
        FE-->>User: Redirect to Identity Verification
    end
```

---

### 4.2 Aadhaar Identity Verification Flow
Before any user can request blood or medicines, they must verify their identity using their 12-digit Aadhaar number.

```mermaid
sequenceDiagram
    autonumber
    actor P as User (Patient/Donor)
    participant FE as Frontend
    participant BE as Express API
    participant IV as Identity Verifier (Service)
    participant DB as PostgreSQL

    P->>FE: Input Aadhaar Number
    FE->>BE: POST /api/identity/send-otp
    BE->>BE: Mask Aadhaar number (e.g., XXXX-XXXX-1234)
    BE->>IV: Request OTP send to User's phone
    IV-->>BE: Return RequestID
    BE-->>FE: 200 OK (RequestID)
    FE-->>P: Show OTP input field
    P->>FE: Enter 6-digit OTP
    FE->>BE: POST /api/identity/verify-otp (Aadhaar, RequestID, OTP)
    BE->>IV: Verify OTP
    alt Invalid OTP
        IV-->>BE: Verification failed
        BE-->>FE: 200 OK (verified: false)
        FE-->>P: Show "Invalid OTP" warning
    else OTP Succeeded
        IV-->>BE: Verification succeeded (Masked Ref)
        BE->>DB: Update User: identityVerified = true, maskedAadhaarRef = Ref
        BE-->>FE: 200 OK (verified: true, updated User data)
        FE-->>P: Display "Identity Verified" badge
    end
```

---

### 4.3 Blood Request & Donor Matching Flow
When a verified Patient creates a request, it goes through review, validation, ranking, and notification.

```mermaid
graph TD
    classDef action fill:#3b82f6,stroke:#1d4ed8,color:#fff;
    classDef db fill:#10b981,stroke:#047857,color:#fff;
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff;

    Start(["Patient creates request (status: DRAFT)"]) --> Review{"Admin/Volunteer Review"}
    Review -->|Valid Requisition File| Approve["Change status to VERIFIED"]:::action
    Review -->|Incomplete / Invalid| Reject["Change status to REJECTED"]:::action
    
    Approve --> TriggerMatch["Trigger Matching (status: MATCHING)"]:::action
    
    TriggerMatch --> QueryDonors["Query Donors where: isAvailable = true AND bloodGroup is compatible"]:::action
    QueryDonors --> RankDonors["Invoke DonorRanker.rankDonors()"]:::action
    
    subgraph Ranking Algorithm
        RankDonors --> ScoreBlood["Score Blood Type: Exact Match = 40, Compatible = 20"]
        ScoreBlood --> ScoreDays["Score Recency: >56 days (scaled score up to 20)"]
        ScoreDays --> ScoreDist["Score Distance: Haversine distance (up to 15)"]
        ScoreDist --> ScoreExp["Score Experience: Total donations (up to 5)"]
        ScoreExp --> UrgencyMult["Apply Urgency Multiplier: Critical = 1.5x, Urgent = 1.25x"]
    end
    
    UrgencyMult --> SaveMatches["Save Ranked List to 'matchedDonors' column (status: MATCHED)"]:::db
    SaveMatches --> NotifyTop5["Notify top 5 matched donors with score > 0 (In-App notifications)"]:::action
```

---

### 4.4 Hospital Assignment & Donor Response Flow
Instead of waiting for random donor response, a Hospital can manually assign an eligible local donor.

```mermaid
sequenceDiagram
    autonumber
    actor H as Hospital Admin
    participant FE as Frontend
    participant BE as Express API
    participant DB as PostgreSQL
    actor D as Assigned Donor

    H->>FE: View Blood Request Details
    FE->>BE: GET /api/blood-requests/:id/eligible-donors
    BE->>DB: Query compatible, available donors
    DB-->>BE: Donor records
    BE->>BE: Calculate compatibility & check 56-day rule
    BE->>BE: Check city mismatch / Proximity (Haversine < 25km)
    BE-->>FE: Return sorted list of eligible local donors
    FE-->>H: Render list (highlighting eligible donors)
    
    H->>FE: Click "Assign Donor" (DonorId)
    FE->>BE: POST /api/blood-requests/:id/assign-donor (DonorId)
    BE->>BE: Safety Check: Compatibility, Proximity, and 56-day rule
    BE->>DB: Update BloodRequest: assignedDonorId = DonorId, status = IN_PROGRESS
    BE->>DB: Create Notification records for Donor & Patient
    BE-->>FE: 200 OK (Assignment Complete)
    FE-->>H: Show assignment status
    
    Note over D: Donor logs into dashboard
    D->>FE: View "My Assignments" page
    alt Donor Accepts
        D->>FE: Click "Accept"
        FE->>BE: POST /api/blood-requests/:id/donor-response (ACCEPTED)
        BE->>DB: Update BloodRequest: donorResponseStatus = ACCEPTED, status = IN_PROGRESS
        BE->>DB: Notify Patient
        BE-->>FE: Confirmation Success
    else Donor Declines
        D->>FE: Click "Decline" (provide reason)
        FE->>BE: POST /api/blood-requests/:id/donor-response (DECLINED, reason)
        BE->>DB: Reset BloodRequest: assignedDonorId = null, donorResponseStatus = DECLINED
        BE->>DB: Revert status to MATCHED (ready for next assignment)
        BE->>DB: Update Donor: isAvailable = false (prevent immediate re-matching)
        BE->>DB: Notify Patient
        BE-->>FE: Decline Processed
    end
```

---

### 4.5 Medicine Request OCR & Review Flow
Patients can upload a prescription and supporting financial/medical proofs to request free or subsidized medicines.

```mermaid
sequenceDiagram
    autonumber
    actor P as Patient
    participant FE as Frontend
    participant BE as Express API
    participant FS as File Storage (MinIO)
    participant OCR as OCR Service
    participant DB as PostgreSQL
    actor A as Admin / Volunteer

    P->>FE: Fill form, upload prescription image/PDF
    FE->>BE: POST /api/medicine-requests (Base64 files)
    BE->>FS: Upload files to secure paths
    BE->>DB: Create MedicineRequest (status: PENDING_OCR)
    BE-->>FE: 201 Created
    
    Note over A: Admin views Pending OCR list
    A->>FE: Click "Run OCR Scan"
    FE->>BE: POST /api/medicine-requests/:id/ocr
    BE->>FS: Download prescription file buffer
    BE->>OCR: Invoke extractPrescription(buffer)
    OCR-->>BE: Return suggested medicines list + confidence scores
    BE->>DB: Save OCR suggestions, update status = OCR_COMPLETE
    BE-->>FE: 200 OK (OCR suggestions)
    FE-->>A: Render parsed medicine items side-by-side with document
    
    A->>FE: Adjust names, dosages, quantities, and click "Submit Review"
    FE->>BE: PUT /api/medicine-requests/:id/review (payload)
    BE->>DB: Save adminReviewedData, status = PENDING_REVIEW
    BE-->>FE: 200 OK
    
    A->>FE: Update status (APPROVED / DISPATCHED / DELIVERED)
    FE->>BE: PATCH /api/medicine-requests/:id/status (status)
    BE->>DB: Save status, send In-App Notification to Patient
    BE-->>FE: 200 OK
```

---

## 5. Security & Auditing

The system records all data-mutating activities for safety and compliance.

### 5.1 Token-Based Authentication
- **Access Tokens**: Short-lived JWTs signed with `ACCESS_TOKEN_SECRET` and stored in headers or cookies. Checked on every secure endpoint.
- **Refresh Tokens**: Long-lived tokens stored in database, used to issue new access tokens via the `/api/auth/refresh` endpoint.

### 5.2 Audit Logging
All changes to blood requests, medicine requests, identity status, and assignments automatically trigger `createAuditLog()` inside router handlers. This creates entries in the `AuditLog` table:
- **`userId`**: Who performed the action.
- **`action`**: e.g., `DONOR_ASSIGNED_BY_HOSPITAL`, `MEDICINE_OCR_COMPLETED`.
- **`entityType` / `entityId`**: The database model and primary key affected.
- **`oldValue` / `newValue`**: JSON snapshots of the changes.
- **`ipAddress` / `userAgent`**: Request headers capturing metadata.

---

## 6. Verification and Diagnostics

### Development and Local Running
For local development, the platform uses Mock/Local implementations of services:
- **OCR**: Returns a stub list of Paracetamol, Amoxicillin, and Cetirizine.
- **Identity Verification**: Generates fake 6-digit OTPs and logs them to the backend console; accepts any 6-digit number to proceed.
- **Notifications**: Writes notifications directly to the PostgreSQL `Notification` table to render in-app notifications and prints them to console.
