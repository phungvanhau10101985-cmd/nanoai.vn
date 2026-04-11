-- Gọi sau khi CREATE DATABASE trống, trước db:migrate:push.
-- init.sql tham chiếu auth.users; nanoai_ensure_user_by_email (migration sau) insert vào auth.users.
create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  instance_id uuid,
  id uuid not null,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

create index if not exists users_email_lower_idx on auth.users (lower(email));
