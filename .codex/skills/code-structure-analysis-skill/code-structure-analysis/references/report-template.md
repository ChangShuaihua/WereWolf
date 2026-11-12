# Project Code Structure Analysis Report

## 1. Project overview
- Project name:
- Project type:
- Primary languages:
- Core frameworks:
- Package manager / build tools:
- Analysis scope:

## 2. Technology stack and infrastructure
| Category | Technology | Evidence file | Purpose |
|---|---|---|---|

## 3. Directory structure
```text
Insert a filtered directory tree
```

| Directory / file | Responsibility | Key notes |
|---|---|---|

## 4. Entry points and runtime boundaries
| Entry point | File / symbol | Initialization or delegation |
|---|---|---|

## 5. Major module responsibilities
| Module | Key files | Responsibility | Dependencies | Output / side effects |
|---|---|---|---|---|

## 6. Module dependencies
```mermaid
flowchart TD
  A[Entry module] --> B[Business module]
  B --> C[Data access module]
```
> Keep only relationships confirmed by code evidence; label inferred relationships.

## 7. Core business call flow
```mermaid
sequenceDiagram
  participant U as User/Event
  participant H as Handler/Controller
  participant S as Service/Domain
  participant R as Repository/Client
  U->>H: Request or event
  H->>S: Invoke business capability
  S->>R: Read or write data
  R-->>S: Return result
  S-->>H: Business result
  H-->>U: Response or event
```

## 8. Architecture observations and recommendations
| Priority | Finding and evidence | Impact | Recommendation |
|---|---|---|---|

## 9. Unknowns and analysis boundaries
- Uninspected directories / files:
- Uncertainty caused by dynamic calls or runtime configuration:
- Items requiring a running system or additional information:
