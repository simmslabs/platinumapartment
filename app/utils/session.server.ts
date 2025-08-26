import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { getUserById } from "./auth.server";

const SESSION_SECRET = process.env.SESSION_SECRET || "fallback-session-secret";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
});

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function getUserSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  return userId;
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

export async function requireUser(request: Request) {
  const userId = await requireUserId(request);
  
  try {
    const user = await getUserById(userId);
    if (!user) {
      // User not found - invalid session
      throw logout(request);
    }
    return user;
  } catch (error) {
    // Any error should redirect to login
    throw logout(request);
  }
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (typeof userId !== "string") {
    return null;
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      // User not found in database - invalid session
      throw logout(request);
    }
    return user;
  } catch (error) {
    // Any error (database connection, user not found, etc.) should log out
    throw logout(request);
  }
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
