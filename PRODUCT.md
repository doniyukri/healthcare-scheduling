# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Clinic staff manage appointments for patients and doctors.

## Product Purpose

Manage healthcare consultation schedules, including patients, doctors, and appointment notifications.

## Operating Context

The existing local GraphQL services own authentication, scheduling and email notifications. This interface is a local MVP connected to those services.

## Capabilities and Constraints

Staff can sign in, manage patients and doctors, create and cancel appointments, and inspect schedules. The backend rejects doctor double-booking. Production deployment and additional roles remain undecided.
