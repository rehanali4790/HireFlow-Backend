-- Create hireflow_db database
-- Run this in pgAdmin connected to the default 'postgres' database

CREATE DATABASE hireflow_db
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'English_United States.1252'
    LC_CTYPE = 'English_United States.1252'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

COMMENT ON DATABASE hireflow_db IS 'HireFlow AI Hiring Platform Database';
