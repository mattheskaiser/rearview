import { redirect } from "next/navigation";

// The root path also redirects via next.config.ts; this is a safety net so "/"
// never renders an empty page if that config changes.
export default function Home() {
  redirect("/overview");
}
