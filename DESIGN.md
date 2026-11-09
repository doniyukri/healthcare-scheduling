---
name: Rata Staff Workspace
description: A staff interface for managing clinic schedules.
colors:
  red: "#be0d1e"
  red-ink: "#a01725"
  rose: "#f9ebeb"
  canvas: "#f6f6f6"
  purple: "#75235e"
  purple-deep: "#581747"
  ink: "#312629"
  muted: "#6e6263"
  border: "#eadcda"
  white: "#fff"
typography:
  headline:
    fontFamily: '"Avenir Next", Avenir, "Segoe UI", sans-serif'
    fontSize: "34px"
    lineHeight: 1.2
    letterSpacing: "-.035em"
  body:
    fontFamily: '"Avenir Next", Avenir, "Segoe UI", sans-serif'
    fontSize: "13px"
    lineHeight: 1.5
rounded:
  control: "9px"
  panel: "14px"
  pill: "24px"
spacing:
  panel: "25px"
  content: "42px"
components:
  button-primary:
    backgroundColor: "{colors.purple}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "10px 17px"
  button-primary-hover:
    backgroundColor: "{colors.purple-deep}"
  input:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  panel:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.panel}"
    padding: "25px"
---

# Design System: Rata Staff Workspace

## Overview

**Creative North Star: "The Welcoming Workspace"**

An approachable operational workspace combines red brand and headings, purple primary actions, and calm light surfaces. Its visual direction takes inspiration from rata.id; it is not an official brand system.

**Key Characteristics:**
- Red brand and headings, with purple primary actions.
- White panels on a light-gray canvas with warm borders.
- Compact controls and tables for staff workflows.
- Rounded controls and a recurring smile motif.

## Colors

Brand red appears in wordmarks and headings; deep red marks active navigation and destructive actions. Purple distinguishes primary buttons. White and light gray form the canvas, with warm ink, muted text, borders, and pale rose selected states.

## Typography

Avenir Next, Avenir, Segoe UI, and sans-serif form a single approachable stack. Large, tightly tracked sign-in display type gives way to compact headings, labels, and table content. Tables use tabular figures.

## Layout

The desktop workspace uses a 246px sidebar, a 72px top bar, and a centered content area capped at 1500px. Forms use two columns. At 760px and below, the sidebar becomes an icon rail, forms become one column, and tables scroll horizontally with a swipe hint. The split sign-in screen becomes a single panel.

## Elevation & Depth

The interface is flat: white surfaces, warm borders, and tonal backgrounds separate regions without box shadows.

## Shapes

Controls have gently rounded corners, panels use larger corners, and primary actions are pill-shaped. A curved smile mark recurs in brand and supporting elements.

## Components

### Buttons

Purple primary buttons deepen on hover. White secondary buttons have warm borders. Controls have visible 3px keyboard focus outlines; disabled buttons reduce opacity.

### Cards / Containers

White list and form panels have warm 1px borders and 14px corners. Forms have 25px internal padding.

### Inputs / Fields

White fields have warm borders, 9px corners, 48px minimum height, and a stronger hover border. Labels sit above fields.

### Navigation

The white sidebar uses compact icon-and-label rows. Active items have pale rose backgrounds and deep red text. On small screens the rail shows icons without labels.

### Status and feedback

Rounded status chips use pale green with dark green text. Notices use tinted green for success and tinted red for failure.

## Do's and Don'ts

### Do:
- **Do** use red for brand and page headings and purple for primary actions.
- **Do** preserve visible keyboard focus and reduced-motion behavior.
- **Do** keep tables horizontally scrollable on narrow screens.

### Don't:
- **Don't** present the reference-inspired palette as an official brand specification.
- **Don't** add shadows to the existing flat surface language without a deliberate design change.
