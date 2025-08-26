import type { ActionFunctionArgs } from "@remix-run/node";
import { logout } from "~/utils/session.server";

export async function action() {
  return new Response("Method not allowed", { status: 405 });
}

export async function loader({ request }: ActionFunctionArgs) {
  return logout(request);
}
