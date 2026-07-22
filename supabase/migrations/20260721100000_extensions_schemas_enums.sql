-- Generated from Blueprint 01 — extensions, schemas and enums

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE SCHEMA IF NOT EXISTS dentos_data;
CREATE SCHEMA IF NOT EXISTS dentos_runtime;
CREATE SCHEMA IF NOT EXISTS dentos_analytics;

CREATE TYPE dentos_data.care_booking_state AS ENUM ('scheduled','confirmed','arrived','cancelled','no_show','completed');
CREATE TYPE dentos_data.encounter_flow_state AS ENUM ('waiting','checked_in','engaged','checked_out','cancelled');
CREATE TYPE dentos_data.care_delivery_state AS ENUM ('planned','in_progress','completed','cancelled');
CREATE TYPE dentos_data.continuity_task_state AS ENUM ('scheduled','due','contacted','booked','completed','snoozed','cancelled');
CREATE TYPE dentos_data.medication_protocol_state AS ENUM ('draft','active','retired');
CREATE TYPE dentos_data.medication_order_state AS ENUM ('draft','saved','void','signed');
CREATE TYPE dentos_data.fee_statement_state AS ENUM ('draft','issued','part_paid','paid','void');
CREATE TYPE dentos_data.collection_receipt_state AS ENUM ('active','void','part_refunded','refunded');
CREATE TYPE dentos_data.fee_allocation_state AS ENUM ('active','reversed');
CREATE TYPE dentos_data.intent_tier AS ENUM ('one_star_do_not_treat','two_star_budget_friction','three_star_high_intent_friction');
CREATE TYPE dentos_data.case_execution_state AS ENUM ('not_started','minor_issue_treated_same_day','no_treatment_needed','treatment_started');
CREATE TYPE dentos_data.treatment_bundle_tier AS ENUM ('primary','secondary','tertiary');
CREATE TYPE dentos_data.treatment_bundle_state AS ENUM ('advised','accepted','scheduled','in_progress','completed','declined','cancelled');

SET search_path = dentos_data, public;

