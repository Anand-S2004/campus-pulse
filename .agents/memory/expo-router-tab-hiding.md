---
name: Expo Router tab hiding
description: How to safely hide tab bar buttons in Expo Router without breaking route registration.
---

**Rule:** Always register tab screens in the navigator. Hide the tab bar button, not the screen itself.

**Why:** Conditionally rendering `<Tabs.Screen>` components based on async state (e.g., user role) causes route registration to change after the navigator is mounted. This produces runtime warnings/errors about layout children, breaks deep-linking, and can cause navigation state jumps when the role finally resolves.

**How to apply:**
- Use `tabBarButton: () => null` in the screen's `options` to hide the button for unauthorized roles.
- Do **not** use `href: null` together with `tabBarButton` in Expo Router tabs; the combination throws at runtime.
- Keep the screen file present in the route directory so it is always registered.
- Gate the actual screen content with an in-screen role guard so direct navigation still shows a "not authorized" message instead of broken UI.