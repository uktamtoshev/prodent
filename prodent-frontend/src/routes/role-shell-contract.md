# Role shell contract

Assistant, accountant, and manager pages currently own their role shell. Every
page wraps its content in the matching `AssistantLayout`, `AccountantLayout`, or
`ManagerLayout`.

Any future shared shell must preserve these rules:

1. Show a full-page loader while access is checked.
2. Read both `user_roles` and `clinic_members`.
3. Allow `super_admin` through `user_roles`.
4. Redirect unauthenticated or denied users to `/` with `replace`.
5. Keep each role's sidebar and `lg:pl-64` content offset.
6. Keep role-specific access rules:
   - assistant: `assistant`
   - accountant: `accountant`
   - manager: `clinic_manager`, plus `clinic_admin` in `clinic_members`
7. Keep manager denial text translated; assistant/accountant currently use their
   existing fixed denial text.

The route extraction deliberately does not move these layouts to a parent route.
Doing that now would change when the access check runs and would risk briefly
rendering or remounting protected page content.
