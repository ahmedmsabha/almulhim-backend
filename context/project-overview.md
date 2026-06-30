# Project Overview

## About the Project

Mulhim is a learning platform backend for four connected clients:

1. Student Web App
2. Admin Web App
3. Student Mobile App
4. Backend API

This repository owns the Backend API only.

The API is the source of truth for:

- authentication verification
- user and role resolution
- subscription lifecycle
- content access decisions
- receipt verification workflow
- device binding
- signed file access
- backend analytics events

---

## What This Backend Serves

### Student Web

The student web app depends on this API for:

- current user profile
- subscription state
- lessons list
- lesson details
- announcement feed
- PDF access
- support request submission

### Admin Web

The admin web app depends on this API for:

- student management
- subscription review
- lesson and chapter publishing
- announcement publishing
- support request review
- analytics overview
- device reset actions

### Student Mobile

The mobile app depends on this API for:

- token-authenticated sync
- cached content refresh
- subscription sync
- secure video access
- mobile-only download authorization
- offline metadata sync

---

## Core Product Rules

- Clerk is the only authentication provider.
- Roles are `student` and `admin` only.
- Students register as free users first.
- Paid access requires an approved active subscription.
- Content is targeted by region.
- Region values are `gaza`, `west_bank`, and content may also target `both`.
- Mobile video download is allowed on mobile only.
- Device limits are enforced server-side.
- Sensitive files are never public by default.

---

## In Scope

- verify Clerk session tokens
- resolve current user
- manage student records
- manage subscription plans
- accept receipt submissions
- run receipt verification workflow
- approve or reject subscriptions
- expose filtered content by region and access level
- issue signed URLs for private files
- record critical backend events
- enforce abuse protection on risky endpoints
- support requests are stored in the database and also delivered to the teacher by email
- admin replies to support requests can be sent to the student by email

---

## Out of Scope

- frontend rendering
- direct chat between teacher and student
- public permanent URLs for paid video files
- trusting role, region, or subscription state from clients
- moving database logic into controllers
