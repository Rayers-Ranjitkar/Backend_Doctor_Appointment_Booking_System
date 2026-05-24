# Rayers Hospital Knowledge Base

This folder contains dummy hospital knowledge data for `Rayers Hospital`.

Files:

- `hospitalProfile.json`: identity, contact, hours, booking policy
- `departments.json`: departments and summary services
- `services.json`: hospital service catalog
- `hospitalFaqs.json`: FAQ pairs for AI retrieval
- `hospitalPolicies.json`: basic operational rules

Intended use:

- Load these files inside the backend AI service
- Retrieve matching hospital context based on user questions
- Combine this context with doctor and schedule data from the database
