import * as SecureStore from "expo-secure-store";

const KEY = "hrms_offline_queue";

export type QueuedAction = {
  id: string; // idempotency key
  type: "check-in" | "check-out" | "leave-request";
  payload: unknown;
  timestamp: string;
  retries: number;
};

export async function enqueue(action: Omit<QueuedAction, "retries">) {
  const queue = await getQueue();
  queue.push({ ...action, retries: 0 });
  await SecureStore.setItemAsync(KEY, JSON.stringify(queue));
}

export async function getQueue(): Promise<QueuedAction[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function removeFromQueue(id: string) {
  const queue = (await getQueue()).filter((a) => a.id !== id);
  await SecureStore.setItemAsync(KEY, JSON.stringify(queue));
}
