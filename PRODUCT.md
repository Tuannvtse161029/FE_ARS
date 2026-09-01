# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Researchers are the primary audience for the first redesign batch: they submit, track, revise, and discover research. Reviewers, Admins, Lecturers, Graduate Students, and Guest or pending users each retain their confirmed role-specific responsibilities and access boundaries.

## Product Purpose

Academic Research System (ARS) is a role-based academic platform for research discovery, paper submission and review, seminars, collaboration, and academic workspaces. It helps researchers move work through an accountable editorial lifecycle while making only approved public research discoverable.

## Positioning

ARS is a curated academic repository with an ARS-controlled editorial workflow. A Researcher submits, an Admin screens and makes the final publication decision, and a Reviewer provides a recommendation without publishing authority.

## Operating Context

Users read and prepare research papers, assess editorial queues, submit evaluations, manage seminars and research groups, and track milestones. The platform handles academic metadata such as titles, abstracts, authors, institutions, DOI, OpenAlex ID, dates, taxonomy, and workflow status.

## Capabilities and Constraints

- Preserve all existing routes, API contracts, role permissions, privacy behavior, authentication behavior, storage behavior, feature flags, Firebase upload flow, and payment behavior.
- Use live API data where available. Any permitted demo state must be explicitly labelled and must not claim persistence, delivery, verification, payment, or publication.
- Only published and public papers belong in the research catalog.
- Private reviewer comments, scores, recommendations, and Admin notes never appear publicly.
- The frontend uses React, TypeScript, Vite, CSS Modules, Axios, Firebase Storage, Vitest, and Playwright.
- The backend Swagger contract governs frontend endpoint and DTO use. Frontend work must not invent backend fields, permissions, or endpoints.

## Brand Commitments

ARS uses its existing name and logo. The redesign must feel modern and academic, supporting reading, writing, reviewing, and research discovery. It should use editorial structure, legible typography, purposeful interaction, and accessible color. It must avoid generic startup motifs, fake academic proof, decorative charts, and fabricated metrics.

## Evidence on Hand

The existing ARS logo is available in `src/assets/images/ARS_Logo.png`. The redesign’s public landing page is limited to truthful workflow and product-purpose content; it must not use invented people, manuscripts, testimonials, citations, institutional affiliations, activity, or metrics. Approved product screenshots or media are not currently available.

## Product Principles

- Editorial accountability is visible in the interface without exposing private review information.
- Each role sees its current task before secondary summaries or decoration.
- Research metadata supports comprehension and discovery rather than visual clutter.
- Live, demo, empty, loading, error, disabled, and permission-restricted states remain honest and distinguishable.
- Accessibility, reading comfort, and responsive task completion are product requirements.

## Accessibility & Inclusion

The redesign requires visible keyboard focus, semantic controls and headings, programmatic error and status feedback, accessible color contrast, 44px touch targets where applicable, support for long academic metadata, responsive layouts from 320px through desktop, and `prefers-reduced-motion` support.
