# User Flow & Interaction Documentation

## 1. Authentication & Navigation Flow Diagram

```mermaid
flowchart TD
    Start([User Arrives]) --> CheckAuth{Is Authenticated?}
    
    CheckAuth -- Yes --> FetchMe[GET /api/auth/me]
    FetchMe -- Valid JWT --> DetectRole[Detect User Role]
    DetectRole --> ShowDashboard[Render Main Dashboard /dashboard]
    
    CheckAuth -- No --> RenderLogin[Render Login Screen /login]
    
    RenderLogin --> ActionChoice{User Action}
    ActionChoice -- Click Register --> RenderRegister[Render Register Screen /register]
    ActionChoice -- Submit Login --> PostLogin[POST /api/auth/login]
    
    RenderRegister -- Submit Form --> PostRegister[POST /api/auth/register]
    PostRegister -- Success 201 --> RedirectLogin[Redirect to /login with Success Alert]
    PostRegister -- Error 400 --> ShowRegError[Display Validation Error] --> RenderRegister
    
    PostLogin -- Success 200 --> StoreToken[Store JWT Token in LocalStorage]
    StoreToken --> ShowDashboard
    
    PostLogin -- Invalid Credentials 401 --> ShowLoginError[Display Invalid Email/Password Alert]
    ShowLoginError --> RenderLogin
    
    ShowDashboard --> NavChoice{Select Nav Item}
    NavChoice -- /vendors --> Module1[Vendor Management Placeholder]
    NavChoice -- /procurement --> Module2[Procurement Operations Placeholder]
    NavChoice -- /purchase-orders --> Module3[Purchase Orders Placeholder]
    NavChoice -- /performance --> Module4[Vendor Performance Placeholder]
    NavChoice -- /analytics --> Module5[Analytics Placeholder]
    NavChoice -- /reports --> Module6[Reports Placeholder]
    NavChoice -- /notifications --> Module7[Notifications Placeholder]
    NavChoice -- Click Logout --> ClearToken[Clear Token & Session] --> RenderLogin
```

---

## 2. Protected Route Interception Flow

1. User attempts to navigate directly to protected URL (e.g. `/dashboard` or `/vendors`).
2. Angular `authGuard` checks `AuthService.isAuthenticated()`.
3. If token is missing or expired:
   - Route guard cancels navigation.
   - Redirects user to `/login`.
4. If token is valid:
   - HTTP Interceptor automatically attaches `Authorization: Bearer <token>` to outbound API calls.
   - Page loads successfully.
5. If backend returns `401 Unauthorized` during API call:
   - Interceptor catches 401 error.
   - Clears local storage session.
   - Redirects user to `/login` with session expired message.
