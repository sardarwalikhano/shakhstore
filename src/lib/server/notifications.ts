import { createClient } from "@supabase/supabase-js";

type NotificationType = "system" | "order" | "wallet" | "referral" | "cashout" | "delivery";

type InAppNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
};

/**
 * Inserts trusted server-generated notifications.
 * Notification failures are deliberately non-fatal: they must never roll back
 * or turn a successful order transition into a failed business operation.
 */
export async function createInAppNotifications(items: InAppNotification[]): Promise<void> {
  const validItems = items.filter((item) =>
    /^[0-9a-f-]{36}$/i.test(item.userId) &&
    item.title.trim().length > 0 &&
    item.title.trim().length <= 160
  );

  if (validItems.length === 0) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("In-app notifications skipped: Supabase service configuration is missing.");
    return;
  }

  try {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await admin.from("notifications").insert(
      validItems.map((item) => ({
        user_id: item.userId,
        type: item.type,
        title: item.title.trim(),
        body: (item.body ?? "").slice(0, 2000),
        data: item.data ?? {},
      }))
    );

    if (error) {
      console.error("In-app notification insert failed:", error.message);
    }
  } catch (error) {
    console.error("In-app notification writer failed:", error);
  }
}
