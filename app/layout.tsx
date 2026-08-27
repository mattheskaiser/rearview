import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/app/components/organisms/Sidebar.organism";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rearview",
  description: "Review what's in the rearview.",
};

const navItems = [
  { label: "Overview", href: "/overview" },
  { label: "Entries", href: "/entries" },
  { label: "Memories", href: "/memories" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-row bg-background text-foreground">
        <Sidebar items={navItems} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
