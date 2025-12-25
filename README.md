# ecoproof-backend
# Ecoproof Backend ♻️

Ecoproof is a fraud-resistant recycling verification platform designed for cross-platform mobile applications.

This backend acts as a **trust authority**, validating recycling actions using:
- Object detection metadata (from mobile)
- GPS and location validation
- Anti-cheat logic
- Trust scoring
- Controlled reward calculation

## Tech Stack (100% Free)
- NestJS
- PostgreSQL (Neon)
- Supabase S3 (private bucket)
- JWT Authentication
- REST API

## Core Principles
- Object detection runs on-device (mobile)
- Backend never trusts raw client data
- Anti-cheat logic before rewards
- Deterministic, explainable decisions

## Main Features
- User authentication
- Recycling point management
- Recycle action verification
- Fraud detection
- Trust & reward system
- Admin moderation
- Audit logging

## Setup

```bash
npm install
cp .env.example .env
npm run start:dev
