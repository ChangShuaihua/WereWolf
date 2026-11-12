# Test scenarios

Use these scenarios to evaluate the skill's analysis quality.

1. Small Vue application
   - Detect Vue/Vite/TypeScript only when manifests/configs support the claim.
   - Identify app bootstrap, router, stores, API client, and major views.
   - Do not claim every imported module is called at runtime.

2. Express API
   - Trace request entry through route/controller/service/repository where those layers exist.
   - Identify middleware ordering from actual application registration.
   - Flag absent layers as "not found", not as defects by default.

3. Python FastAPI service
   - Identify app creation, router registration, dependency injection, models, and persistence boundaries.
   - Distinguish synchronous calls from background tasks.

4. Monorepo
   - Identify workspace packages and package boundaries.
   - Avoid flattening independent apps into one architecture diagram.

5. Large or partially accessible repository
   - State coverage limits and prioritize entry points and user-selected feature.
   - Never fabricate missing files or call chains.

Acceptance criteria:
- Every key architectural claim has a path/symbol evidence reference.
- Secrets are never reproduced.
- Generated/dependency directories are excluded by default.
- Dependencies and runtime calls are clearly distinguished.
- Recommendations are specific, evidence-based, and prioritized.
