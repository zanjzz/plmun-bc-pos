# Mobile notification trash button and concurrent session fix

Two distinct user-reported bugs addressed in parallel commits across main and survey-student-only branches: notification delete button displaying permanently without swipe interaction, and random logouts when multiple users logged into the same demo account. The notification fix removes explicit z-index layering. The session fix stops invalidating existing tokens when a demo user logs in from another device.

**Watch for:** confirmed — branches are out of sync: survey-student-only removed preventDefault/stopPropagation from delete button onClick, main branch did not; confirmed — event handler removal may cause notifications to be marked as read when delete is tapped.

**Verdict**: NEEDS_CHANGES

## High-level view

The branches are out of sync for the notification fix. Main branch removed z-index from both delete button (z-0) and swipeable content (z-10), keeping preventDefault and stopPropagation in the onClick handler. Survey-student-only removed the same z-index values BUT ALSO removed preventDefault and stopPropagation. This means survey-student-only's delete button will mark notifications as read when tapped, while main's will not.

The concurrent login issue was caused by the server updating the user's password on every demo login, which Supabase treats as a security event that invalidates all existing sessions. Both branches correctly remove the password field from updateUserById. This change only affects demo accounts; real user accounts weren't tested for concurrent login behavior.

<details>
<summary>Issues (4)</summary>

1. **Branches out of sync** — Main branch kept preventDefault and stopPropagation in the delete button onClick handler. Survey-student-only removed them. These branches must have identical behavior for both issues. Apply main's approach (keep the event handlers) to survey-student-only.

2. **Event handler removal causes mark-as-read** — Survey-student-only's delete button no longer calls preventDefault or stopPropagation, so tapping it will bubble up to the parent notification button and mark the notification as read. This is wrong. The fix is already correct on main; port it to survey-student-only.

3. **Z-index removal claim vs actual fix** — Both commits claim they "removed z-index from both button and content," but the diff shows they actually removed z-10 from the delete button (which was making it visible on top) and z-0 from swipeable content. The fix itself is correct, but the commit message description is backwards: the button had z-10 (not z-0), and that's what was making it permanently visible.

4. **Concurrent session fix scoped to demo accounts only** — The password update removal only applies to the demo login endpoint. Real user accounts that share credentials (if that's even possible) would still face session invalidation if they logged in concurrently. Clarify whether this is intentional or if real accounts also need this protection.

</details>

<details>
<summary>Details</summary>

## Notification button layering: z-index fix vs event handler divergence

The notification delete button was permanently visible because it had `z-10` in its className, placing it above the swipeable content. The fix removed the z-10, allowing the swipeable content (which comes later in DOM order) to naturally stack above it.

**Base state (commit 3b0a0bf):**
- Delete button: `z-10` + preventDefault/stopPropagation in onClick
- Swipeable content: no z-index

**Main branch (commit 5a5627c):**
- Delete button: no z-index + **kept preventDefault/stopPropagation**
- Swipeable content: no z-index

**Survey-student-only (commit 6c2cd04):**
- Delete button: no z-index + **removed preventDefault/stopPropagation**
- Swipeable content: no z-index

The branches are out of sync. Survey-student-only removed the event handlers, main did not. Without preventDefault/stopPropagation, tapping the delete button will bubble up to the parent `<button>` that wraps the notification content, which calls `readNotification(notification)`:

```tsx
{/* Delete button - survey-student-only removed e.preventDefault/stopPropagation */}
<button onClick={() => {
  void removeNotification(notification);
  setSwipedId(null);
}}>
  <Trash2 />
</button>

{/* Swipeable content with parent button */}
<div>
  <button onClick={(e) => {
    if (isSwiped) {
      e.preventDefault();
      e.stopPropagation();
      setSwipedId(null);
      return;
    }
    readNotification(notification); // ← this will fire when delete is tapped on survey-student-only
  }}>
    {/* notification content */}
  </button>
</div>
```

Main's approach is correct: keep the event handlers to prevent unwanted mark-as-read behavior.

## Concurrent demo sessions via metadata-only updates

The demo login endpoint previously called `auth.admin.updateUserById` with both `user_metadata` and `password` fields on every login. Supabase invalidates all existing sessions when a user's password changes, so every demo login would log out anyone else using that account.

The fix removes the password field:

```typescript
if (existing) {
  // Don't update password for existing users to allow concurrent sessions
  const { data, error } = await client.auth.admin.updateUserById(existing.id, {
    user_metadata: {
      name: account.profile.full_name,
      role: account.profile.role,
      reference: account.profile.reference,
    },
  });
  // password field removed
}
```

Now each login generates its own session token without invalidating others. This change only affects `/auth/demo-login`. The regular `/auth/login` endpoint doesn't update passwords on login, so it already supports concurrent sessions.

## Branch synchronization broken

The concurrent session fix is identical across branches. The notification fix is not.

**Main branch z-index fix:**
- Commit 6c00213: changed button from z-10 to z-0, added z-10 to content
- Commit 5a5627c: removed z-0 from button and z-10 from content
- Result: no z-index on either element, **event handlers preserved**

**Survey-student-only z-index fix:**
- Commit 9e7e672: changed button from z-10 to z-0, added z-10 to content
- Commit 6c2cd04: removed z-0 from button and z-10 from content **and removed event handlers**
- Result: no z-index on either element, **event handlers removed**

The requirement was "changes applied to BOTH branches." The notification fix was applied differently. Survey-student-only needs to restore preventDefault and stopPropagation to match main.

</details>

<details>
<summary>File map</summary>

- `src/App.tsx` — Removed preventDefault and stopPropagation from mobile notification delete button onClick handler
- `supabase/functions/server/index.ts` — Removed password field from demo login updateUserById call to preserve concurrent sessions
- `index.html` — Unrelated: removed duplicate doctype declaration and changed title from "PLMUN - BC" to "PLMun Business Center"
- `src/Login.tsx` — Unrelated: filtered demo account buttons to show only student role

Full diff: `git diff main`

</details>
