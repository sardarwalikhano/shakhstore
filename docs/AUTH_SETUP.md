# SHAKH STORE Authentication Setup

## Implemented routes

- `/login`: email/password login and Google OAuth login.
- `/signup`: email signup, name, optional phone, password confirmation, and Google OAuth signup.
- `/forgot-password`: request a password recovery email.
- `/reset-password`: set a new password after a valid recovery link.
- `/auth/callback`: securely exchanges Supabase PKCE authorization codes for a session.
- `/dashboard`: authenticated landing page.
- `/profile`: authenticated profile details and sign-out.

New registrations do not accept a role from the browser. The app stores only name and phone in user metadata; role assignment remains trusted-admin controlled. New accounts default to the app's customer fallback role until assigned otherwise.

## Supabase URL configuration

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `https://daim-post.online`
- Add redirect URL: `https://daim-post.online/auth/callback`
- Add redirect URL: `https://daim-post.online/reset-password`

Keep the current Vercel preview/production redirect URLs only if they are still used for testing. Do not remove other required redirect entries without checking their usage.

## Google OAuth provider setup

1. Open Supabase Dashboard → Authentication → Providers → Google and enable Google.
2. Copy the exact callback URL shown by Supabase. It is normally `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`. Use the actual project URL shown in the dashboard; do not guess the project reference.
3. In Google Cloud Console, configure an OAuth 2.0 Web application client:
   - Authorized JavaScript origin: `https://<SUPABASE_PROJECT_REF>.supabase.co`
   - Authorized redirect URI: the exact Supabase callback URL above.
4. Copy the Google OAuth Client ID and Client Secret into the Supabase Google provider settings and save.
5. In Google OAuth consent screen, configure the app name, support email, developer contact, and publishing/test-user status as appropriate.
6. Test with a Google account authorized by the consent screen.

Google OAuth Client ID/Secret belong in Supabase's Google provider configuration. Never expose the Client Secret in browser code, GitHub, or a `NEXT_PUBLIC_*` environment variable.

## Email confirmation and password reset

- If email confirmation is enabled, signup shows a confirmation message and the user must open the email link before signing in.
- Ensure Supabase email templates use the confirmation URL variable and that SMTP delivery is verified.
- Password reset redirects to `/auth/callback?next=/reset-password`, then the user sets a new password.
- The production sender domain and SMTP configuration must be verified separately.

## Security notes

- Role is never selected by the signup form.
- Do not trust user-editable `user_metadata` for authorization. Use trusted `app_metadata` or database-backed role checks on the server.
- Service-role secrets must remain server-side only.
- Callback redirect paths are restricted to same-origin relative paths.
