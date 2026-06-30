# Build Plan

## Core Principle

Build the backend in vertical slices that can be exercised immediately with HTTP requests.
Do not build speculative modules ahead of validated domain needs.

---

## Phase 1 — Foundation

### 01 Project Bootstrap

- create NestJS app
- enable strict TypeScript
- wire global config loading
- define root folder structure
- create health endpoint

### 02 Infrastructure

- wire Prisma
- wire Clerk verification utilities
- wire Cloudflare R2 service
- wire PostHog server client
- wire Arcjet integration shell

### 03 Database Schema

- model users
- model subscription_plans
- model subscriptions
- model units / chapters / lessons
- model lesson_videos / lesson_pdfs
- model announcements
- model support_requests
- model device_bindings
- model video_downloads

---

## Phase 2 — Auth and Users

### 04 Auth Module

- bearer token parsing
- Clerk token verification
- request user context decorator
- role guard

### 05 Users Module

- current user endpoint
- local user upsert from Clerk identity
- admin student listing

---

## Phase 3 — Subscriptions

### 06 Plans

- list active plans
- admin create / update / disable plan

### 07 Receipt Submission

- upload receipt metadata
- store receipt key
- persist sender name
- mark request `pending_review`

### 08 Receipt Verification

- run AI verification
- persist structured verification result
- move passing items to `pending_approval`

### 09 Admin Review

- list pending subscriptions
- approve subscription
- reject subscription
- suspend subscription
- expire access based on dates

---

## Phase 4 — Content

### 10 Content Read APIs

- units / chapters / lessons tree
- lesson details
- region filtering
- subscription-aware access filtering

### 11 Content Admin APIs

- create / update / publish units
- create / update / publish chapters
- create / update / publish lessons
- attach video and PDF records

### 12 Announcements and Support

- announcement list by region
- admin announcement publishing
- support request create
- support request review

---

## Phase 5 — Devices and Downloads

### 13 Device Binding

- bind web device
- bind mobile device
- enforce one web + one mobile
- admin reset action

### 14 Secure Downloads

- mobile-only download authorization
- signed video or file access
- download metadata tracking
- revocation checks

---

## Phase 6 — Hardening

### 15 Analytics

- backend PostHog events
- operational logging strategy

### 16 Arcjet Protection

- add protection to abuse-prone endpoints
- verify rate-limit and bot handling behavior
- document route coverage

### 17 Final Review

- env audit
- permission audit
- storage audit
- module boundary audit
