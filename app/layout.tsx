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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} h-full antialiased bg-[#003554]`}
    >
      <body className="min-h-full flex flex-row">
        <Sidebar items={[{label: "Explore", href: "/explore"}, {label: "Memories", href: "/memories"}, {label: "Entries", href: "/entries"}]}/>
        {children}
      </body>
    </html>
  );
}
