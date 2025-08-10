import { json } from "@remix-run/node";

export async function loader() {
  return json({ message: "API is working", timestamp: new Date().toISOString() });
}
