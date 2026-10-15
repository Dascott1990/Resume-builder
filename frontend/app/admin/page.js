"use client";
/**
 * app/admin/page.js — the admin panel's front door.
 *
 * A real URL route (not a screen inside the main app/page.js shell) on
 * purpose: it needs its own gate (checked before anything else renders),
 * shouldn't be reachable from the regular nav, and has nothing to do with
 * the guest_id-scoped app the rest of the site is built around.
 *
 * The actual gate (checking/needs-login/denied/ok state machine, the
 * login form, break-glass fallback) lives in components/admin/AdminGate.js
 * — shared with app/brand/page.js, which gates the exact same way.
 */
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default function AdminPage() {
  return (
    <AdminGate>
      {({ adminUser, signOut }) => <AdminDashboard adminUser={adminUser} onSignOut={signOut} />}
    </AdminGate>
  );
}
