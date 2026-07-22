# KlickIt Project Charter

## Mission

Build an independently designed, offline-first, multi-clinic dental patient-management system for Ganpati Dental Clinic, beginning with a Rohini pilot and expanding to Shalimar Bagh after acceptance.

## Product components

1. KlickIt Web
2. KlickIt Windows Desktop
3. KlickIt Clinic Gateway
4. Supabase cloud system of record
5. Pabbly Chatflow/Connect integration

## First-pilot scope

Included:

- patients and duplicate resolution
- medical history, allergies and consent
- scheduler and Clinical Queue
- encounters, clinical notes and tooth-wise records
- treatment plans and estimates
- prescriptions
- billing, payments, advances, allocations and balances
- recalls
- images and PDFs
- Pabbly WhatsApp automation
- printing
- offline clinic LAN operation
- synchronization
- roles, audit, backups and migration foundation

Excluded initially:

- inventory
- laboratory
- advanced analytics
- full CGHS claim submission
- patient portal
- native mobile app
- built-in complete WhatsApp helpdesk
- automatic payment-gateway confirmation
- automatic gateway failover

## Pilot order

1. Simulated gateway on development laptop
2. Rohini
3. Shalimar Bagh
4. External-clinic productization only after the two-clinic core is stable

## User control

- Small phases may continue automatically after passing tests.
- Major milestones stop for manual review.
- Only `APPROVE MILESTONE` authorizes the next milestone.
