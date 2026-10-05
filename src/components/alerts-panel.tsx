"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Bell, Check, LogOut, Mail, Trash2, X } from "lucide-react";
import { browserDatabase } from "@/lib/supabase-browser";
import { MONITORS } from "@/lib/monitors";
import { Button } from "./ui/button";
import { useDialog } from "@/hooks/use-dialog";
type Subscription = { id: string; monitor_id: string };
function validDestination(raw: string) {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      ["discord.com", "discordapp.com"].includes(u.hostname) &&
      !u.port &&
      !u.search &&
      !u.hash &&
      !u.username &&
      !u.password &&
      /^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}
export function AlertsPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialog(onClose);
  const db = browserDatabase();
  const [user, setUser] = useState<User | null>(null),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false),
    [monitor, setMonitor] = useState("github"),
    [destination, setDestination] = useState(""),
    [subscriptions, setSubscriptions] = useState<Subscription[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!db) return;
    let active = true;
    db.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user);
    });
    const { data } = db.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [db]);
  useEffect(() => {
    if (!db || !user) return;
    let active = true;
    db.from("alert_subscriptions")
      .select("id,monitor_id")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (active) {
          setSubscriptions(data ?? []);
          if (error) setMessage(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [db, user]);
  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = signup
        ? await db.auth.signUp({ email, password })
        : await db.auth.signInWithPassword({ email, password });
      setMessage(
        error
          ? error.message
          : signup
            ? "Check your email to confirm your account, then sign in."
            : "Signed in.",
      );
    } catch {
      setMessage("Could not connect. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !user) return;
    if (!validDestination(destination)) {
      setMessage("Enter a valid Discord webhook URL.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await db
        .from("alert_subscriptions")
        .upsert(
          { user_id: user.id, monitor_id: monitor, destination },
          { onConflict: "user_id,monitor_id" },
        )
        .select("id,monitor_id");
      if (error) setMessage(error.message);
      else {
        setSubscriptions((prev) => [
          ...prev.filter((s) => s.monitor_id !== monitor),
          ...(data ?? []),
        ]);
        setDestination("");
        setMessage(
          "Subscription saved. Alerts start on the next known status change.",
        );
      }
    } catch {
      setMessage("Could not save. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!db) return;
    setBusy(true);
    const { error } = await db
      .from("alert_subscriptions")
      .delete()
      .eq("id", id);
    if (error) setMessage(error.message);
    else setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    setBusy(false);
  }
  return (
    <div className="modal-backdrop">
      <section
        ref={dialogRef}
        className="modal alert-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alerts-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">STAY IN THE LOOP</span>
            <h2 id="alerts-title">Your alert subscriptions</h2>
          </div>
          <Button
            autoFocus
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close alerts"
          >
            <X size={20} />
          </Button>
        </div>
        <p className="muted">
          Get a Discord notification when a provider reports a status change or
          recovery.
        </p>
        {!db ? (
          <div className="setup-note">
            <Bell size={24} />
            <h3>Alerts need a connected Supabase project</h3>
            <p>
              Configure Supabase Auth and apply the database migration to enable
              private subscriptions. Preview mode does not send notifications.
            </p>
          </div>
        ) : !user ? (
          <form onSubmit={authenticate} className="stack">
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <Button disabled={busy}>
              <Mail size={16} />
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
            </Button>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setSignup(!signup);
                setMessage("");
              }}
            >
              {signup
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </button>
          </form>
        ) : (
          <>
            <div className="signed-in">
              <span>{user.email}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => db.auth.signOut()}
              >
                <LogOut size={14} />
                Sign out
              </Button>
            </div>
            <form onSubmit={subscribe} className="stack">
              <label>
                Service
                <select
                  value={monitor}
                  onChange={(e) => setMonitor(e.target.value)}
                >
                  {MONITORS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Discord webhook URL
                <input
                  type="url"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/…"
                  autoComplete="off"
                />
              </label>
              <p className="small muted">
                Create a webhook in Discord → Server settings → Integrations.
                Its URL is private and visible only to your account and the
                delivery worker.
              </p>
              <Button disabled={busy}>
                <Check size={16} />
                Save subscription
              </Button>
            </form>
            <div className="subscriptions">
              {subscriptions.length === 0 ? (
                <p className="muted small">No subscriptions yet.</p>
              ) : (
                subscriptions.map((s) => (
                  <div key={s.id}>
                    <span>
                      {MONITORS.find((m) => m.id === s.monitor_id)?.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label={`Remove ${s.monitor_id} subscription`}
                      onClick={() => remove(s.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
        <p className="small muted">
          Five-minute checks · status transitions only · delivery may be delayed
        </p>
      </section>
    </div>
  );
}
